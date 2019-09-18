pragma solidity ^0.5.0;

import "../lib/RollupHelpers.sol";

contract RollupHelpersTest is RollupHelpers{

  constructor( address _poseidonContractAddr) RollupHelpers(_poseidonContractAddr) public {}

  function testHashGeneric(uint256[] memory inputs) public view returns(uint256) {
    return hashGeneric(inputs);
  }

  function testHashMulti(uint256[] memory inputs) public view returns(uint256) {
    return multiHash(inputs);
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

  function buildEntryDepositTest(uint24 idBalanceTree, uint16 amountDeposit, uint16 tokenId,
    uint256 Ax, uint256 Ay, address withdrawAddress, uint32 nonce
  ) public pure returns (bytes32, bytes32, bytes32, bytes32, bytes32) {

    Entry memory entry = buildEntryDeposit(idBalanceTree, amountDeposit, tokenId,
      Ax, Ay, withdrawAddress, nonce);
    return (entry.e1,
            entry.e2,
            entry.e3,
            entry.e4,
            entry.e5);
  }

  function hashEntryTest(uint24 idBalanceTree, uint16 amountDeposit, uint16 tokenId,
    uint256 Ax, uint256 Ay, address withdrawAddress, uint32 nonce
  ) public view returns (uint256) {

    Entry memory entry = buildEntryDeposit(idBalanceTree, amountDeposit, tokenId,
      Ax, Ay, withdrawAddress, nonce);

    return hashEntry(entry);
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

  function hashOffChainTxTest(bytes memory compressedTxs) public view returns (uint256) {
    return hashOffChainTx(compressedTxs);
  }

  function calcTokenTotalFeeTest(bytes32 tokenIds, bytes32 fee, bytes32 nTxToken, uint nToken)
    public pure returns (uint, uint) {
    return calcTokenTotalFee(tokenIds, fee, nTxToken, nToken);
  }

  function buildEntryExitLeafTest(uint24 id, uint16 amount, uint16 token, address withAddress)
    public pure returns (bytes32, bytes32, bytes32, bytes32, bytes32) {
    Entry memory entry = buildEntryExitLeaf(id, amount, token, withAddress);
    return (entry.e1,
            entry.e2,
            entry.e3,
            entry.e4,
            entry.e5);
  }

  function buildEntryBalanceTreeTest(uint16 amount, uint16 token, uint256 Ax, uint256 Ay,
    address withAddress, uint32 nonce) public pure returns (bytes32, bytes32, bytes32, bytes32, bytes32) {
    Entry memory entry = buildEntryBalanceTree(amount, token, Ax, Ay, withAddress, nonce);
    return (entry.e1,
            entry.e2,
            entry.e3,
            entry.e4,
            entry.e5);
  }
}