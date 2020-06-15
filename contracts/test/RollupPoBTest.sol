pragma solidity ^0.6.1;

import "../RollupPoB.sol";

contract RollupPoBTest is RollupPoB {

    constructor(
        address _rollup,
        uint256 _maxTx,
        address payable burnAddress,
        address payable opDefaultAddr,
        string memory urlDefault
    ) RollupPoB(_rollup, _maxTx, burnAddress, opDefaultAddr, urlDefault) public {}

    uint public blockNumber;

    function getBlockNumber() public view override returns (uint) {
        return blockNumber;
    }

    function setBlockNumber(uint bn) public {
        blockNumber = bn;
    }

    function commitAndForge(
        bytes calldata compressedTx,
        uint[2] calldata proofA,
        uint[2][2] calldata proofB,
        uint[2] calldata proofC,
        uint[10] calldata input,
        bytes calldata compressedOnChainTx
    ) external payable override {
        uint32 slot = currentSlot();
        Operator storage op = slotWinner[slot];
        if(op.forgerAddress != address(0x00)){
            // message sender must be the controller address
            require(msg.sender == op.forgerAddress, 'message sender must be forgerAddress');
            // beneficiary address input must be operator benefiacry address
            require(op.beneficiaryAddress == address(input[beneficiaryAddressInput]),
                'beneficiary address must be operator beneficiary address');
        } else {
            require(msg.sender == opDefault.forgerAddress, 'message sender must be default operator');
            require(opDefault.beneficiaryAddress == address(input[beneficiaryAddressInput]),
                    'beneficiary address must be default operator beneficiary address');
        }

        uint256 offChainHash = hashOffChainTx(compressedTx, MAX_TX);
        // Check input off-chain hash matches hash commited
        require(offChainHash == input[offChainHashInput],
            'hash off chain input does not match hash commited');

        // one block has been forged in this slot
        infoSlot[slot].fullFilled = true;
        emit dataCommitted(offChainHash);
    }

    function commitAndForgeDeadline(
        bytes calldata compressedTx,
        uint[2] calldata proofA,
        uint[2][2] calldata proofB,
        uint[2] calldata proofC,
        uint[10] calldata input,
        bytes calldata compressedOnChainTx
    ) external payable override {
        uint32 slot = currentSlot();

        // Check if deadline has been achieved to not commit any more data
        uint blockDeadline = getBlockBySlot(slot + 1) - SLOT_DEADLINE;
        require(getBlockNumber() >= blockDeadline, 'not possible to forge data before deadline');

        // Check there is no data to be forged
        require(!infoSlot[slot].fullFilled, 'another operator has already forged data');

        uint256 offChainHash = hashOffChainTx(compressedTx, MAX_TX);
        // Check input off-chain hash matches hash commited
        require(offChainHash == input[offChainHashInput],
            'hash off chain input does not match hash commited');

        // one block has been forged in this slot
        infoSlot[slot].fullFilled = true;
        emit dataCommitted(offChainHash);
    }

}