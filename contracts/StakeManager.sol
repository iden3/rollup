pragma solidity ^0.5.0;

import { StakeManagerHelpers } from "./lib/StakeManagerHelpers.sol";

/**
 * @dev Define interface Rollup smart contract
 */
contract RollupInterface {
  function getRoot(uint id) public view returns (bytes32);
  function getDepth() public view returns (uint);
} 

contract StakeManager{

  // External contracts used
  RollupInterface rollup;


  // defines operator structure 
  struct  Operator{
    address controllerAddress;
    address beneficiaryAddress;
    uint amountStaked;
    uint effectiveStake; // Odds to win the raffle
  }
  // Array of operators
  Operator[] public operators;
  // Operators registered
  mapping(address => bool) operatorsRegistered;

  // Defines node for staker tree
  struct StakerTreeNode{
    bool typeOf; // type of node: false --> intermediate, true --> final
    uint32 pLeft;
    uint32 pRight;
    uint64 lessThan;
    uint64 increment;

    uint32 operatorId; // index array `operators`
  }
  // Store all staker tree nodes
  StakerTreeNode[] stakerTreeNodes;
  // current root of staker tree
  uint32 pCurrentRoot;

  // Minimum stake to enter the raffle
  uint constant MIN_STAKE = 10 ether;
  // Flag to determine if the staker tree is initilized
  bool initialized = false;
  // Rollup smart contract address
  address ownerRollup;

  // First block where the first era begins
  uint firstBlock;
  
  // constants determining era and slot block duration
  uint constant BLOCKS_PER_SLOT = 100; 
  uint constant SLOTS_PER_ERA = 20;
  uint constant MIN_BLOCKS_BEFORE_REFUND = 2*SLOTS_PER_ERA*BLOCKS_PER_SLOT;

  // defines refunds
  struct Refund {
    uint256 amount;
    uint64 unlockBlock; // Block from wich the operator can make the refund
  }
  // Address that can withdraw the refund
  mapping(address => Refund) refunds;

  // defines raffle structure
  // Each era will have a raffle
  // At the begining of each era, all slots winners are determined by:
  // entropy --> which will select an operator that will be able to forge at each slot
  // pRoot --> pointer of the initial stake root leaf 
  struct Raffle {
    uint32 pRoot;
    uint totalStaked;
    bytes16 entropy;
  }

  // list of raffles depending on era index
  mapping(uint => Raffle) raffles;
  
  // Total effective stake for a given raffle
  // Sum all the operators effective stake
  uint totalEffectiveStake; 

  // Indicates if at least one batch has been forged on an slot
  // used for slashing operators
  mapping(uint => bool) blockForged;

  /**
   * @dev Stake manager constructor
   * Loads 'Rollup' smart contract
   * Set first block where the era will begin
   * @param _rollup rollup address
   */
  constructor(address _rollup) public {
    require(_rollup != address(0));
    rollup = RollupInterface(_rollup);
    ownerRollup = _rollup;
  }

  /**
   * @dev modifier to check if staker manager has been initialized
   */
  modifier isInitialized {
    require(initialized == true);
    _;
  }

  /**
   * @dev modifier only allow rollup function call
   */
  modifier onlyRollup {
    require(ownerRollup == msg.sender);
    _;
  }

  /**
   * @dev Initialize raffle tree and its state
   * @param beneficiaryAddress address which will get the operator earnings
   * @param initialBlock initial block to start counting era
   */
  function start(address beneficiaryAddress, uint initialBlock) public payable {
    // Verifications before start staker manager
    require(initialized == false, 'Staker manager has been already initialized');
    require(msg.value >= MIN_STAKE, 'Ether send not enough to enter raffle');
    require(initialBlock > block.number, 'initial block before current block');
    
    // Calculate effective amount and initialize 'totalEffectiveStake' 
    uint effStake = calcEffectiveAmount(msg.value);
    totalEffectiveStake = effStake;
    
    // Add operator
    operators.push(Operator(msg.sender, beneficiaryAddress, msg.value, effStake));
    operatorsRegistered[msg.sender] = true;

    // Add leaf to staker tree
    // This would be the first leaf into the staker tree
    // 'addStakerNode' will be called to add more leaves to the staker tree
    stakerTreeNodes.push(StakerTreeNode(true, 0, 0 , 0, 0, 0));
    pCurrentRoot = 0;
    
    // Create first raffle for the first era
    raffles[0] = ( Raffle(pCurrentRoot, totalEffectiveStake , bytes16(blockhash(block.number))) );
    firstBlock = initialBlock;
    initialized = true;
  }

  /**
  * @dev Allow operator to be added into the raffle
  * @param beneficiary address which will get the operator earnings
  * @param stakeAddress address which will deposit the staked amount
  */
  function createStake(
    address beneficiary,
    address stakeAddress,
    bytes32 msgHash,
    bytes memory rsv
  ) public payable isInitialized {
  
    // Verify signature with stakeAddress
    require(StakeManagerHelpers.checkSig(msgHash, rsv) == stakeAddress, 'Signature not valid');

    // Verify minimal amount to stake
    require( msg.value >= MIN_STAKE, 'Not enough balance to enter the raffle');

    // Verify operator has not been registered
    require(operatorsRegistered[msg.sender] == false, 'operator already registered');

    uint effStake = calcEffectiveAmount(msg.value);
    uint operatorId = operators.push(Operator(msg.sender, beneficiary, msg.value, effStake));
    addStakerNode(operatorId);
  }

  /**
  * @dev function to get removed from the stake tree and get back the staked commited
  * @param operatorId operator identifier
  * beneficiary, address stakeAddress + r,s,v stakeAddress + message 
  */
  function removeStake(uint operatorId) public {
    // get operator by its id
    Operator storage operator = operators[operatorId];
    require(msg.sender == operator.controllerAddress);
    // remove operator from staker tree
    removeStakerNode(operatorId);
    // add funds staked to operator refunds
    refunds[operator.controllerAddress].amount += operator.amountStaked;
    // Reset operator parameters
    operator.amountStaked = 0;
    operator.effectiveStake = 0;
    // Set block from which the operator can withdraw the stake
    refunds[operator.controllerAddress].unlockBlock = uint64(block.number + MIN_BLOCKS_BEFORE_REFUND);
    // Operator is not registered anymore
    operatorsRegistered[msg.sender] = false;
  }

  /**
   * @dev Return the operator address that wins the given slot
   * @param slot slot index
   * @return operator index
   */
  function getWinnerOperatorIndexBySlot(uint slot) public view returns(uint){
    require(slot <= currentSlot(), 'Slot requested still does not exist');
    uint era = slot / SLOTS_PER_ERA;
    // From the 'era' number:
    // Get raffle entropy
    bytes16 entropy = raffles[era].entropy;
    // calculate lucky number for the raffle for each slot
    uint256 inValue = uint256(keccak256(abi.encodePacked(entropy, slot)));
    inValue = inValue % raffles[era].totalStaked;
    // retrieve address operator winner
    return findStakerNode(raffles[era].pRoot ,inValue);
  }

  /**
   * @dev function to withdraw stake
   * It can be retrieved by the operator controller address
   */
  function withdraw() public {
    // get refund struct depending on msg.sender
    Refund storage refund = refunds[msg.sender];
    // Verify current block number is after unlock refund block number
    require(block.number >= refund.unlockBlock, 'Refund can not be effective. Block before unlock block');
    uint amount = refund.amount;
    require(amount > 0);
    refund.amount = 0;
    refund.unlockBlock = 0;
    // send stake back to the operator
    msg.sender.transfer(amount);
  }

  /**
   * @dev function to report an operator which has not commited a batch
   * it that case, staked amount is burned and the slasher gets a 10% of the satked amount
   * @param slot slot index 
   */
  function slash(uint slot) public {
    require(slot < currentSlot(), 'Slot requested still does not exist');
    require(blockForged[slot] == false, 'Batch has been forged during this slot');
    // get operator index
    uint slashedIndexOperator = getWinnerOperatorIndexBySlot(slot);
    // remove operator from staker tree
    removeStakerNode(slashedIndexOperator);
    // Calculate amounts to: burn and reward
    uint amoutStaked = operators[slashedIndexOperator].amountStaked;
    uint amountBurned = amoutStaked * 9000/10000;
    uint amountReward = amoutStaked - amountBurned;
    // update operator state
    operators[slashedIndexOperator].amountStaked = 0;
    operators[slashedIndexOperator].effectiveStake = 0;
    // Burn
    address(0).transfer(amountBurned);
    // Pay reward
    msg.sender.transfer(amountReward);
  }

  /**
   * @dev function caled by the rollup smart contract when an operator forges a block
   * @param entropy entropy to be added to raffle
   * @param operator operator controller address
   */
  function blockForgedStaker(uint128 entropy, address operator) public onlyRollup returns(address){
    uint indexOperator = getWinnerOperatorIndexBySlot(currentSlot());
    // verify that the operator that wants to forge the block is the raffle winner
    require(operators[indexOperator].controllerAddress == operator);
    // Snapshot Raffle
    updateRaffle(entropy);
    // forge block is succesfull, mark that in this slot a block has been forged
    blockForged[currentSlot()] = true;
    // return benefiacry address
    return operators[indexOperator].beneficiaryAddress;
  }

  // set operator that can forge during a slot
  function authForger(uint slot) public view returns (uint){

  }

  //////////////
  // Staker manager helpers
  /////////////

  /**
   * @dev add node to the staker tree
   * @param operatorId operator to add into the staker tree  
   */
  function addStakerNode(uint operatorId) private {
    // TODO:
    // Add leaf to staker tree
    // Update pCurrentRoot
    // Update totalEffectiveStake
  }

  /**
   * @dev remove node from the staker tree
   * @param operatorId operator to remove from the staker tree  
   */
  function removeStakerNode(uint operatorId) private {
    // TODO: 
    // Remove leaf to staker tree
    // Update pCurrentRoot
    // Update totalEffectiveStake
  }

  /**
   * @dev remove node from the staker tree
   * @param pRoot pointer to the initial staker tree leaf
   * @param findValue value to select the staker tree leaf
   * @return operator index
   */
  function findStakerNode(uint pRoot, uint findValue) private view returns (uint){
    // TODO: Find leaf into staker tree
  }

  /**
   * @dev calculate effective stake from amount staked
   * @param amount amount staked by the operator
   * @return effective stake
   */
  function calcEffectiveAmount(uint amount) private pure returns (uint) {
    //TODO: exponentiation 1.2 
    return amount**(2);
  }

  /**
   * @dev update the raffle for the next 'era'
   * @param entropy would be the hash revealed by the operator
   */
  function updateRaffle(uint entropy) private {
    Raffle storage raffle = raffles[currentEra()+1];
    raffle.pRoot = pCurrentRoot;
    raffle.totalStaked = totalEffectiveStake;
    // Update entropy only the first batch that is forged into the slot
    if(!blockForged[currentSlot()]) {
      uint128 oldEntropy = uint128(raffle.entropy); 
      raffle.entropy = bytes16(keccak256(abi.encodePacked(oldEntropy, uint128(entropy))));
    }
  }

  //////////////
  // Viewers
  /////////////

  /**
   * @dev Retrieve current era
   * @return era number
   */
  function currentEra() public view returns(uint){ 
    return (block.number - firstBlock) / (BLOCKS_PER_SLOT*SLOTS_PER_ERA);
  }

  /**
   * @dev Retrieve current slot
   * @return slot number
   */
  function currentSlot() public view returns(uint){
    return (block.number - firstBlock) / BLOCKS_PER_SLOT;
  }
}