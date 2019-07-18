pragma solidity ^0.5.0;

contract Rollup {
  function getRoot(uint id) public view returns (bytes32);
  function getDepth() public view returns (uint);
} 

contract StakeManager{

Rollup rollup;

struct  Operator{
  address controllerAddress;
  address beneficiaryAddress;
  uint amoutStaked;
  uint64 effectiveStake; // Odds to win the raffle. 
}

struct TreeNode{
  bool typeOf; // false --> intermediate, true --> final
  uint32 pLeft; // 
  uint32 pRight;
  uint64 lessThan;
  uint64 increment;

  uint32 operatorId; // index array `operators`
}

uint constant MIN_STAKE = 0.1 ether;
bool initilaized = false;
address ownerRollup;

uint first_block;
uint constant BLOCKS_PER_SLOT = 100; // Time slot
uint constant SLOTS_PER_ERA = 100;
uint constant MIN_BLOCKS_BEFORE_REFUND = 2*SLOTS_PER_ERA*BLOCKS_PER_SLOT;

struct Refud {
  uint128 amount;
  uint64 unlockBlock;
}

mapping(address => Refund) refunds;

TreeNode[] treeNodes;

struct Raffle {
  uint32 pRoot;
  uint64 totalStaked;
  bytes16 entropy;
}

// entropy will be determined by previous block hash
mapping(uint => Raffle) raffles;

uint pCurrenttRoot;
uint64 totalEffectiveStake;

Operator[] public operators;  

mapping(uint => bool) blockForged;

  constructor(address _rollup, uint initialBlock) public {
    assert(initialBlock > block.number);
    assert(_rollup != address(0));
    rollup = Rollup(_rollup);
    ownerRollup = _rollup;
    first_block = initialBlock;
    raffles.push(Raffle(pCurrenttRoot, totalEffectiveStake , block.hash));
  }

modifier isInitialized {
  require(initilaized == true);
  _;
}

modifier onlyRollup {
  require(ownerRollup == msg.sender);
  _;
}

// function start() public payable {
//   pCurrenttRoot = 0;
//   uint64 effStake = calcEffectiveAmount(msg.value);
//   assert(effStake > 0);
//   totalEffectiveStake = effStake ;
//   operators.push(Operator(msg.sender, msg.value, effStake));
//   nodes.push(Node(true, 0, 0 , 0, 0, 0));
//   first_block = block.number;
//   raffles.push(Raffle(pCurrenttRoot, totalEffectiveStake , block.hash));
//   initilaized = true;
// }



// Return the operator address that wins the given slot
function getWinnerOperatorIndexBySlot(uint slot) public view returns(uint){
  uint era = slot / SLOTS_PER_ERA;
  assert(era <= getCurrentEra());
  // TODO: hash keccak
  uint256 r = (uint256)keccak256((bytes32)(uint128(raffles[era].entropy) + slot));
  r = r % raffles[era].totalStaked;
  // From raffles[era].pRoot --> retrieve winner operator
}

function updateRaffle(uint _entropy) {
  Raffle storage raffle = raffles[getCurrentEra()+1];
  raffle.pRoot = pCurrenttRoot;
  raffle.totalStaked = totalStaked;
  raffle.entropy = (bytes16)keccak(block.hash + _entropy);
}

function createNode() {

}

function calcEffectiveAmount(uint amount) private pure returns (uint64) {
  // Calculate effective amount
}


/**
 * Input parameters: address beneficiary, address stakeAddress + r,s,v stakeAddress + message 
 */
function createStake() payable isInitialized{
  assert(msg.value > MIN_STAKE);
  // require --> protection. Operator cannot be twice
  // Calculate effectiveStake depending on tree
  uint id = operators.push(Operator(stakeAddress, beneficiary, msg.value, calcEffectiveAmount(msg.value)));
  addToTree();


  updateRaffle(12);
}

/**
 * Input parameters: address beneficiary, address stakeAddress + r,s,v stakeAddress + message 
 */
function removeStake(uint indexOperator) public {
  Operator storage operator = operators[indexOperator];
  assert(msg.sender == operator.address);
  removeFromTree(indexOperator);
  refunds[operator.address].amount += operator.amoutStaked;
  operator.amountStaked = 0;
  operator.effectiveStake = 0;
  refunds[operator.address].unlockBlock = block.number + MIN_BLOCKS_BEFORE_REFUND;
  updateRaffle(12);
}

function withdraw() public {
  Refund storage refund = refunds[msg.sender];
  assert(block.number >= refund.unlockBlock);
  uint amount = refund.amount;
  require(amount > 0);
  refund.amount = 0;
  refund.unlockBlock = 0;
  msg.sender.transfer(amount);
}

function currentEra() public view returns(uint){ 
  return (block.number - initialBlock) / (BLOCKS_PER_SLOT*SLOTS_PER_ERA);
}

function currentSlot() public view returns(uint){
  return (block.number - initialBlock) / BLOCKS_PER_SLOT;
}


function slash(uint slot) {
  assert(slot < currentSlot());
  assert(blockForged[slot] == false);
  slashedIndexOperator = getWinnerOperatorIndexBySlot(slot);
  removeFromTree(slashedIndexOperator);
  uint amoutStaked = operators[slashedIndexOperator].amoutStaked;
  uint amountBurned = amoutStaked * 9000/10000;
  uint amountReward = amoutStaked - amountBurned;
  // update operator state
  operators[slashedIndexOperator].amoutStaked = 0;
  operators[slashedIndexOperator].effectiveStake = 0;
  // Burn
  address(0).transfer(amountBurned);
  // Pay reward
  msg.sender.transfer(amountReward);
}

function blockForged(uint128 entropy, address operator) onlyRollup returns(address){
  uint indexOperator = getWinnerOperatorIndexBySlot(getCurrentSlot());
  require(operators[indexOperator].controllerAddress == operator);
  // Snapshot Raffle
  updateRaffle(entropy);
  blockForged[getCurrentSlot()] = true;
  return operators[indexOperator].beneficiaryAddress
}

// set operator that can forge during a slot
function authForger(uint slot) public viewer returns (uint){

}


}