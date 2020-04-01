pragma solidity ^0.6.1;

/**
 * @dev Define interface Rollup smart contract
 */
interface RollupInterface {
  function forgeBatch(
    address payable beneficiaryAddress,
    uint[2] calldata proofA,
    uint[2][2] calldata proofB,
    uint[2] calldata proofC,
    uint[8] calldata input,
    uint256[] calldata compressedOnChainTx
  ) external payable;
}