pragma solidity ^0.6.1;

contract EventTest {

  event Deposit(uint batchNumber ,uint idBalanceTree, uint depositAmount, uint tokenId, uint Ax, uint Ay,
    address withdrawAddress );

  event ForgeBatch(uint batchNumber, bytes offChainTx);

  bytes32[] stateRoots;
  uint24 lastBalanceTreeIndex = 1;

  function deposit(
    uint16 depositAmount,
    uint16 tokenId,
    uint256[2] memory babyPubKey,
    address withdrawAddress
  ) public {

    uint currentBatch = getStateDepth() - 1;

    emit Deposit(currentBatch, lastBalanceTreeIndex, depositAmount, tokenId, babyPubKey[0], babyPubKey[1],
      withdrawAddress);
    lastBalanceTreeIndex++;
  }

  function forgeBatch(
    uint newRoot,
    bytes memory compressedTxs
  ) public {

    stateRoots.push(bytes32(newRoot));
    emit ForgeBatch(getStateDepth(), compressedTxs);
  }

  function getStateRoot(uint numBatch) public view returns (bytes32) {
    require(numBatch <= stateRoots.length - 1, 'Batch number does not exist');
    return stateRoots[numBatch];
  }

  function getStateDepth() public view returns (uint) {
    return stateRoots.length;
  }
}