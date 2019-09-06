pragma solidity ^0.5.0;

import '../Rollup.sol';

contract RollupTest is Rollup {

  constructor(address _verifier, address _poseidon) Rollup(_verifier, _poseidon) public {}

  function forgeBatchTest(
    uint256 oldStateRoot,
    uint256 newStateRoot,
    uint256 newExitRoot,
    uint256 onChainHash,
    uint256[2] memory feePlan,
    bytes memory compressedTxs,
    uint256 offChainHash,
    uint256 nTxPerToken,
    address payable beneficiary
  ) public {

    // If there is no roots commited it means that it will be the genesis block
    if (stateRoots.length == 0) {
      require(oldStateRoot == 0, 'old state root does not match current state root');
    } else {
      // Verify old state roots
      require(bytes32(oldStateRoot) == stateRoots[stateRoots.length - 1], 'old state root does not match current state root');
    }

    // Verify on-chain hash
    require(onChainHash == miningOnChainTxsHash, 'on-chain hash does not match current filling on-chain hash');

    // Verify all off-chain are commited on the public zk-snark input
    uint256 offChainTxHash = hashOffChainTx(compressedTxs);
    require(offChainTxHash == offChainHash, 'off chain tx does not match its public hash');

    // Calculate fees and pay them
    for (uint i = 0; i < 16; i++) {
      uint tokenId;
      uint totalTokenFee;
      (tokenId, totalTokenFee) = calcTokenTotalFee(bytes32(feePlan[0]), bytes32(feePlan[1]),
        bytes32(nTxPerToken), i);

      if(totalTokenFee != 0) {
        require(withdrawToken(tokenId, beneficiary, totalTokenFee), 'Fail ERC20 withdraw');
      }
    }

    // Pay onChain transactions fees
    uint payOnChainFees = totalMinningOnChainFee;
    // address payable beneficiaryPayable = address(uint160(beneficiary));
    beneficiary.transfer(payOnChainFees);

    // Update state roots
    stateRoots.push(bytes32(newStateRoot));

    // Update exit roots
    exitRoots.push(bytes32(newExitRoot));

    // Clean fillingOnChainTxsHash an its fees
    miningOnChainTxsHash = fillingOnChainTxsHash;
    fillingOnChainTxsHash = 0;
    totalMinningOnChainFee = totalFillingOnChainFee;
    totalFillingOnChainFee = 0;

    // event with all compressed transactions given its batch number
    emit ForgeBatch(getStateDepth() - 1, compressedTxs);
  }

  function withdrawToken(uint tokenId, address receiver, uint amount) private returns(bool){
    return ERC20(tokenList[tokenId]).transfer(receiver, amount);
  }

  function getMinningOnChainTxsHash() public view returns (uint256) {
    return miningOnChainTxsHash;
  }

  function getFillingOnChainTxsHash() public view returns (uint256) {
    return fillingOnChainTxsHash;
  }
}