pragma solidity ^0.6.1;

import './Memory.sol';

/**
 * @dev RollupPoS helper functions
 */
contract RollupPoBHelpers {

  using Memory for *;

  uint constant bitsTx = 24 + 24 + 16 + 4;
  uint constant rField = 21888242871839275222246405745257275088548364400416034343698204186575808495617;

  constructor () public {}

  /**
   * @dev hash all off-chain transactions
   * @param offChainTx off-chain transaction compressed format
   * @param maxTx Maxtransactions that fits in one batch
   * @return hash of all off-chain transactions
   */
  function hashOffChainTx(bytes memory offChainTx, uint256 maxTx) internal pure returns (uint256) {
    uint256 totalLength = maxTx*bitsTx;

    if (maxTx % 2 != 0) {
        totalLength += 4;
    }

    bytes memory hashOffTx = new bytes(totalLength/8);
    Memory.Cursor memory c = Memory.read(offChainTx);
    uint256 ptr = totalLength/8 - offChainTx.length;

    while (!c.eof()) {
      // add off-chain transactions at the end
      bytes1 iTx = c.readBytes1();
      hashOffTx[ptr] = iTx;
      ptr++;
    }
    return uint256(sha256(hashOffTx)) % rField;
  }

}