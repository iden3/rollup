pragma solidity ^0.5.1;

import "./RollupPoS.sol";

contract RollupPoSTest is RollupPoS {
    uint blockNumber;
    function getBlockNumber() public view returns (uint) {
        return blockNumber;
    }

    function setBlockNumber(uint bn) public {
        blockNumber = bn;
    }
    ss
}
