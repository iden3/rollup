pragma solidity ^0.5.1;

import "../RollupPoS.sol";

contract RollupPoSTest is RollupPoS {

    constructor( address _rollup, uint256 _maxTx) RollupPoS(_rollup, _maxTx) public {}

    uint public blockNumber;

    function getBlockNumber() public view returns (uint) {
        return blockNumber;
    }

    function setBlockNumber(uint bn) public {
        blockNumber = bn;
    }

    function setBlockForged(uint32 slot) public {
        fullFilled[slot] = true;
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

    function getTreeLen() public view returns (uint256 era) {
        return nodes.length;
    }

    function getRaffle(uint32 eraIndex) public view returns (
        uint32 era,
        uint32 root,
        uint64 historicStake,
        uint64 activeStake,
        bytes8 seedRnd
    ) {
        Raffle memory raffleTest = raffles[eraIndex];
        return (
          raffleTest.era,
          raffleTest.root,
          raffleTest.historicStake,
          raffleTest.activeStake,
          raffleTest.seedRnd
        );
    }

    function forgeCommittedBatch(
        uint[2] memory proofA,
        uint[2][2] memory proofB,
        uint[2] memory proofC,
        uint[8] memory input
    ) public {
        uint32 slot = currentSlot();
        uint opId = getRaffleWinner(slot);
        Operator storage op = operators[opId];
        // Check input off-chain hash matches hash commited
        require(commitSlot[slot].offChainHash == input[4],
            'hash off chain input does not match hash commited');
        // Check that operator has committed data
        require(commitSlot[slot].committed == true, 'There is no committed data');
        // update previous hash committed by the operator
        op.rndHash = commitSlot[slot].previousHash;
        // clear committed data
        commitSlot[slot].committed = false;
        // one block has been forged in this slot
        fullFilled[slot] = true;
    }
}