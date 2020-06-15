pragma solidity ^0.6.1;

import "../lib/RollupHelpers.sol";

contract RollupHelpersTest is RollupHelpers{

  constructor( address _poseidonContractAddr) RollupHelpers(_poseidonContractAddr) public {}

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

  function calcTokenTotalFeeTest(bytes32 tokenIds, bytes32 feeTotal, uint nToken)
    public pure returns (uint32, uint256) {
    return calcTokenTotalFee(tokenIds, feeTotal, nToken);
  }

  function buildTreeStateTest(uint256 amount, uint16 token, uint256 Ax, uint256 Ay,
    address withAddress, uint32 nonce) public pure returns (bytes32, bytes32, bytes32, bytes32, bytes32) {
    Entry memory entry = buildTreeState(amount, token, Ax, Ay, withAddress, nonce);
    return (entry.e1,
            entry.e2,
            entry.e3,
            entry.e4,
            entry.e5);
  }

  function hashTreeStateTest(uint256 amount, uint16 token, uint256 Ax, uint256 Ay,
    address withAddress, uint32 nonce) public view returns (bytes32) {
    Entry memory entry = buildTreeState(amount, token, Ax, Ay, withAddress, nonce);
    return bytes32(hashEntry(entry));
  }

  function buildTxDataTest(
    uint16 amountF,
    uint16 token,
    uint32 nonce,
    uint8 fee,
    uint8 rqOffset,
    bool onChain,
    bool newAccount
  ) public pure returns (bytes32){
    return buildTxData(amountF, token, nonce, fee, rqOffset, onChain, newAccount);
  }

  function buildOnChainHashTest(
    uint256 oldOnChainHash,
    uint256 txData,
    uint128 loadAmount,
    uint256 hashOnChainData,
    address fromEthAddr
  ) public pure returns (bytes32, bytes32, bytes32, bytes32, bytes32){
    Entry memory entry = buildOnChainHash(oldOnChainHash, txData, loadAmount, hashOnChainData, fromEthAddr);
    return (entry.e1,
            entry.e2,
            entry.e3,
            entry.e4,
            entry.e5);
  }

  function hashOnChainHashTest(
    uint256 oldOnChainHash,
    uint256 txData,
    uint128 loadAmount,
    uint256 hashOnChainData,
    address fromEthAddr
  ) public view returns (uint256){
    Entry memory entry = buildOnChainHash(oldOnChainHash, txData, loadAmount, hashOnChainData, fromEthAddr);
    return hashEntry(entry);
  }

  function buildOnChainDataTest(
    uint256 fromAx,
    uint256 fromAy,
    address toEthAddr,
    uint256 toAx,
    uint256 toAy
    ) public pure returns (bytes32, bytes32, bytes32, bytes32, bytes32) {
     Entry memory entry = buildOnChainData(fromAx, fromAy, toEthAddr, toAx, toAy);
    return (entry.e1,
            entry.e2,
            entry.e3,
            entry.e4,
            entry.e5);
  }

  function hashOnChainDataTest(
    uint256 fromAx,
    uint256 fromAy,
    address toEthAddr,
    uint256 toAx,
    uint256 toAy
    ) public view returns (uint256) {
     Entry memory entry = buildOnChainData(fromAx, fromAy, toEthAddr, toAx, toAy);
     return hashEntry(entry);
  }

  function buildAndHashOnChain(
    address fromEthAddr,
    uint256 fromAx,
    uint256 fromAy,
    address toEthAddr,
    uint256 toAx,
    uint256 toAy,
    uint256 oldOnChainHash,
    uint256 txData,
    uint128 loadAmount
    ) public view returns (uint256) {
     return hashEntry(
       buildOnChainHash(
         oldOnChainHash, 
         txData, 
         loadAmount,  
         hashEntry(buildOnChainData(fromAx, fromAy, toEthAddr, toAx, toAy)), 
         fromEthAddr
       )
      );
  }

  function decodeOffchainDepositTest(bytes calldata offChainDeposit) external pure returns (
    uint256 Ax,
    uint256 Ay,
    address ethAddress,
    uint32 token
    ) {
    Ax = abi.decode(offChainDeposit[:32], (uint256));
    Ay = abi.decode(offChainDeposit[32:64], (uint256));
    ethAddress = address(abi.decode(offChainDeposit[52:84], (uint256)));
    token = uint32(abi.decode(offChainDeposit[56:88], (uint256)));
  }

  function float2FixTest(uint16 float) public pure returns (uint256){
    return float2Fix(float);
  }

  function updateOnchainFeeTest(uint256 onChainTxCount, uint256 currentFee) public pure returns (uint256) {
    return updateOnchainFee(onChainTxCount, currentFee);
  }
  function udateDepositFeeTest(uint32 depositCount, uint256 oldFee) public pure returns (uint256) {
    return updateDepositFee(depositCount, oldFee);
  }
}