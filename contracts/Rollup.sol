pragma solidity ^0.5.0;

import '../node_modules/openzeppelin-solidity/contracts/ownership/Ownable.sol';
import './lib/RollupHelpers.sol';
import './RollupInterface.sol';
import './VerifierInterface.sol';

/**
 * @dev Define interface ERC20 contract
 */
contract ERC20 {
    function transfer(address recipient, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
}

contract Rollup is Ownable, RollupHelpers, RollupInterface {
    // External contracts used
    VerifierInterface verifier;

    // Forge batch mechanism owner
    address ownerForgeBatch;

    // Each batch forged will have the root state of the 'balance tree'
    bytes32[] stateRoots;

    // Each batch forged will have a correlated 'exit tree' represented by the exit root
    bytes32[] exitRoots;
    mapping(uint256 => bool) exitNullifier;

    // Define struct to store data for each id
    struct leafInfo{
        uint32 tokenId;
        address ethAddress;
        uint256[2] babyPubKey;
    }
    // store account information
    mapping(uint64 => leafInfo) treeInfo;

    // Maxim Deposit allowed
    uint constant MAX_AMOUNT_DEPOSIT = (1 << 128);

    // List of valid ERC20 tokens that can be deposit in 'balance tree'
    address[] tokens;
    mapping(uint => address) tokenList;
    uint constant MAX_TOKENS = 0xFFFFFFFF;
    uint feeAddToken = 0.01 ether;

    // Set the leaf position for an account into the 'balance tree'
    // '0' is reserved for off-chain withdraws
    uint64 lastBalanceTreeIndex = 1;

    // Hash of all on chain transactions ( will be forged in the next batch )
    // Forces 'operator' to add all on chain transactions
    uint256 miningOnChainTxsHash;

    // Hash of all on chain transactions ( will be forged in two batches )
    // Forces 'operator' to add all on chain transactions
    uint256 fillingOnChainTxsHash = 0;

    // Fees of all on-chain transactions which goes to the operator that will forge the batch
    uint256 totalMinningOnChainFee;
    // Fees of all on-chain transactions that will be on minninf the next batch
    uint256 totalFillingOnChainFee;

    // Fees recollected for every on-chain transaction
    uint constant FEE_ONCHAIN_TX = 0.1 ether;

    // maximum on-chain transactions
    uint MAX_ONCHAIN_TX;
    // maximum rollup transacction: either off-chain or on-chain transactions
    uint MAX_TX;
    // current on chain transactions
    uint currentOnChainTx = 0;

    // Flag to determine if the mechanism to forge batch has been initialized
    bool initialized = false;

    // Input snark definition
    uint256 constant oldStateRootInput = 0;
    uint256 constant newStateRootInput = 1;
    uint256 constant newExitRootInput = 2;
    uint256 constant onChainHashInput = 3;
    uint256 constant offChainHashInput = 4;
    uint256 constant feePlanCoinsInput = 5;
    uint256 constant feePlanFeesInput = 6;
    uint256 constant nTxperTokenInput = 7;

    /**
     * @dev Event called when any on-chain transaction has benn done
     * contains all data required for the operator to update balance tree
     */
    event OnChainTx(uint batchNumber, bytes32 txData, uint128 loadAmount,
        address ethAddress, uint256 Ax, uint256 Ay);

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
        uint _maxOnChainTx) RollupHelpers(_poseidon) public {
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
        uint tokenId = tokens.push(tokenAddress) - 1;
        tokenList[tokenId] = tokenAddress;
        // increase fees for next token deposit
        feeAddToken = feeAddToken * 2;
        emit AddToken(tokenAddress, tokenId);
    }

    /**
     * @dev update on-chain hash
     * @param txData transaction rollup data
     * @param loadAmount amount to add to balance tree
     * @param ethAddress ethereum Address
     * @param babyPubKey public key babyjubjub represented as point (Ax, Ay)
     * @param onChainFee fee payed for the on-chain transaction sender
     */
    function _updateOnChainHash(
        uint256 txData,
        uint128 loadAmount,
        address ethAddress,
        uint256[2] memory babyPubKey,
        uint256 onChainFee
    ) private {
        Entry memory onChainHashData = buildOnChainData(fillingOnChainTxsHash, txData, loadAmount,
            ethAddress, babyPubKey[0], babyPubKey[1]);
        fillingOnChainTxsHash = hashEntry(onChainHashData);
        // Update total on-chain fees
        totalFillingOnChainFee += onChainFee;
        // Update number of on-chain transactions
        currentOnChainTx++;
        // trigger on chain tx event event
        emit OnChainTx(getStateDepth(), bytes32(txData), loadAmount, ethAddress, babyPubKey[0], babyPubKey[1]);
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
        // Get token deposit on rollup smart contract
        require(depositToken(tokenId, loadAmount), 'Fail deposit ERC20 transaction');
        // build txData for deposit
        bytes32 txDataDeposit = buildTxData(lastBalanceTreeIndex, 0, 0, tokenId, 0, 0, 0, true, true);
        _updateOnChainHash(uint256(txDataDeposit), loadAmount, ethAddress, babyPubKey, msg.value);
        // Insert tree information
        treeInfo[lastBalanceTreeIndex].tokenId = tokenId;
        treeInfo[lastBalanceTreeIndex].ethAddress = ethAddress;
        treeInfo[lastBalanceTreeIndex].babyPubKey = babyPubKey;
        // Increment index leaf balance tree
        lastBalanceTreeIndex++;
    }

    /**
     * @dev Deposit on an existing balance tree leaf
     * @param idBalanceTree account identifier on the balance tree which will receive the deposit
     * @param loadAmount amount to be added into leaf specified by idBalanceTree
     * @param tokenId token identifier
    */
    function depositOnTop(
        uint64 idBalanceTree,
        uint128 loadAmount,
        uint32 tokenId
    ) public payable{
        require(msg.value >= FEE_ONCHAIN_TX, 'Amount deposited less than fee required');
        require(currentOnChainTx < MAX_ONCHAIN_TX, 'Reached maximum number of on-chain transactions');
        require(loadAmount < MAX_AMOUNT_DEPOSIT, 'deposit amount larger than the maximum allowed');
        require(idBalanceTree < lastBalanceTreeIndex, 'identifier leaf does not exist on balance tree');
        require(treeInfo[idBalanceTree].tokenId == tokenId, 'token type does not match');
        // Get token deposit on rollup smart contract
        require(depositToken(tokenId, loadAmount), 'Fail deposit ERC20 transaction');
        // build txData for deposit on top
        bytes32 txDataDepositOnTop = buildTxData(idBalanceTree, 0, 0, tokenId, 0, 0, 0, true, false);
        _updateOnChainHash(uint256(txDataDepositOnTop), loadAmount, treeInfo[idBalanceTree].ethAddress,
        treeInfo[idBalanceTree].babyPubKey, msg.value);
    }

    /**
     * @dev Transfer between two accounts already defined in balance tree
     * @param fromId account sender
     * @param toId account receiver
     * @param amount amount to send
     * @param tokenId token identifier
    */
    function transfer(
        uint64 fromId,
        uint64 toId,
        uint16 amount,
        uint32 tokenId
    ) public payable{
        require(msg.value >= FEE_ONCHAIN_TX, 'Amount deposited less than fee required');
        require(currentOnChainTx < MAX_ONCHAIN_TX, 'Reached maximum number of on-chain transactions');
        require(amount < MAX_AMOUNT_DEPOSIT, 'deposit amount larger than the maximum allowed');
        require(fromId < lastBalanceTreeIndex, 'From account does not exist on balance tree');
        require(toId < lastBalanceTreeIndex, 'From account does not exist on balance tree');
        require(treeInfo[fromId].tokenId == tokenId, 'token type does not match');
        require(treeInfo[toId].tokenId == tokenId, 'token type does not match');
        require(msg.sender == treeInfo[fromId].ethAddress, 'Sender does not match identifier balance tree');
        // build txData for transfer
        bytes32 txDataTransfer = buildTxData(fromId, toId, amount, tokenId, 0, 0, 0, true, false);
        _updateOnChainHash(uint256(txDataTransfer), 0, msg.sender, treeInfo[fromId].babyPubKey, msg.value);
    }


    /**
     * @dev add new leaf to balance tree and initializes it with a load amount
     * then transfer some amount to an account already defined in the balance tree
     * @param loadAmount initial balance on balance tree
     * @param tokenId token identifier
     * @param ethAddress allowed address to control new balance tree leaf
     * @param babyPubKey public key babyjubjub of the sender represented as point (Ax, Ay)
     * @param toId account receiver
     * @param amount amount to transfer
    */
    function depositAndTransfer(
        uint128 loadAmount,
        uint32 tokenId,
        address ethAddress,
        uint256[2] memory babyPubKey,
        uint64 toId,
        uint16 amount
    ) public payable{
        require(msg.value >= FEE_ONCHAIN_TX, 'Amount deposited less than fee required');
        require(currentOnChainTx < MAX_ONCHAIN_TX, 'Reached maximum number of on-chain transactions');
        require(loadAmount > 0, 'Deposit amount must be greater than 0');
        require(loadAmount < MAX_AMOUNT_DEPOSIT, 'deposit amount larger than the maximum allowed');
        require(ethAddress != address(0), 'Must specify withdraw address');
        require(tokenList[tokenId] != address(0), 'token has not been registered');
        require(toId < lastBalanceTreeIndex, 'From account does not exist on balance tree');
        require(treeInfo[toId].tokenId == tokenId, 'token type does not match');

        treeInfo[lastBalanceTreeIndex].tokenId = tokenId;
        treeInfo[lastBalanceTreeIndex].ethAddress = ethAddress;
        treeInfo[lastBalanceTreeIndex].babyPubKey = babyPubKey;
        // Get token deposit on rollup smart contract
        require(depositToken(tokenId, loadAmount), 'Fail deposit ERC20 transaction');
        // build txData for DepositAndtransfer
        bytes32 txDataDepositAndTransfer = buildTxData(lastBalanceTreeIndex, toId, amount, tokenId, 0, 0, 0, true, true);
        _updateOnChainHash(uint256(txDataDepositAndTransfer), loadAmount, ethAddress, babyPubKey, msg.value);
        lastBalanceTreeIndex++;
    }


    /**
     * @dev Withdraw balance from identifier balance tree
     * user has to prove ownership of ethAddress of idBalanceTree
     * @param idBalanceTree account identifier on the balance tree which will do the withdraw
     * @param amount total amount coded as float 16 bits
     */
    function forceWithdraw(
        uint64 idBalanceTree,
        uint16 amount
    ) public payable{
        require(msg.value >= FEE_ONCHAIN_TX, 'Amount deposited less than fee required');
        require(currentOnChainTx < MAX_ONCHAIN_TX, 'Reached maximum number of on-chain transactions');
        require(msg.sender == treeInfo[idBalanceTree].ethAddress, 'Sender does not match identifier balance tree');
        require(idBalanceTree < lastBalanceTreeIndex, 'identifier leaf does not exist on balance tree');
        // build txData for withdraw
        bytes32 txDataWithdraw = buildTxData(idBalanceTree, 0, amount, treeInfo[idBalanceTree].tokenId,
            0, 0, 0, true, false);
        _updateOnChainHash(uint256(txDataWithdraw), 0, msg.sender, treeInfo[idBalanceTree].babyPubKey, msg.value);
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
     * @param siblings siblings to demonstrate merkle tree proof
     */
    function withdraw(
        uint64 idBalanceTree,
        uint16 amount,
        uint numExitRoot,
        uint256[] memory siblings
    ) public {
        // Build 'key' and 'value' for exit tree
        uint256 keyExitTree = idBalanceTree;
        Entry memory exitEntry = buildTreeState(amount, treeInfo[idBalanceTree].tokenId, treeInfo[idBalanceTree].babyPubKey[0],
        treeInfo[idBalanceTree].babyPubKey[1], msg.sender, 0);
        uint256 valueExitTree = hashEntry(exitEntry);
        // Get exit root given its index depth
        uint256 exitRoot = uint256(getExitRoot(numExitRoot));
        // Check exit tree nullifier
        uint256[] memory inputs = new uint256[](2);
        inputs[0] = exitRoot;
        inputs[1] = valueExitTree;
        uint256 nullifier = hashGeneric(inputs);
        require(exitNullifier[nullifier] == false, 'withdraw has been already done');
        // Check sparse merkle tree proof
        bool result = smtVerifier(exitRoot, siblings, keyExitTree, valueExitTree, 0, 0, false, false, 24);
        require(result == true, 'invalid proof');
        // Withdraw token from rollup smart contract to ethereum address
        require(withdrawToken(treeInfo[idBalanceTree].tokenId, msg.sender, amount), 'Fail ERC20 withdraw');
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
    */
    function forgeBatch(
        address payable beneficiaryAddress,
        uint[2] calldata proofA,
        uint[2][2] calldata proofB,
        uint[2] calldata proofC,
        uint[8] calldata input
    ) external isForgeBatch {
        // Verify old state roots
        require(bytes32(input[oldStateRootInput]) == stateRoots[getStateDepth()],
            'old state root does not match current state root');

        // Verify on-chain hash
        require(input[onChainHashInput] == miningOnChainTxsHash,
            'on-chain hash does not match current filling on-chain hash');

        // Verify zk-snark circuit
        require(verifier.verifyProof(proofA, proofB, proofC, input) == true,
            'zk-snark proof is not valid');

        // Calculate fees and pay them
        bytes32[2] memory feePlan = [bytes32(input[feePlanCoinsInput]), bytes32(input[feePlanFeesInput])];
        bytes32 nTxPerToken = bytes32(input[nTxperTokenInput]);

        for (uint i = 0; i < 16; i++) {
            (uint tokenId, uint totalTokenFee) = calcTokenTotalFee(bytes32(feePlan[0]), bytes32(feePlan[1]),
            bytes32(nTxPerToken), i);

            if(totalTokenFee != 0) {
                require(withdrawToken(uint32(tokenId), beneficiaryAddress, totalTokenFee),
                    'Fail ERC20 withdraw');
            }
        }

        // Pay onChain transactions fees
        uint payOnChainFees = totalMinningOnChainFee;
        beneficiaryAddress.transfer(payOnChainFees);

        // Update state roots
        stateRoots.push(bytes32(input[1]));

        // Update exit roots
        exitRoots.push(bytes32(input[2]));

        // Clean fillingOnChainTxsHash an its fees
        miningOnChainTxsHash = fillingOnChainTxsHash;
        fillingOnChainTxsHash = 0;
        totalMinningOnChainFee = totalFillingOnChainFee;
        totalFillingOnChainFee = 0;

        // Update number of on-chain transactions
        currentOnChainTx = 0;

        // event with all compressed transactions given its batch number
        emit ForgeBatch(getStateDepth() - 1, block.number);
    }

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
        return ERC20(tokenList[tokenId]).transferFrom(msg.sender, address(this), amount);
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
        return ERC20(tokenList[tokenId]).transfer(receiver, amount);
    }
}