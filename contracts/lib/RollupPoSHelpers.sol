pragma solidity ^0.5.0;

import './Memory.sol';

/**
 * @dev RollupPoS helper functions
 */
contract RollupPoSHelpers {

  using Memory for *;

  uint constant bytesOffChainTx = 3*2 + 2;
  uint constant rField = 21888242871839275222246405745257275088548364400416034343698204186575808495617;

  constructor () public {}

  // function getHeaderLen(uint bytesLen) internal pure returns (uint){
  //   uint counter = 0;
  //   uint tmpBytesLen = bytesLen;
  //   tmpBytesLen = tmpBytesLen - 1;
  //   if (tmpBytesLen > 8*bytesOffChainTx)
  //     counter = getHeaderLen(tmpBytesLen - 8*bytesOffChainTx);
  //   return (counter + 1);
  // }

  /**
   * @dev hash all off-chain transactions
   * @param offChainTx off-chain transaction compressed format
   * @return hash of all off-chain transactions
   */
  function hashOffChainTx(bytes memory offChainTx, uint256 maxTx) internal pure returns (uint256) {
    uint headerLength = (maxTx >> 3);
    if((maxTx % 8) != 0) headerLength = headerLength + 1;
    bytes memory hashOffTx = new bytes(maxTx*bytesOffChainTx + headerLength);
    Memory.Cursor memory c = Memory.read(offChainTx);
    uint ptr = 0;
    while(!c.eof()) {
      bytes1 iTx = c.readBytes1();
      hashOffTx[ptr] = iTx;
      ptr++;
    }
    return uint256(sha256(hashOffTx)) % rField;
  }
}