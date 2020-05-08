pragma solidity ^0.6.1;

import './Memory.sol';

/**
 * @dev RollupPoS helper functions
 */
contract RollupPoBHelpers {

  using Memory for *;

  uint constant bytesOffChainTx = 3*2 + 2;
  uint constant rField = 21888242871839275222246405745257275088548364400416034343698204186575808495617;

  constructor () public {}

  /**
   * @dev hash all off-chain transactions
   * @param offChainTx off-chain transaction compressed format
   * @return hash of all off-chain transactions
   */
  function hashOffChainTx(bytes memory offChainTx, uint256 maxTx) internal pure returns (uint256) {
    uint headerLength = (maxTx >> 3);
    if((maxTx % 8) != 0) headerLength = headerLength + 1;
    uint totalLength = maxTx*bytesOffChainTx + headerLength;

    bytes memory hashOffTx = new bytes(totalLength);
    Memory.Cursor memory c = Memory.read(offChainTx);
    uint ptrHeader = 0;
    uint ptr = totalLength - offChainTx.length + headerLength;

    while (!c.eof()) {
      if (ptrHeader < headerLength) {
        // add header at the start
         bytes1 iHeader = c.readBytes1();
         hashOffTx[ptrHeader] = iHeader;
         ptrHeader++;
      } else {
        // add off-chain transactions at the end
        bytes1 iTx = c.readBytes1();
        hashOffTx[ptr] = iTx;
        ptr++;
      }
    }
    return uint256(sha256(hashOffTx)) % rField;
  }

}