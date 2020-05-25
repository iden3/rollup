pragma solidity ^0.6.1;

/**
 * @dev Define interface verifier
 */
interface VerifierInterface {
  function verifyProof(
    uint[2] calldata proofA,
    uint[2][2] calldata proofB,
    uint[2] calldata proofC,
    uint[10] calldata input
  ) external view returns (bool);
}