
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
    uint[2] memory c, uint[8] memory input) view public returns (bool r);
}

contract Rollup is Ownable, RollupHelpers {

  // External contracts used
  Verifier verifier;
  StakeManager stakeManager; 

  /**
   * @dev global variales for batch commited
   * Function: Commit a batch
   */
  // Minim collateral required to commit for a batch
  uint constant MIN_COMMIT_COLLATERAL = 1 ether;
  // Blocks while the operator can forge
  uint constant MAX_COMMIT_BLOCKS = 150;
  // Operator that is commited to forge the batch
  address commitedOperator;     
  // Balance staked for operators at the time to commit a batch
  uint balanceCommited;
  // Block where the commit is not valid any more
  uint batchBlockExpires;
  // Root commited
  bytes32 rootCommited;


  /**
   * @dev Global rollup variables 
   */
  // Each batch forged will have the root state of the 'balance tree' 
  bytes32[] stateRoots;
  // Each batch forged will have a correlated 'exit tree' represented by the exit root
  bytes32[] exitRoots;
  // List of valid ERC20 tokens that can be deposot in 'balance tree'
  address[] tokens;
  // Set the leaf position for an account into the 'balance tree'
  uint lastLeafIndex;

  // Hash of all on chain transmissions ( will be mined in the next batch )
  // Forces 'operator' to add all on chain transmission
  bytes32 miningOnChainTxsHash;   

  // Hash of all on chain transmissions ( will be mined in two batches )
  // Forces 'operator' to add all on chain transmission
  bytes32 fillingOnChainTxsHash;

  /**
   * @dev Rollup constructor
   * Loads verifier snark proof
   * Deploy 'StakeManager' with 'Rollup' smart contract address
   * Load 'StakeManager' smart contract
   */
  constructor(address _verifier, address _poseidon) RollupHelpers(_poseidon) public {
    verifier = Verifier(_verifier);
    address _stakeManager = address( new StakeManager( address(this), block.number ));
    stakeManager = StakeManager(_stakeManager);
  }

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

  /**
   * @dev Inclusion of a new token that will be able to deposit on 'balance tree'
   * @param newToken smart contract token address
   */
  function addToken(address newToken) public onlyOwner {
      assert(tokens.length<0xFFFF);
      tokens.push(newToken);
  }

  /**
   * @dev Checks proof given by the operator
   * forge the block if succesfull, burn operator stake otherwise
   * @param proofA zero knowledge input
   * @param proofB zero knowledge input
   * @param proofC zero knowledge input
   * @param newStateRoot new root to add in rootStates
   * @param exitRoot root of all exit transaction
   * @param feePlan fee operator plan
   * @param nTxPerCoin number of transmission per coin in order to calculate total fees
   * @param compressedTxs data availability to maintain 'balance tree' 
   */
  // * @param beneficiary address destination to receive fee transactions
  function forgeBlock( uint[2] memory proofA, uint[2][2] memory proofB, uint[2] memory proofC,
    bytes32 newStateRoot, bytes32 exitRoot, uint32[2] memory feePlan, uint32 nTxPerCoin,
    bytes memory compressedTxs) public {
    // Public Parameters of the circuit
      // [] newStateRoot,
      // [] exitRoot
      // [] feePlan[2]
      // [] nTxPerCoin
      // [] Hash(compressedTxs)
      // [] miningOnChainTxsHash
    
      uint[8] memory input;

      verifier.verifyProof(proofA, proofB, proofC, input);


    // Verify circuit
      // code public inputs to have uint[x]
        // hash of compressed tx
        // get miningOnChainTxsHash
    
    // Calculate fees
      // feePlan & nTxPerCoin
      // Send fees to beneficiary
      
    // Expose transacction through events ?

    // Call Stake SmartContract to 
      // stakeManager.blockForgedStaker(hash(proof), msg.sender);


      miningOnChainTxsHash = fillingOnChainTxsHash;
      fillingOnChainTxsHash = 0;
  }

  // TODO: Deposit fees?
  function deposit(
      uint depositAmount,
      uint token,
      uint[2] memory babyPubKey,
      uint to,                // In the TX deposit, it allows to do a send during deposit
      uint sendAmount,
      address withdrawAddress
  ) payable public {
      // create new leaf with nonce = 0
      // each tx Off-Chain will increase nonce
      lastLeafIndex++;
      // TODO: pseudo-code
      // thisHash = Hash(depositAmount, token, baby[2], withdraw address, nonce,lastLeafIndex);
      // fillingOnChainTxsHash = hash(fillingOnChainTxsHash, Hash(depositAmount, token, baby[2], withdraw address));
    // create Event with data availability to build 'balance tree'
      // event(index, value) or event()
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
   * @dev Retrieve root given its block depth
   * @return root
   */
  function getRoot(uint id) public view returns (bytes32) {
    return stateRoots[id];
  }


  /**
   * @dev Retrieve total number of blocks mined
   * @return Total number of blocks mined
   */
  function getDepth() public view returns (uint) {
    return stateRoots.length;
  }
}
