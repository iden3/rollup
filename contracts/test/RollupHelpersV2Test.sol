pragma solidity ^0.5.0;

import "../lib/RollupHelpersV2.sol";

contract RollupHelpersTestV2 is RollupHelpersV2{

  constructor( address _poseidonContractAddr) RollupHelpersV2(_poseidonContractAddr) public {}

  function testHashGeneric(uint256[] memory inputs) public view returns(uint256) {
    return hashGeneric(inputs);
  }

  function testHashNode(uint256 left, uint256 right) public view returns(uint256) {
    return hashNode(left, right);
  }

  function testHashFinalNode(uint256 key, uint256 value) public view returns (uint256){
    return hashFinalNode(key, value);
  }

  function smtVerifierTest(uint256 root, uint256[] memory siblings,
    uint256 key, uint256 value, uint256 oldKey, uint256 oldValue,
    bool isNonExistence, bool isOld, uint256 maxLevels) public view returns (bool){
    return smtVerifier(root, siblings, key, value, oldKey,
      oldValue, isNonExistence, isOld, maxLevels);
  }

  function testEcrecover(bytes32 msgHash, bytes memory rsv) public pure returns (address) {
    return checkSig(msgHash, rsv);
  }

  function buildEntryFeePlanTest(bytes32[2] memory feePlan)
    public pure returns (bytes32, bytes32, bytes32, bytes32, bytes32) {

    Entry memory entry = buildEntryFeePlan(feePlan);
    return (entry.e1,
            entry.e2,
            entry.e3,
            entry.e4,
            entry.e5);
  }

  function hashOffChainTxTest(bytes memory compressedTxs, uint256 maxTx) public pure returns (uint256) {
    return hashOffChainTx(compressedTxs, maxTx);
  }

  function calcTokenTotalFeeTest(bytes32 tokenIds, bytes32 fee, bytes32 nTxToken, uint nToken)
    public pure returns (uint, uint) {
    return calcTokenTotalFee(tokenIds, fee, nTxToken, nToken);
  }

  function buildTreeStateTest(uint16 amount, uint16 token, uint256 Ax, uint256 Ay,
    address withAddress, uint32 nonce) public pure returns (bytes32, bytes32, bytes32, bytes32, bytes32) {
    Entry memory entry = buildTreeState(amount, token, Ax, Ay, withAddress, nonce);
    return (entry.e1,
            entry.e2,
            entry.e3,
            entry.e4,
            entry.e5);
  }

  function hashTreeStateTest(uint16 amount, uint16 token, uint256 Ax, uint256 Ay,
    address withAddress, uint32 nonce) public view returns (bytes32) {
    Entry memory entry = buildTreeState(amount, token, Ax, Ay, withAddress, nonce);
    return bytes32(hashEntry(entry));
  }

  function buildTxDataTest(
    uint24 fromId,
    uint24 toId,
    uint16 amount,
    uint16 token,
    uint32 nonce,
    uint16 maxFee,
    uint8 rqOffset,
    bool onChain,
    bool newAccount
  ) public pure returns (bytes32){
    return buildTxData(fromId, toId, amount, token, nonce, maxFee, rqOffset, onChain, newAccount);
  }

  function buildOnChainDataTest(
    uint256 oldOnChainHash,
    uint256 txData,
    uint128 loadAmount,
    address withdrawAddress,
    uint256 Ax,
    uint256 Ay
  ) public pure returns (bytes32, bytes32, bytes32, bytes32, bytes32, bytes32){
    Entry memory entry = buildOnChainData(oldOnChainHash, txData, loadAmount, withdrawAddress, Ax, Ay);
    return (entry.e1,
            entry.e2,
            entry.e3,
            entry.e4,
            entry.e5,
            entry.e6);
  }

  function hashOnChainTest(
    uint256 oldOnChainHash,
    uint256 txData,
    uint128 loadAmount,
    address withdrawAddress,
    uint256 Ax,
    uint256 Ay
  ) public view returns (uint256){
    Entry memory entry = buildOnChainData(oldOnChainHash, txData, loadAmount, withdrawAddress, Ax, Ay);
    return hashEntry(entry);
  }
}