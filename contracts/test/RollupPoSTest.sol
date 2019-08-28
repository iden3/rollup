pragma solidity ^0.5.1;

import "../RollupPoS.sol";

contract RollupPoSTest is RollupPoS {

  uint public blockNumber;

  function getBlockNumber() public view returns (uint) {
    return blockNumber;
  }

  function setBlockNumber(uint bn) public {
    blockNumber = bn;
  }

  function getRaffleWinnerTest(uint32 slot, uint64 luckyNumber) public view returns (uint32 winner) {
    // No negative era
    uint32 era = slot / SLOTS_PER_ERA;

    // Only accept raffle for present and past eras
    require (era <= currentEra()+1, "No access to not done raffles");

    uint32 ri;
    if (raffles[era].era == era) {
        ri = era;
    } else if (era > lastInitializedRaffle) {
        ri = lastInitializedRaffle;
    } else {
        require(false, "Raffle not initialized for that era");
    }

    Raffle storage raffle = raffles[ri];

    // Must be stakers
    require(raffle.activeStake > 0, "Must be stakers");

    // If only one staker, just return it
    if (operators.length == 1) return 0;

    // Do the raffle
    uint64 rnd = luckyNumber % raffle.activeStake;
    winner = nodeRaffle(raffle.root, rnd);
  }

  function getNode(uint32 idNode) public view returns (
    uint32 era,
    uint64 threashold,
    uint64 increment,
    bool isOpLeft,
    uint32 left,
    bool isOpRight,
    uint32 right
  ) {
    IntermediateNode memory N = nodes[idNode];
    return (
      N.era,
      N.threashold,
      N.increment,
      N.isOpLeft,
      N.left,
      N.isOpRight,
      N.right
    );
  }
}