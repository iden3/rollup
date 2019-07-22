pragma solidity ^0.5.0;

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
    bool isNonExistence, bool isOld0) public view returns (bool){
    // TODO: add enable flag ?

    // Step 1: check if proof is non-existence non-empty
    uint256 newHash;
    if (isNonExistence && !isOld0) {
      // Check old key is final node
      uint exist = 0;
      uint levCounter = 0;
      while((exist == 0) && (levCounter < 24)) {
        exist = (uint8(oldKey >> levCounter) & 0x01) ^ (uint8(key >> levCounter) & 0x01);
        levCounter += 1;
      }

      if(exist == 0) {
        return false;
      }
      newHash = hashFinalNode(oldKey, oldValue);
    }

    // Step 2: Calcuate root
    uint256 nextHash = isNonExistence ? newHash : hashFinalNode(key, value);
    uint256 siblingTmp;
    for (uint256 i = siblings.length - 1; i >= 0; i--) {
     siblingTmp = siblings[i];
      bool leftRight = (uint8(key >> i) & 0x01) == 1;
      nextHash = leftRight ? hashNode(siblingTmp, nextHash)
                           : hashNode(nextHash, siblingTmp);
      if(i == 0) {
        break;
      }
    }

    // Step 3: Check root
    return root == nextHash;
  }
}