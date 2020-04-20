pragma solidity ^0.6.1;

import "../RollupPoB.sol";

contract RollupPoBTest is RollupPoB {

    constructor(address _rollup, uint256 _maxTx) RollupPoB(_rollup, _maxTx) public {}

    uint public blockNumber;

    function getBlockNumber() public view override returns (uint) {
        return blockNumber;
    }

    function setBlockNumber(uint bn) public {
        blockNumber = bn;
    }

    function forgeCommittedBatch(
        uint[2] memory proofA,
        uint[2][2] memory proofB,
        uint[2] memory proofC,
        uint[8] memory input
     ) public override {
        uint32 slot = currentSlot();
        Operator storage op = slotWinner[slot];
        // message sender must be the controller address
        require(msg.sender == op.forgerAddress, 'message sender must be forgerAddress');
        // Check input off-chain hash matches hash commited
        require(commitSlot[slot].offChainHash == input[offChainHashInput],
            'hash off chain input does not match hash commited');
        // Check that operator has committed data
        require(commitSlot[slot].committed == true, 'There is no committed data');
        // clear committed data
        commitSlot[slot].committed = false;
        // one block has been forged in this slot
        fullFilled[slot] = true;
    }

    function commitAndForgeDeadline(
        bytes calldata compressedTx,
        uint[2] calldata proofA,
        uint[2][2] calldata proofB,
        uint[2] calldata proofC,
        uint[8] calldata input
    ) external override {
        uint32 slot = currentSlot();
        // Check if deadline has been achieved to not commit any more data
        uint blockDeadline = getBlockBySlot(slot + 1) - SLOT_DEADLINE;
        require(getBlockNumber() >= blockDeadline, 'not possible to commit data before deadline');
        // Check there is no data to be forged
        require(!fullFilled[slot], 'another operator has already forged data');
        require(!commitSlot[slot].committed, 'another operator has already submitted data');
        uint256 offChainHash = hashOffChainTx(compressedTx, MAX_TX);
        emit dataCommitted(offChainHash);
        // Check input off-chain hash matches hash commited
        require(offChainHash == input[offChainHashInput],
            'hash off chain input does not match hash commited');
        // one block has been forged in this slot
        fullFilled[slot] = true;
    }

}