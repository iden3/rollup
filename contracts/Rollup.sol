pragma solidity ^0.6.1;

import '../node_modules/@openzeppelin/contracts/ownership/Ownable.sol';
import '../node_modules/@openzeppelin/contracts/token/ERC20/IERC20.sol';
import './lib/RollupHelpers.sol';
import './RollupInterface.sol';
import './VerifierInterface.sol';

contract Rollup is Ownable, RollupHelpers, RollupInterface {
    // External contracts used
    VerifierInterface verifier;

    // Forge batch mechanism owner
    address ownerForgeBatch;

    // Each batch forged will have the root state of the 'balance tree'
    bytes32[] stateRoots;

    // Each batch forged will have a correlated 'exit tree' represented by the exit root
    bytes32[] exitRoots;
    mapping(uint256 => bool) public exitNullifier;

    // Define struct to store data for each id, batchlastLeafIndex + relativeIndex = index of the leaf.
    struct leafInfo{
        uint64 batchNum;
        uint32 relativeIndex;
        address ethAddress;
    }
    // store account information, hash(Ax, Ay, tokenId)
    mapping(uint256 => leafInfo) treeInfo;

    struct indexInfo{
        uint64 lastLeafIndex;//lastLeafIndex
        uint32 depositCount; //depositCount
    }
    // batchnum to Index
    mapping(uint256 => indexInfo) public batchToIndex;

    // Maxim Deposit allowed
    uint constant MAX_AMOUNT_DEPOSIT = (1 << 128);

    // List of valid ERC20 tokens that can be deposit in 'balance tree'
    address[] public tokens;
    mapping(uint => address) tokenList;
    uint constant MAX_TOKENS = 0xFFFFFFFF;
    uint public feeAddToken = 0.01 ether;

    // Address to receive token fees
    address payable feeTokenAddress;

    // Hash of all on chain transactions ( will be forged in the next batch )
    // Forces 'operator' to add all on chain transactions
    uint256 public miningOnChainTxsHash;

    // Hash of all on chain transactions ( will be forged in two batches )
    // Forces 'operator' to add all on chain transactions
    uint256 fillingOnChainTxsHash = 0;

    // Fees of all on-chain transactions which goes to the operator that will forge the batch
    uint256 totalMinningOnChainFee;
    // Fees of all on-chain transactions that will be on minninf the next batch
    uint256 totalFillingOnChainFee;

    // Fees recollected for every on-chain transaction
    uint constant public FEE_ONCHAIN_TX = 0.1 ether;
    uint constant public FEE_OFFCHAIN_DEPOSIT = 0.001 ether;

    // maximum on-chain transactions
    uint public MAX_ONCHAIN_TX;
    // maximum rollup transactions: either off-chain or on-chain transactions
    uint public MAX_TX;
    // current on chain transactions
    uint public currentOnChainTx = 0;

    // Flag to determine if the mechanism to forge batch has been initialized
    bool initialized = false;

    // Number of levels in Snark circuit
    uint256 public NLevels = 24;

    // Input snark definition
    uint256 constant newStateRootInput = 0;
    uint256 constant newExitRootInput = 1;
    uint256 constant onChainHashInput = 2;
    uint256 constant offChainHashInput = 3;
    uint256 constant nTxperTokenInput = 4;
    uint256 constant oldStateRootInput = 5;
    uint256 constant feePlanCoinsInput = 6;
    uint256 constant feePlanFeesInput = 7;

    /**
     * @dev Event called when any on-chain transaction has benn done
     * contains all data required for the operator to update balance tree
     */
    event OnChainTx(uint batchNumber, bytes32 txData, uint128 loadAmount,
        address fromEthAddress, uint256 fromAx, uint256 fromAy,  address toEthAddress, uint256 toAx, uint256 toAy);

    /**
     * @dev Event called when a batch is forged
     * Contains which batch has been forged and on which block number
     */
    event ForgeBatch(uint batchNumber, uint blockNumber);

    /**
     * @dev Event called when a token is added to token list
     * Contains token address and its index inside rollup token list
     */
    event AddToken(address tokenAddress, uint tokenId);

    /**
     * @dev modifier to check if forge batch mechanism has been initialized
     */
    modifier isForgeBatch {
        require(initialized == true, 'forge batch mechanism has not been loaded');
        require(ownerForgeBatch == msg.sender, 'message sender is not forge batch mechanism owner');
        _;
    }

    /**
     * @dev Rollup constructor
     * Loads 'RollupHelpers' constructor with poseidon
     * Loads verifier zk-snark proof
     * @param _verifier verifier zk-snark proof address
     * @param _poseidon poseidon hash function address
     * @param _maxTx maximum rollup transactions, either on-chain or off-chain
     * @param _maxOnChainTx maximum rollup on-chain transactions
     */
    constructor(address _verifier, address _poseidon, uint _maxTx,
        uint _maxOnChainTx, address payable _feeTokenAddress) RollupHelpers(_poseidon) public {
        feeTokenAddress = _feeTokenAddress;
        verifier = VerifierInterface(_verifier);
        MAX_ONCHAIN_TX = _maxOnChainTx;
        MAX_TX = _maxTx;
        stateRoots.push(bytes32(0));
        exitRoots.push(bytes32(0));
    }

    /**
     * @dev Load forge batch mechanism smart contract
     * @param forgeBatchMechanismAddress rollupPoS contract address
     */
    function loadForgeBatchMechanism(address forgeBatchMechanismAddress) public onlyOwner{
        ownerForgeBatch = forgeBatchMechanismAddress;
        initialized = true;
    }

    /**
     * @dev Inclusion of a new token that will be able to deposit on 'balance tree'
     * Fees to include token are increased as tokens are added into rollup
     * @param tokenAddress smart contract token address
     */
    function addToken(address tokenAddress) public payable {
        // Allow MAX_TOKENS different types of tokens
        require(tokens.length <= MAX_TOKENS, 'token list is full');
        require(msg.value >= feeAddToken, 'Amount is not enough to cover token fees');
        tokens.push(tokenAddress);
        uint tokenId = tokens.length - 1;
        tokenList[tokenId] = tokenAddress;
        feeTokenAddress.transfer(msg.value);
        // increase fees for next token deposit
        feeAddToken = (feeAddToken / 4) + feeAddToken;
        emit AddToken(tokenAddress, tokenId);
    }

    /**
     * @dev update on-chain hash
     * @param txData transaction rollup data
     * @param loadAmount amount to add to balance tree
     * @param fromEthAddress ethereum Address
     * @param fromBabyPubKey public key babyjubjub represented as point (Ax, Ay)
     * @param toEthAddress ethereum Address
     * @param toBabyPubKey public key babyjubjub represented as point (Ax, Ay)
     * @param onChainFee fee payed for the on-chain transaction sender
     */
    function _updateOnChainHash(
        uint256 txData,
        uint128 loadAmount,
        address fromEthAddress,
        uint256[2] memory fromBabyPubKey,
        address toEthAddress,
        uint256[2] memory toBabyPubKey,
        uint256 onChainFee
    ) private {
        Entry memory onChainData = buildOnChainData(fromEthAddress, fromBabyPubKey[0], fromBabyPubKey[1],
        toEthAddress, toBabyPubKey[0], toBabyPubKey[1]);
        uint256 hashOnChainData = hashEntry(onChainData);
        Entry memory onChainHash = buildOnChainHash(fillingOnChainTxsHash, txData, loadAmount,
            hashOnChainData);
        fillingOnChainTxsHash = hashEntry(onChainHash);
        // Update number of on-chain transactions
        currentOnChainTx++;

        // The burned fee depends on how many on-chain transactions have been taken place the last batch
        // It grows linearly to a maximum of 33% of the onChainFee
        uint256 burnedFee = (onChainFee * currentOnChainTx) / (MAX_ONCHAIN_TX * 3);
        address(0).transfer(burnedFee);
        // Update total on-chain fees
        totalFillingOnChainFee += onChainFee - burnedFee;

        // trigger on chain tx event event
        emit OnChainTx(getStateDepth(), bytes32(txData), loadAmount, fromEthAddress, fromBabyPubKey[0], fromBabyPubKey[1],
        toEthAddress, toBabyPubKey[0], toBabyPubKey[1]);
    }

    /**
     * @dev Deposit on-chain transaction
     * add new leaf to balance tree and initializes it with a load amount
     * @param loadAmount initial balance on balance tree
     * @param tokenId token type identifier
     * @param ethAddress allowed address to control new balance tree leaf
     * @param babyPubKey public key babyjubjub represented as point (Ax, Ay)
    */
    function deposit(
        uint128 loadAmount,
        uint32 tokenId,
        address ethAddress,
        uint256[2] memory babyPubKey
    ) public payable {
        require(msg.value >= FEE_ONCHAIN_TX, 'Amount deposited less than fee required');
        require(loadAmount > 0, 'Deposit amount must be greater than 0');
        require(loadAmount < MAX_AMOUNT_DEPOSIT, 'deposit amount larger than the maximum allowed');
        require(ethAddress != address(0), 'Must specify withdraw address');
        require(tokenList[tokenId] != address(0), 'token has not been registered');
        require(currentOnChainTx < MAX_ONCHAIN_TX, 'Reached maximum number of on-chain transactions');

        leafInfo storage leaf = treeInfo[uint256(keccak256(abi.encodePacked(babyPubKey,tokenId)))];
        require(leaf.ethAddress == address(0), 'leaf already exist');
        // Get token deposit on rollup smart contract
        require(depositToken(tokenId, loadAmount), 'Fail deposit ERC20 transaction');
        // build txData for deposit
        bytes32 txDataDeposit = buildTxData(0, tokenId, 0, 0, 0, true, true);
        _updateOnChainHash(uint256(txDataDeposit), loadAmount, ethAddress, babyPubKey, address(0), [uint256(0),uint256(0)], msg.value);
        // Increment index leaf balance tree
        batchToIndex[getStateDepth()].depositCount++;
        // Insert tree informations
        leaf.batchNum = uint64(getStateDepth());
        leaf.relativeIndex = batchToIndex[getStateDepth()].depositCount;
        leaf.ethAddress = ethAddress;
    }

   /**
     * @dev Deposit on-chain transaction
     * add new leaf to balance tree and initializes it with a load amount
     * @param zip token and Ethaddress
     * @param babyPubKey public key babyjubjub represented as point (Ax, Ay)
     * @param relativeIndex relative index of this deposit
    */
    function depositOffChain(
        uint256 zip,
        uint256[2] memory babyPubKey,
        uint32 relativeIndex
    ) internal {
        (address ethAddress, uint32 tokenId) = unZipAddressTokens(zip);
        require(ethAddress != address(0), 'Must specify withdraw address');
        require(tokenList[tokenId] != address(0), 'token has not been registered');
        leafInfo storage leaf = treeInfo[uint256(keccak256(abi.encodePacked(babyPubKey,tokenId)))];
        require(leaf.ethAddress == address(0), 'leaf already exist');
        // burn fee
        address(0).transfer(FEE_OFFCHAIN_DEPOSIT);
        // build txData for deposit
        bytes32 txDataDeposit = buildTxData(0, tokenId, 0, 0, 0, true, true);
        Entry memory onChainData = buildOnChainData(ethAddress, babyPubKey[0], babyPubKey[1],
        address(0), 0, 0);
        uint256 hashOnChainData = hashEntry(onChainData);
        Entry memory onChainHash = buildOnChainHash(miningOnChainTxsHash, uint256(txDataDeposit), 0,
         hashOnChainData);
        miningOnChainTxsHash = hashEntry(onChainHash);
        // Insert tree information
        if (getStateDepth() == 0){
            leaf.batchNum = 0;
            leaf.relativeIndex = relativeIndex;
            leaf.ethAddress = ethAddress;
        }
        else{
            leaf.batchNum = uint64(getStateDepth() - 1);
            leaf.relativeIndex = relativeIndex;
            leaf.ethAddress = ethAddress;
        }
    }

    /**
     * @dev Deposit on an existing balance tree leaf
     * @param babyPubKey public key babyjubjub represented as point (Ax, Ay)
     * @param loadAmount amount to be added into leaf specified by idBalanceTree
     * @param tokenId token identifier
    */
    function depositOnTop(
        uint256[2] memory babyPubKey,
        uint128 loadAmount,
        uint32 tokenId
    ) public payable{
        require(msg.value >= FEE_ONCHAIN_TX, 'Amount deposited less than fee required');
        require(currentOnChainTx < MAX_ONCHAIN_TX, 'Reached maximum number of on-chain transactions');
        require(loadAmount > 0, 'Deposit amount must be greater than 0');
        require(loadAmount < MAX_AMOUNT_DEPOSIT, 'deposit amount larger than the maximum allowed');
        leafInfo memory leaf = treeInfo[uint256(keccak256(abi.encodePacked(babyPubKey,tokenId)))];
        require(leaf.ethAddress != address(0), 'leaf does no exist');
        // Get token deposit on rollup smart contract
        require(depositToken(tokenId, loadAmount), 'Fail deposit ERC20 transaction');
        // build txData for deposit on top
        bytes32 txDataDepositOnTop = buildTxData(0, tokenId, 0, 0, 0, true, false);
        _updateOnChainHash(uint256(txDataDepositOnTop), loadAmount, leaf.ethAddress, babyPubKey, address(0), [uint256(0),uint256(0)], msg.value);
    }

    /**
     * @dev Transfer between two accounts already defined in balance tree
     * @param fromBabyPubKey account sender
     * @param toBabyPubKey account receiver
     * @param amountF amount to send encoded as half precision float
     * @param tokenId token identifier
    */
    function transfer(
        uint256[2] memory fromBabyPubKey,
        uint256[2] memory toBabyPubKey,
        uint16 amountF,
        uint32 tokenId
    ) public payable{
        require(msg.value >= FEE_ONCHAIN_TX, 'Amount deposited less than fee required');
        require(currentOnChainTx < MAX_ONCHAIN_TX, 'Reached maximum number of on-chain transactions');

        leafInfo memory fromLeaf = treeInfo[uint256(keccak256(abi.encodePacked(fromBabyPubKey,tokenId)))];
        leafInfo memory toLeaf;
        if (!(toBabyPubKey[0] == 0 && toBabyPubKey[1] == 0)){
            toLeaf = treeInfo[uint256(keccak256(abi.encodePacked(toBabyPubKey,tokenId)))];
            require(toLeaf.ethAddress != address(0), 'leaf does not exist');
        }
        require(fromLeaf.ethAddress == msg.sender, 'Sender does not match identifier balance tree');
        // build txData for transfer
        bytes32 txDataTransfer = buildTxData(amountF, tokenId, 0, 0, 0, true, false);
        _updateOnChainHash(uint256(txDataTransfer), 0, fromLeaf.ethAddress, fromBabyPubKey,
         toLeaf.ethAddress, toBabyPubKey, msg.value);
    }


    /**
     * @dev add new leaf to balance tree and initializes it with a load amount
     * then transfer some amount to an account already defined in the balance tree
     * @param loadAmount initial balance on balance tree
     * @param tokenId token identifier
     * @param fromEthAddress allowed address to control new balance tree leaf
     * @param fromBabyPubKey public key babyjubjub of the sender represented as point (Ax, Ay)
     * @param toBabyPubKey account receiver
     * @param amountF amount to send encoded as half precision float
    */
    function depositAndTransfer(
        uint128 loadAmount,
        uint32 tokenId,
        address fromEthAddress,
        uint256[2] memory fromBabyPubKey,
        uint256[2] memory toBabyPubKey,
        uint16 amountF
    ) public payable{
        require(msg.value >= FEE_ONCHAIN_TX, 'Amount deposited less than fee required');
        require(currentOnChainTx < MAX_ONCHAIN_TX, 'Reached maximum number of on-chain transactions');
        require(loadAmount > 0, 'Deposit amount must be greater than 0');
        require(loadAmount < MAX_AMOUNT_DEPOSIT, 'deposit amount larger than the maximum allowed');
        require(fromEthAddress != address(0), 'Must specify withdraw address');
        require(tokenList[tokenId] != address(0), 'token has not been registered');

        leafInfo memory fromLeaf = treeInfo[uint256(keccak256(abi.encodePacked(fromBabyPubKey,tokenId)))];
        leafInfo memory toLeaf;
        if (!(toBabyPubKey[0] == 0 && toBabyPubKey[1] == 0)){
            toLeaf = treeInfo[uint256(keccak256(abi.encodePacked(toBabyPubKey,tokenId)))];
            require(toLeaf.ethAddress != address(0), 'leaf does not exist');
        }
        require(fromLeaf.ethAddress == address(0), 'leaf already exist');


        // Get token deposit on rollup smart contract
        require(depositToken(tokenId, loadAmount), 'Fail deposit ERC20 transaction');
        // build txData for DepositAndtransfer
        bytes32 txDataDepositAndTransfer = buildTxData(amountF, tokenId, 0, 0, 0, true, true);
        _updateOnChainHash(uint256(txDataDepositAndTransfer), loadAmount, fromEthAddress, fromBabyPubKey,
        toLeaf.ethAddress, toBabyPubKey, msg.value);
        // Increment index leaf balance tree
        batchToIndex[getStateDepth()].depositCount++;
        // Insert tree informations
        treeInfo[uint256(keccak256(abi.encodePacked(fromBabyPubKey,tokenId)))] = leafInfo(uint64(getStateDepth()),
         batchToIndex[getStateDepth()].depositCount, fromEthAddress);
    }


    /**
     * @dev Withdraw balance from identifier balance tree
     * user has to prove ownership of ethAddress of idBalanceTree
     * @param fromBabyPubKey public key babyjubjub of the sender represented as point (Ax, Ay)
     * @param tokenId token identifier
     * @param amountF total amount coded as float 16 bits
     */
    function forceWithdraw(
        uint256[2] memory fromBabyPubKey,
        uint32 tokenId,
        uint16 amountF
    ) public payable{
        require(msg.value >= FEE_ONCHAIN_TX, 'Amount deposited less than fee required');
        require(currentOnChainTx < MAX_ONCHAIN_TX, 'Reached maximum number of on-chain transactions');

        leafInfo memory fromLeaf = treeInfo[uint256(keccak256(abi.encodePacked(fromBabyPubKey,tokenId)))];
        require(fromLeaf.ethAddress == msg.sender, 'Sender does not match identifier balance tree');

        // build txData for withdraw
        bytes32 txDataWithdraw = buildTxData(amountF, tokenId, 0, 0, 0, true, false);
        _updateOnChainHash(uint256(txDataWithdraw), 0, msg.sender, fromBabyPubKey, address(0), [uint256(0),uint256(0)], msg.value);
    }

    /**
     * @dev withdraw on-chain transaction to get balance from balance tree
     * Before this call an off-chain withdraw transaction must be done
     * Off-chain withdraw transaction will build a leaf on exit tree
     * Each batch forged will publish its exit tree root
     * All leaves created on the exit are allowed to call on-chain transaction to finish the withdraw
     * @param idBalanceTree account identifier on the balance tree
     * @param amount amount to retrieve
     * @param numExitRoot exit root depth. Number of batch where the withdraw transaction has been done
     * @param siblings siblings to demonstrate merkle tree proofç
     * @param fromBabyPubKey public key babyjubjub of the sender represented as point (Ax, Ay)
     * @param tokenId token identifier
     */
    function withdraw(
        uint64 idBalanceTree,
        uint256 amount,
        uint256 numExitRoot,
        uint256[] memory siblings,
        uint256[2] memory fromBabyPubKey,
        uint32 tokenId
    ) public {
        // Build 'key' and 'value' for exit tree
        uint256 keyExitTree = idBalanceTree;
        Entry memory exitEntry = buildTreeState(amount, tokenId, fromBabyPubKey[0],
        fromBabyPubKey[1], msg.sender, 0);
        uint256 valueExitTree = hashEntry(exitEntry);
        // Get exit root given its index depth
        uint256 exitRoot = uint256(getExitRoot(numExitRoot));
        // Check exit tree nullifier
        uint256[] memory inputs = new uint256[](3);
        inputs[0] = valueExitTree;
        inputs[1] = numExitRoot;
        inputs[1] = exitRoot;
        uint256 nullifier = hashGeneric(inputs);
        require(exitNullifier[nullifier] == false, 'withdraw has been already done');
        // Check sparse merkle tree proof
        bool result = smtVerifier(exitRoot, siblings, keyExitTree, valueExitTree, 0, 0, false, false, 24);
        require(result == true, 'invalid proof');
        // Withdraw token from rollup smart contract to ethereum address
        require(withdrawToken(tokenId, msg.sender, amount), 'Fail ERC20 withdraw');
        // Set nullifier
        exitNullifier[nullifier] = true;
    }

    /**
     * @dev Checks proof given by the operator
     * forge a batch if succesfull and pay fees to beneficiary address
     * @param beneficiaryAddress address to receive all fees
     * @param proofA zk-snark input
     * @param proofB zk-snark input
     * @param proofC zk-snark input
     * @param input public zk-snark inputs
     * @param compressedOnChainTx compresssed deposit offchain
    */
    function forgeBatch(
        address payable beneficiaryAddress,
        uint[2] calldata proofA,
        uint[2][2] calldata proofB,
        uint[2] calldata proofC,
        uint[8] calldata input,
        uint256[] calldata compressedOnChainTx
    ) external payable override virtual isForgeBatch {

        // Verify old state roots
        require(bytes32(input[oldStateRootInput]) == stateRoots[getStateDepth()],
            'old state root does not match current state root');
        //add deposits off-chain
        // verify all the fields of the off-chain deposit
        uint64 depositLength = uint64(compressedOnChainTx.length/3);

        //index+deposits offchain = lastLeafIndex + depositCount of the previous batch
        uint64 currentlastLeafIndex;
        uint32 latBatchdepositCount;
        if (getStateDepth() != 0){
            currentlastLeafIndex = batchToIndex[getStateDepth()-1].lastLeafIndex + batchToIndex[getStateDepth()-1].depositCount;
            latBatchdepositCount = batchToIndex[getStateDepth()-1].depositCount;
        }
        require(msg.value >= FEE_OFFCHAIN_DEPOSIT*depositLength, 'Amount deposited less than fee required');
        for (uint256 i = 0; i < depositLength; i++) {
           depositOffChain(compressedOnChainTx[i*3],[compressedOnChainTx[i*3+1], compressedOnChainTx[i*3+2]], ++latBatchdepositCount);
        }
        //previous last Leaf index + onchain deposit in the preovious batch, + offchain deposits in current batch = new index
        batchToIndex[getStateDepth()].lastLeafIndex = currentlastLeafIndex + depositLength;
        // Verify on-chain hash
        require(input[onChainHashInput] == miningOnChainTxsHash,
            'on-chain hash does not match current mining on-chain hash');

        // Verify zk-snark circuit
        require(verifier.verifyProof(proofA, proofB, proofC, input) == true,
            'zk-snark proof is not valid');

        // Update state roots
        stateRoots.push(bytes32(input[newStateRootInput]));

        // Update exit roots
        exitRoots.push(bytes32(input[newExitRootInput]));

        // Clean fillingOnChainTxsHash an its fees
        uint payOnChainFees = totalMinningOnChainFee;


        miningOnChainTxsHash = fillingOnChainTxsHash;
        fillingOnChainTxsHash = 0;
        totalMinningOnChainFee = totalFillingOnChainFee;
        totalFillingOnChainFee = 0;

        // Update number of on-chain transactions
        currentOnChainTx = 0;

        // Calculate fees and pay them
        withdrawTokens([bytes32(input[feePlanCoinsInput]), bytes32(input[feePlanFeesInput])],
        bytes32(input[nTxperTokenInput]), beneficiaryAddress);


        // Pay onChain transactions fees
        beneficiaryAddress.transfer(payOnChainFees);

        // event with all compressed transactions given its batch number
        emit ForgeBatch(getStateDepth(), block.number);
    }


    function withdrawTokens(bytes32[2] memory feePlan, bytes32 nTxPerToken, address payable beneficiaryAddress) internal {
        for (uint i = 0; i < 16; i++) {
            (uint tokenId, uint totalTokenFee) = calcTokenTotalFee(bytes32(feePlan[0]), bytes32(feePlan[1]),
            bytes32(nTxPerToken), i);

            if(totalTokenFee != 0) {
                require(withdrawToken(uint32(tokenId), beneficiaryAddress, totalTokenFee),
                    'Fail ERC20 withdraw');
            }
        }
    }

    /**

    //////////////
    // Viewers
    /////////////

    /**
     * @dev Retrieve state root given its batch depth
     * @param numBatch batch depth
     * @return root
     */
    function getStateRoot(uint numBatch) public view returns (bytes32) {
        require(numBatch <= stateRoots.length - 1, 'Batch number does not exist');
        return stateRoots[numBatch];
    }

    /**
     * @dev Retrieve total number of batches forged
     * @return Total number of batches forged
     */
    function getStateDepth() public view returns (uint) {
        return stateRoots.length - 1;
    }

    /**
     * @dev Retrieve exit root given its batch depth
     * @param numBatch batch depth
     * @return exit root
    */
    function getExitRoot(uint numBatch) public view returns (bytes32) {
        require(numBatch <= exitRoots.length - 1, 'Batch number does not exist');
        return exitRoots[numBatch];
    }

    /**
     * @dev Retrieve token address from its index
     * @param tokenId token id for rollup smart contract
     * @return token address
    */
    function getTokenAddress(uint tokenId) public view returns (address) {
        require(tokens.length > 0, 'There are no tokens listed');
        require(tokenId <= (tokens.length - 1), 'Token id does not exist');
        return tokenList[tokenId];
    }

    ///////////
    // helpers ERC20 functions
    ///////////

    /**
     * @dev deposit token to rollup smart contract
     * Previously, it requires an approve erc20 transaction to allow this contract
     * make the transaction for the msg.sender
     * @param tokenId token id
     * @param amount quantity of token to send
     * @return true if succesfull
     */
    function depositToken(uint32 tokenId, uint128 amount) private returns(bool){
        return IERC20(tokenList[tokenId]).transferFrom(msg.sender, address(this), amount);
    }

    /**
     * @dev withdraw token from rollup smart contract
     * Tokens on rollup smart contract are withdrawn
     * @param tokenId token id
     * @param receiver address to receive amount
     * @param amount quantity to withdraw
     * @return true if succesfull
     */
    function withdrawToken(uint32 tokenId, address receiver, uint256 amount) private returns(bool){
        return IERC20(tokenList[tokenId]).transfer(receiver, amount);
    }

    function getLeafInfo( uint256[2] memory fromBabyPubKey, uint32 tokenId)
     public view returns( uint64 batchNum, uint32 relativeIndex,address ethAddress){
          leafInfo storage leaf = treeInfo[uint256(keccak256(abi.encodePacked(fromBabyPubKey,tokenId)))];
          return (leaf.batchNum, leaf.relativeIndex, leaf.ethAddress);
    }
}