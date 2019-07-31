
pragma solidity ^0.5.0;

import '../../node_modules/openzeppelin-solidity/contracts/ownership/Ownable.sol';
import './../lib/RollupHelpers.sol';
import './../StakeManager.sol';


/**
 * @dev This smart contract aims to simulate all functionalities of Rollup
 * A shortcut has been done in order to forge blocks
 */

contract ERC20 {
  function transfer(address recipient, uint256 amount) external returns (bool);
  function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
}

contract RollupTest is Ownable, RollupHelpers {

  // External contracts used
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
  uint feeAddToken = 0.01 ether;

  // Set the leaf position for an account into the 'balance tree'
  uint24 lastBalanceTreeIndex;

  // Hash of all on chain transmissions ( will be forged in the next batch )
  // Forces 'operator' to add all on chain transmission
  uint256 public miningOnChainTxsHash;   

  // Hash of all on chain transmissions ( will be forged in two batches )
  // Forces 'operator' to add all on chain transmissions
  uint256 public fillingOnChainTxsHash;
  
  // Fees of all on-chain transactions for the operator that forge that batch
  uint256 totalMinningOnChainFee;
  // Fees of all on-chain transactions for the operator
  uint256 totalFillingOnChainFee;

  // Fees recollected for every on-chain transaction
  uint constant FEE_ONCHAIN_TX = 0.1 ether;

  // maximum on-chain transactions
  uint constant MAX_ONCHAIN_TX = 100;

  event Deposit(uint idBalanceTree, uint depositAmount, uint tokenId, uint Ax, uint Ay,
    address withdrawAddress );
  event ForgeBatch(uint batchNumber, bytes offChainTx);
  event ForceWithdraw(uint idBalanceTree, uint amount, uint tokenId, uint Ax, uint Ay,
    address withdrawAddress, uint nonce);
  event DepositOnTop(uint idBalanceTree, uint amountDeposit);
  event AddToken(address tokenAddress, uint tokenId);

  // Flag to determine if the staker manager has been initialized
  bool initialized = false;

  
  modifier isStakerLoad {
    require(initialized == true);
    _;
  }

  constructor(address _poseidon) RollupHelpers(_poseidon) public {}

  function loadStakeManager(address stakeManagerAddress) public onlyOwner{
    stakeManager = StakeManager(stakeManagerAddress);
    initialized = true;
  }

  function addToken(address tokenAddress) public payable {
    // Allow MAX_TOKENS different types of tokens
    require(tokens.length <= MAX_TOKENS, 'token list is full');
    require(msg.value >= feeAddToken);
    uint tokenId = tokens.push(tokenAddress) - 1;
    tokenList[tokenId] = tokenAddress;
    // increase fees for next token deposit
    feeAddToken = feeAddToken * 2; 
    emit AddToken(tokenAddress, tokenId);
  }

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

    // Get token deposit on rollup smart contract
    require(depositToken(tokenId, depositAmount), 'Fail deposit ERC20 transaction');

    // Update total on-chain fees
    totalFillingOnChainFee += msg.value;

    emit Deposit(lastBalanceTreeIndex, depositAmount, tokenId, babyPubKey[0], babyPubKey[1],
      withdrawAddress);
    lastBalanceTreeIndex++;
  }

  function forgeBatch(
    uint256 oldStateRoot,
    uint256 newStateRoot,
    uint256 newExitRoot,
    uint256 onChainHash,
    uint256[2] memory feePlan,
    bytes memory compressedTxs,
    uint256 offChainHash,
    uint256 nTxPerToken,
    address beneficiary
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

    // If there is no roots commited it means that it will be the genesis block
    if (stateRoots.length == 0) {
      require(oldStateRoot == 0, 'old state root does not match current state root');
    } else {
      // Verify old state roots
      require(bytes32(oldStateRoot) == stateRoots[stateRoots.length - 1], 'old state root does not match current state root');
    }
    
    // Verify on-chain hash
    require(onChainHash == miningOnChainTxsHash, 'on-chain hash does not match current filling on-chain hash');

    // Verify fee plan is commited on the zk-snark input
    // require(uint(feePlan[0]) == input[5], 'fee plan 0 does not match its public input');
    // require(uint(feePlan[1]) == input[6], 'fee plan 1 does not match its public input');

    // Verify number of transaction per token is commited on the zk-snark input
    // require(uint(nTxPerToken) == input[7], 'Number of transaction per token does not match its public input');

    // Verify all off-chain are commited on the public zk-snark input
    uint256 offChainTxHash = hashOffChainTx(compressedTxs);
    require(offChainTxHash == offChainHash, 'off chain tx does not match its public hash');

    // Verify zk-snark circuit
    // require(verifier.verifyProof(proofA, proofB, proofC, input) == true, 'zk-snark proof is not valid');

    // Call Stake SmartContract to return de beneficiary address
    // address beneficiary = stakeManager.batchForgedStaker(previousHash, msg.sender);

    // Calculate fees and pay them
    for(uint i = 0; i < tokens.length; i++) {
      uint totalTokenFee = calcTokenTotalFee(bytes32(feePlan[1]), bytes32(nTxPerToken), i);
      if(totalTokenFee != 0) {
        require(withdrawToken(i, beneficiary, totalTokenFee), 'Fail ERC20 withdraw');
      }
    }

    // Pay onChain transactions fees
    uint payOnChainFees = totalMinningOnChainFee;
    address payable beneficiaryPayable = address(uint160(beneficiary));
    beneficiaryPayable.transfer(payOnChainFees);

    // Update state roots
    stateRoots.push(bytes32(newStateRoot));

    // Update exit roots
    exitRoots.push(bytes32(newExitRoot));

    // Clean fillingOnChainTxsHash an its fees
    miningOnChainTxsHash = fillingOnChainTxsHash;
    fillingOnChainTxsHash = 0;
    totalMinningOnChainFee = totalFillingOnChainFee;
    totalFillingOnChainFee = 0;

    // event with all compressed transactions given its batch number
    emit ForgeBatch(getStateDepth() - 1, compressedTxs);
  }

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

    // Update total on-chain fees
    totalFillingOnChainFee += msg.value;

    // Withdraw token from rollup smart contract to withdraw address
    require(withdrawToken(tokenId, msg.sender, amount), 'Fail ERC20 withdraw');
    
    // event force withdraw
    emit ForceWithdraw(idBalanceTree, amount, tokenId, babyPubKey[0], babyPubKey[1], msg.sender, nonce);
  }

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

    // Update total on-chain fees
    totalFillingOnChainFee += msg.value;

    // Get token deposit on rollup smart contract
    // require(ERC20(tokenList[tokenId]).approve(address(this), amountDeposit), 'Fail approve ERC20 transaction');
    require(depositToken(tokenId, amountDeposit), 'Fail deposit ERC20 transaction');

    // event deposit on top
    emit DepositOnTop(idBalanceTree, amountDeposit);
  }

  function getStateRoot(uint numBatch) public view returns (bytes32) {
    require(numBatch <= stateRoots.length - 1, 'Batch number does not exist');
    return stateRoots[numBatch];
  }

  function getStateDepth() public view returns (uint) {
    return stateRoots.length;
  }

  function getExitRoot(uint numBatch) public view returns (bytes32) {
    require(numBatch <= exitRoots.length - 1, 'Batch number does not exist');
    return exitRoots[numBatch];
  }

  function getTokenAddress(uint tokenId) public view returns (address) {
    require(tokens.length > 0, 'There are no tokens listed');
    require(tokenId <= (tokens.length - 1), 'Token id does not exist');
    return tokenList[tokenId];
  }

  function depositToken(uint16 tokenId, uint16 amount) public returns(bool){
    return ERC20(tokenList[tokenId]).transferFrom(msg.sender, address(this), amount);
  }

  function withdrawToken(uint tokenId, address receiver, uint amount) public returns(bool){
    ERC20(tokenList[tokenId]).transfer(receiver, amount);
  }

}