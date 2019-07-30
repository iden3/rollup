
pragma solidity ^0.5.0;

import '../node_modules/openzeppelin-solidity/contracts/ownership/Ownable.sol';
import './lib/RollupHelpers.sol';
import './StakeManager.sol';

/**
 * @dev Define interface ERC20 contract
 */
contract ERC20 {
  function transfer(address recipient, uint256 amount) external returns (bool);
  function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
}

/**
 * @dev Define interface Verifier contract
 */
contract Verifier {
  function verifyProof( uint[2] memory a, uint[2][2] memory b,
    uint[2] memory c, uint[8] memory input) view public returns (bool r);
}

contract Rollup is Ownable, RollupHelpers {

  // External contracts used
  Verifier verifier;
  StakeManager stakeManager;

  // Each batch forged will have the root state of the 'balance tree' 
  bytes32[] stateRoots;

  // Each batch forged will have a correlated 'exit tree' represented by the exit root
  bytes32[] exitRoots;
  mapping(uint256 => bool) exitNullifier;

  // List of valid ERC20 tokens that can be deposit in 'balance tree'
  address[] tokens;
  mapping(uint => address) tokenList;
  uint constant MAX_TOKENS = 0xFFFF;

  // Set the leaf position for an account into the 'balance tree'
  uint24 lastBalanceTreeIndex;

  // Hash of all on chain transmissions ( will be forged in the next batch )
  // Forces 'operator' to add all on chain transmission
  uint256 miningOnChainTxsHash;   

  // Hash of all on chain transmissions ( will be forged in two batches )
  // Forces 'operator' to add all on chain transmissions
  uint256 fillingOnChainTxsHash;
  uint256 totalOnCainTx;
  uint256 totalOnChainFee;

  // Fee for every on-chain transaction
  uint constant FEE_ONCHAIN_TX = 0.1 ether;

  // maximum on-chain transactions
  uint constant MAX_ONCHAIN_TX = 100;

  /**
   * @dev Event called when a deposit has been made
   * contains all data required for the operator to:
   * add leaf to balance tree
   * off-chain transaction
   */
  event Deposit(uint idBalanceTree, uint depositAmount, uint tokenId, uint Ax, uint Ay,
    address withdrawAddress );

  /**
   * @dev Event called when a batch is forged
   * Contains all off-chain transaction compressed
   */
  event ForgeBatch(uint batchNumber, bytes offChainTx);

  /**
   * @dev Event called when a user makes a force withdraw
   * contains all data required for the operator to add the transaction 
   */
  event ForceWithdraw(uint idBalanceTree, uint amount, uint tokenId, uint Ax, uint Ay,
    address withdrawAddress, uint nonce);

  /**
   * @dev Event called when a deposit on top is done
   * Contains all data required by the operator to do:
   * deposit on balance tree leaf
   */
  event DepositOnTop(uint idBalanceTree, uint amountDeposit);

  /**
   * @dev Event called when a token is added to token list
   * Contains token address and its index inside rollup token list
   */
  event AddToken(address tokenAddress, uint tokenId);

  // Flag to determine if the staker manager has been initialized
  bool initialized = false;

  /**
   * @dev modifier to check if staker manager has been initialized
   */
  modifier isStakerLoad {
    require(initialized == true);
    _;
  }

  /**
   * @dev Rollup constructor
   * Loads 'RollupHelpers' constructor with poseidon
   * Loads verifier zk-snark proof
   * Deploy 'StakeManager' with 'Rollup' smart contract address
   * Load 'StakeManager' smart contract
   * @param _verifier verifier zk-snark proof address
   * @param _poseidon poseidon hash function address
   */
  constructor(address _verifier, address _poseidon) RollupHelpers(_poseidon) public {
    verifier = Verifier(_verifier);
  }

  /**
   * @dev Load stake manager smart contract
   * @param stakeManagerAddress stake manager contract address
   */
  function loadStakeManager(address stakeManagerAddress) public onlyOwner{
    stakeManager = StakeManager(stakeManagerAddress);
    initialized = true;
  }


  /**
   * @dev Inclusion of a new token that will be able to deposit on 'balance tree'
   * @param tokenAddress smart contract token address
   */
  function addToken(address tokenAddress) public onlyOwner {
    // Allow MAX_TOKENS different types of tokens
    require(tokens.length <= MAX_TOKENS, 'token list is full');
    uint tokenId = tokens.push(tokenAddress) - 1;
    tokenList[tokenId] = tokenAddress;

    emit AddToken(tokenAddress, tokenId);
  }

  /**
   * @dev Deposit on-chain transaction to enter balance tree
   * @param depositAmount initial balance on balance tree 
   * @param tokenId token type identifier
   * @param babyPubKey public key babyjub represented as point (Ax, Ay)
   * @param withdrawAddress allowed address to perform withdraw on-chain transaction
   */
  function deposit( 
      uint16 depositAmount,
      uint16 tokenId,
      uint256[2] memory babyPubKey,
      address withdrawAddress
  ) payable public {
 
    require(msg.value >= FEE_ONCHAIN_TX, 'Amount deposited less than fee required');
    require(depositAmount > 0, 'Deposit amount must be greater than 0');
    require(withdrawAddress != address(0), 'Must specify withdraw address');
    require(tokenList[tokenId] != address(0) , 'token has not been registered');

    // Build entry deposit and get its hash
    Entry memory depositEntry = buildEntryDeposit(lastBalanceTreeIndex, depositAmount,
      tokenId, babyPubKey[0], babyPubKey[1], withdrawAddress, 0);
    uint256 hashDeposit = hashEntry(depositEntry);
    
    // Update 'fillingOnChainHash'
    uint256[] memory inputs = new uint256[](2);
    inputs[0] = fillingOnChainTxsHash;
    inputs[1] = hashDeposit;
    fillingOnChainTxsHash = hashGeneric(inputs);
    totalOnCainTx += 1;

    // Get token deposit on rollup smart contract
    require(depositToken(tokenId, depositAmount), 'Fail deposit ERC20 transaction');

    // Update total on-chain fees
    totalOnChainFee += msg.value;

    emit Deposit(lastBalanceTreeIndex, depositAmount, tokenId, babyPubKey[0], babyPubKey[1],
      withdrawAddress);
    lastBalanceTreeIndex++;
  }

  /**
   * @dev Checks proof given by the operator
   * forge the block if succesfull and pay fees to beneficiary address
   * @param previousHash operator must reveal previous hash that it was commited
   * @param proofA zk-snark input
   * @param proofB zk-snark input
   * @param proofC zk-snark input
   * @param input public zk-snark inputs
   * @param feePlan fee operator plan
   * @param nTxPerToken number of transmission per token in order to calculate total fees
   * @param compressedTxs data availability to maintain 'balance tree' 
   */
  function forgeBlock(
    bytes32 previousHash,
    uint[2] memory proofA, 
    uint[2][2] memory proofB, 
    uint[2] memory proofC,
    uint[8] memory input, 
    bytes32[2] memory feePlan, 
    bytes32 nTxPerToken,
    bytes memory compressedTxs
  ) public isStakerLoad{
    // Public parameters of the circuit
    // input[0] ==> old state root
    // input[1] ==> new state root
    // input[2] ==> new exit root
    // input[3] ==> on chain hash
    // input[4] ==> off chain hash
    // input[5] ==> fee plan[1]
    // input[6] ==> fee plan[2]
    // input[7] ==> nTxperToken

    // Verify old state roots
    require(bytes32(input[0]) == stateRoots[stateRoots.length - 1], 'old state root does not match current state root');
    
    // Verify on-chain hash
    require(bytes32(input[3]) == exitRoots[exitRoots.length - 1], 'on-chain hash does not match current filling on-chain hash');

    // Verify fee plan is commited on the zk-snark input
    require(uint(feePlan[0]) == input[5], 'fee plan 0 does not match its public input');
    require(uint(feePlan[1]) == input[6], 'fee plan 1 does not match its public input');

    // Verify number of transaction per token is commited on the zk-snark input
    require(uint(nTxPerToken) == input[7], 'Number of transaction per token does not match its public input');

    // Verify all off-chain are commited on the public zk-snark input
    uint256 offChainTxHash = hashOffChainTx(compressedTxs);
    require(offChainTxHash == input[4], 'off chain tx does not match its public hash');

    // Verify zk-snark circuit
    require(verifier.verifyProof(proofA, proofB, proofC, input) == true, 'zk-snark proof is not valid');

    // Call Stake SmartContract to return de beneficiary address
    address beneficiary = stakeManager.blockForgedStaker(previousHash, msg.sender);

    // Calculate fees and pay them
    for(uint i = 0; i < tokens.length; i++) {
      uint totalTokenFee = calcTokenTotalFee(feePlan[1], nTxPerToken, i);
      if(totalTokenFee != 0) {
        require(withdrawToken(i, beneficiary, totalTokenFee), 'Fail ERC20 withdraw');
      }
    }

    // Pay onChain transactions fees
    uint payOnChainFees = totalOnChainFee;
    address payable beneficiaryPayable = address(uint160(beneficiary));
    beneficiaryPayable.transfer(payOnChainFees);

    // Update state roots
    stateRoots.push(bytes32(input[1]));

    // Update exit roots
    exitRoots.push(bytes32(input[2]));

    // Clean fillingOnChainTxsHash
    miningOnChainTxsHash = fillingOnChainTxsHash;
    fillingOnChainTxsHash = 0;
    totalOnCainTx = 0;
    totalOnChainFee = 0;

    // event with all compressed transactions given its batch number
    emit ForgeBatch(getStateDepth() - 1, compressedTxs);
  }

  /**
   * @dev withdraw on-chain transaction to get balance from balance tree
   * Before this call an off-chain withdraw transaction must be done
   * Off-chain withdraw transaction will build a leaf on exit tree
   * each batch forged will publish its exit tree root
   * All leaves created on the exit are allowed to call on-chain transaction to finish the withdraw
   * @param idBalanceTree account identifier on the balance tree
   * @param amount amount to retrieve
   * @param tokenId token type 
   * @param numExitRoot exit root depth. Number of batch where the withdar transaction has been done 
   * @param siblings siblings to demonstrate merkle tree proof
   */
  function withdraw(
      uint24 idBalanceTree,
      uint16 amount,
      uint16 tokenId,
      uint numExitRoot,
      uint256[] memory siblings
  ) public {

    // Build 'key' and 'value' for exit tree
    uint256 keyExitTree = idBalanceTree;
    Entry memory exitEntry = buildEntryExitLeaf(idBalanceTree, amount, tokenId, msg.sender);
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
    bool result = smtVerifier( exitRoot, siblings, keyExitTree, valueExitTree, 0, 0, false, false, 24);
    require(result == true, 'invalid proof');
    
    // Withdraw token from rollup smart contract to withdraw address
    require(withdrawToken(tokenId, msg.sender, amount), 'Fail ERC20 withdraw');
    
    // Set nullifier
    exitNullifier[nullifier] = true;
  }

  /**
   * @dev Withdraw all balance from balance tree
   * this withdraw mechanism consist only in a single on-chain transaction
   * user has to prove current state of balance tree, otherwise forceWithdraw can not be done
   * @param idBalanceTree account identifier on the balance tree
   * @param amount total amount
   * @param tokenId token type
   * @param babyPubKey public key babyjub represented as point (Ax, Ay)
   * @param nonce current value on last state root
   * @param siblings siblings to demonstrate merkle tree proof
   */
  function forceFullWithdraw(
      uint24 idBalanceTree,
      uint16 amount,
      uint16 tokenId,
      uint32 nonce,
      uint256[2] memory babyPubKey,
      uint256[] memory siblings
  ) public payable{
    
    require(msg.value >= FEE_ONCHAIN_TX, 'Amount deposited less than fee required');

    // build 'key' and 'value' for balance tree
    uint256 keyBalanceTree = idBalanceTree;
    Entry memory balanceEntry = buildEntryBalanceTree(amount, tokenId, babyPubKey[0],
      babyPubKey[1], msg.sender, nonce);
    uint256 valueBalanceTree = hashEntry(balanceEntry);
    
    // get current state root
    uint256 lastStateRoot = uint256(stateRoots[stateRoots.length - 1]);
    
    // Check sparse merkle tree proof
    bool result = smtVerifier(lastStateRoot, siblings, keyBalanceTree, valueBalanceTree, 0, 0, false, false, 24);
    require(result == true, 'invalid proof');
    
    // Update 'fillingOnChainHash'
    uint256[] memory inputs = new uint256[](2);
    inputs[0] = fillingOnChainTxsHash;
    inputs[1] = valueBalanceTree;
    fillingOnChainTxsHash = hashGeneric(inputs);
    totalOnCainTx += 1;

    // Update total on-chain fees
    totalOnChainFee += msg.value;

    // Withdraw token from rollup smart contract to withdraw address
    require(withdrawToken(tokenId, msg.sender, amount), 'Fail ERC20 withdraw');
    
    // event force withdraw
    emit ForceWithdraw(idBalanceTree, amount, tokenId, babyPubKey[0], babyPubKey[1], msg.sender, nonce);
  }

  /**
   * @dev Deposit on an existing balance tree leaf
   * Sender must proof the existence of that leaf at any balance tree state
   * @param idBalanceTree account identifier on the balance tree
   * @param amount total amount
   * @param tokenId token type
   * @param withdrawAddress withdraw address
   * @param babyPubKey public key babyjub represented as point (Ax, Ay)
   * @param nonce current value on last state root
   * @param siblings siblings to demonstrate merkle tree proof
   * @param numStateRoot siblings to demonstrate merkle tree proof
   * @param amountDeposit amount to deposit on balance tree leaf
   */
  function depositOnTop(
      uint24 idBalanceTree,
      uint16 amount,
      uint16 tokenId,
      address withdrawAddress,
      uint32 nonce,
      uint256[2] memory babyPubKey,
      uint256[] memory siblings,
      uint256 numStateRoot,
      uint16 amountDeposit
  ) public payable{

    require(msg.value >= FEE_ONCHAIN_TX, 'Amount deposited less than fee required');

    // build 'key' and 'value' for balance tree
    uint256 keyBalanceTree = uint256(idBalanceTree);
    Entry memory balanceEntry = buildEntryBalanceTree(amount, tokenId, babyPubKey[0],
      babyPubKey[1], withdrawAddress, nonce);
    uint256 valueBalanceTree = hashEntry(balanceEntry);

    // get state root given its depth
    uint256 stateRoot = uint256(stateRoots[numStateRoot]);

    // Check sparse merkle tree proof
    bool result = smtVerifier(stateRoot, siblings, keyBalanceTree, valueBalanceTree, 0, 0, false, false, 24);
    require(result == true, 'invalid proof');
    
    // Update 'fillingOnChainHash'
    uint256[] memory inputs = new uint256[](2);
    inputs[0] = fillingOnChainTxsHash;
    inputs[1] = valueBalanceTree;
    fillingOnChainTxsHash = hashGeneric(inputs);
    totalOnCainTx += 1;

    // Update total on-chain fees
    totalOnChainFee += msg.value;

    // Get token deposit on rollup smart contract
    // require(ERC20(tokenList[tokenId]).approve(address(this), amountDeposit), 'Fail approve ERC20 transaction');
    require(depositToken(tokenId, amountDeposit), 'Fail deposit ERC20 transaction');

    // event deposit on top
    emit DepositOnTop(idBalanceTree, amountDeposit);
  }

  //////////////
  // Viewers
  /////////////

  /**
   * @dev Retrieve state root given its batch depth
   * @return root
   */
  function getStateRoot(uint id) public view returns (bytes32) {
    return stateRoots[id];
  }

  /**
   * @dev Retrieve total number of batches forged
   * @return Total number of batches forged
   */
  function getStateDepth() public view returns (uint) {
    return stateRoots.length;
  }

  /**
   * @dev Retrieve exit root given its batch depth
   * @return exit root
   */
  function getExitRoot(uint id) public view returns (bytes32) {
    return exitRoots[id];
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

  function getTest() public view returns (uint256) {
    return fillingOnChainTxsHash;
  }

  ///////////
  // helper ERC20 functions
  ///////////

  /**
   * @dev deposit token to rollup smart contract
   * Previously, it requires an approve erc20 transaction to allow this contract
   * make the transaction for the msg.sender
   * @param tokenId token id
   * @param amount quantity of token to send
   */
  function depositToken(uint16 tokenId, uint16 amount) private returns(bool){
    return ERC20(tokenList[tokenId]).transferFrom(msg.sender, address(this), amount);
  }

  /**
   * @dev withdraw token from rollup smart contract
   * Tokens on rollup smart contract are withdrawn
   */
  function withdrawToken(uint tokenId, address receiver, uint amount) private returns(bool){
    ERC20(tokenList[tokenId]).transfer(receiver, amount);
  }


  // /**
  //  * @dev global variales for batch commited
  //  * Function: Commit a batch
  //  */
  // // Minim collateral required to commit for a batch
  // uint constant MIN_COMMIT_COLLATERAL = 1 ether;
  // // Blocks while the operator can forge
  // uint constant MAX_COMMIT_BLOCKS = 150;
  // // Operator that is commited to forge the batch
  // address commitedOperator;     
  // // Balance staked for operators at the time to commit a batch
  // uint balanceCommited;
  // // Block where the commit is not valid any more
  // uint batchBlockExpires;
  // // Root commited
  // bytes32 rootCommited;

  // /**
  //  * @dev check if the last root commited have not been forged
  //  * by checking the batches that the operator is able to forge
  //  */
  // function resetCommitState() public {
  //   require( block.number > batchBlockExpires );
  //   require( commitedOperator != address(0) );
  //   // burn balance staked by the operator
  //   address(0).transfer(balanceCommited);
  //   // reset commit variables
  //   balanceCommited = 0;
  //   commitedOperator = address(0);
  // }

  // /**
  //  * @dev operator commits the new batch along with a deposit
  //  * operator has a certain amount of blocks to validate the batch commited
  //  * fees and deposit are paied to operator if batch is finally added succesfully
  //  * otherwise, deposit is burned and new batch commit would be available again 
  //  * @param newRoot of 'balance tree' commited
  //  */
  // function commitToBatch( bytes32 newRoot ) public payable {
  //   // Ensure there is no current batch commited
  //   require( commitedOperator == address(0) );
  //   require( block.number > batchBlockExpires );
  //   // Ensure msg.sender has enough balance to commit a new root
  //   require( msg.value >= MIN_COMMIT_COLLATERAL );
  //   // Stake balance
  //   balanceCommited = msg.value; 
  //   // Set last block to forge the root
  //   batchBlockExpires = block.number + MAX_COMMIT_BLOCKS;
  //   // Save operator that commited the root
  //   commitedOperator = msg.sender;
  //   // Save the root
  //   rootCommited = newRoot;
 // }
}