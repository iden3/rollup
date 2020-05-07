pragma solidity ^0.6.1;

import './Memory.sol';

/**
 * @dev RollupPoS helper functions
 */
contract RollupPoSHelpers {

  using Memory for *;

  uint constant bitsTx = 24 + 24 + 16 + 4;
  uint constant rField = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
  uint constant FOURTH_ROOT_FINNEY = 5623; // 4th root of finney in weis

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

  /**
   * @dev Calculate the effective stake, which is: stake^1.25, it can also be noted as stake*stake^1/4
   * @param stake number to get the exponentiation
   * @return stake^1.25
   */
  function effectiveStake(uint stake) internal pure returns (uint64) {
    return uint64((stake*sqrt(sqrt(stake)))/(1 finney * FOURTH_ROOT_FINNEY));
  }

  /**
   * @dev perform the babylonian method to calculate in a simple and efficient way the square root
   * @param x number to calculate the square root
   * @return y square root of x
   */
  function sqrt(uint x) internal pure returns (uint y) {
    uint z = (x + 1) / 2;
    y = x;
    while (z < y) {
      y = z;
      z = (x / z + z) / 2;
    }
  }
}