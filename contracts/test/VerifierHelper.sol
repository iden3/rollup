pragma solidity ^0.6.1;

import '../VerifierInterface.sol';

contract VerifierHelper {
  function verifyProof(
    uint[2] memory a,
    uint[2][2] memory b,
    uint[2] memory c,
    uint[10] memory input
  ) public view returns (bool) {
    return true;
  }
}