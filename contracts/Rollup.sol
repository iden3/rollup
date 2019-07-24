
pragma solidity ^0.5.0;

import '../node_modules/openzeppelin-solidity/contracts/ownership/Ownable.sol';
import './lib/RollupHelpers.sol';
import './StakeManager.sol';

// /**
//  * @dev Define interface stakeManager contract
//  */
// contract StakeManager {
//   function blockForgedStaker(uint128 entropy, address operator) public returns(address);
// }

/**
 * @dev Define interface Verifier contract
 */
contract Verifier {
  function verifyProof( uint[2] memory a, uint[2][2] memory b,
    uint[2] memory c, uint[6] memory input) view public returns (bool r);
}

contract Rollup is Ownable, RollupHelpers {

  // External contracts used
  Verifier verifier;
  StakeManager stakeManager; 

  // Each batch forged will have the root state of the 'balance tree' 
  bytes32[] stateRoots;
  // Each batch forged will have a correlated 'exit tree' represented by the exit root
  bytes32[] exitRoots;
  // List of valid ERC20 tokens that can be deposit in 'balance tree'
  address[] tokens;
  mapping(address => bool) tokenList;
  // Set the leaf position for an account into the 'balance tree'
  uint24 lastBalanceTreeIndex;

  // Hash of all on chain transmissions ( will be forged in the next batch )
  // Forces 'operator' to add all on chain transmission
  uint256 miningOnChainTxsHash;   

  // Hash of all on chain transmissions ( will be forged in two batches )
  // Forces 'operator' to add all on chain transmissions
  uint256 fillingOnChainTxsHash;

  /**
   * @dev Event called when a deposit has been made
   */
  event Deposit(uint idBalanceTree, uint depositAmount, uint token, uint Ax, uint Ay,
      address withdrawAddress, uint sendTo, uint sendAmount);

  /**
   * @dev Event called when a batch is forged
   * Contains all off-chain transaction compressed
   */
  event ForgeBatch(uint batchNumber, bytes offChainTx);

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
    address _stakeManager = address( new StakeManager( address(this), block.number ));
    stakeManager = StakeManager(_stakeManager);
  }

  /**
   * @dev Inclusion of a new token that will be able to deposit on 'balance tree'
   * @param newToken smart contract token address
   */
  function addToken(address newToken) public onlyOwner {
    // Allow 16 different types of tokens
    require(tokens.length < 0x0F, 'token list is full');
    tokens.push(newToken);
  }

  /**
   * @dev Deposit on-chain transaction to enter balance tree
   * It allows to deposit and instantly make a off-chain transaction given 'sendTo' and 'sendAmount'
   * @param depositAmount initial balance on balance tree 
   * @param token token type identifier
   * @param babyPubKey public key babyjub represented as point (Ax, Ay)
   * @param withdrawAddress allowed address to perform withdraw on-chain transaction
   * @param sendTo id balance tree receiver (off-chain transaction parameter)
   * @param sendAmount amount to send (off-chain transaction parameter)
   */
  function deposit( 
      uint16 depositAmount,
      uint32 token,
      uint256[2] memory babyPubKey,
      address withdrawAddress,
      uint24 sendTo,
      uint16 sendAmount
  ) payable public {

    require(depositAmount > 0, 'Deposit amount must be greater than 0');
    require(sendTo <= lastBalanceTreeIndex, 'Sender must exist on balance tree');
    require(withdrawAddress != address(0), 'Must specify withdraw address');
    require(token <= tokens.length , 'token has not been registered');

    Entry memory depositEntry = buildEntryDeposit(lastBalanceTreeIndex, depositAmount,
      token, babyPubKey[0], babyPubKey[1], withdrawAddress, sendTo, sendAmount, 0);

    uint256 hashDeposit = hashEntry(depositEntry);

    uint256[] memory inputs = new uint256[](2);
    inputs[0] = fillingOnChainTxsHash;
    inputs[1] = hashDeposit;
    fillingOnChainTxsHash = hashGeneric(inputs);
    emit Deposit(lastBalanceTreeIndex, depositAmount, token, babyPubKey[0], babyPubKey[1],
      withdrawAddress, sendTo, sendAmount);
    lastBalanceTreeIndex++;
  }

  /**
   * @dev Checks proof given by the operator
   * forge the block if succesfull and pay fees to beneficiary address
   * @param proofA zk-snark input
   * @param proofB zk-snark input
   * @param proofC zk-snark input
   * @param input public zk-snark inputs
   * @param feePlan fee operator plan
   * @param nTxPerCoin number of transmission per coin in order to calculate total fees
   * @param compressedTxs data availability to maintain 'balance tree' 
   */
  function forgeBlock( uint[2] memory proofA, uint[2][2] memory proofB, uint[2] memory proofC,
    uint[6] memory input, bytes32[2] memory feePlan, uint16[16] memory nTxPerCoin,
    bytes memory compressedTxs) public {
    // Public parameters of the circuit
    // input[0] ==> old state root
    // input[1] ==> new state root
    // input[2] ==> new exit root
    // input[3] ==> on chain hash
    // input[4] ==> off chain hash
    // input[5] ==> fee plan hash

    // Verify old state roots
    require(bytes32(input[0]) == stateRoots[stateRoots.length - 1], 'old state root does not match current state root');
    // Verify on-chain hash
    require(bytes32(input[3]) == exitRoots[exitRoots.length - 1], 'on-chain hash does not match current filling on-chain hash');

    // Verify fee plan is commited on the zk-snark input
    Entry memory entryFeePlan = buildEntryFeePlan(feePlan);
    uint256 feePlanHash = hashEntry(entryFeePlan);
    require(feePlanHash == input[5], 'fee plan does not match its public hash');

    // Verify all off-chain are commited on the public zk-snark input
    uint256 offChainTxHash = hashOffChainTx(compressedTxs);
    require(offChainTxHash == input[4], 'off chain tx does not match its public hash');

    // Verify zk-snark circuit
    require(verifier.verifyProof(proofA, proofB, proofC, input) == true, 'zk-snark proof is not valid');

    // Call Stake SmartContract to return de benefiacy address
    bytes16 hashBlock = bytes16(blockhash(block.number));
    address beneficiary = stakeManager.blockForgedStaker(uint128(hashBlock), msg.sender);

    //TODO: calculate fee and pay fee to beneficiary address
    // Calculate fees
    for(uint i = 0; i < 0x0F; i++) {
      
    }

    // Update state roots
    stateRoots.push(bytes32(input[1]));
    // Update exit roots
    exitRoots.push(bytes32(input[2]));

    miningOnChainTxsHash = fillingOnChainTxsHash;
    fillingOnChainTxsHash = 0;

    emit ForgeBatch(getStateDepth() - 1, compressedTxs);
  }

  // TODO:
  // 
  function withdraw(
      uint idx,
      uint amount,
      uint coin,
      bytes32 exitRoot,
      bytes memory merkleProof // proof that leaf is on exit merkle tree, Amount & coin matches Idx & msg.sender
  ) public {

  }

  // TODO:
  // include fee to all on-chain transactions 
  function forceFullWithdrawFee(
      uint idx,
      bytes memory proofIdxHasWithdrawAddress,
      uint blockState
  ) public {
    // retrieve root from block, ensure root is the root on the proof 
    // get leaf info
    // fill leaf with msg.sender
    // check proofIdxHasWithdrawAddress
    // Event with Data
    // Updte hash --> fillingOnChainTxsHash = hash(fillingOnChainTxsHash, thisTx);
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
