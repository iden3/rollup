pragma solidity ^0.5.0;

import '../Rollup.sol';

contract RollupTest is Rollup {

  constructor(address _verifier, address _poseidon, uint _maxTx, uint _maxOnChainTx)
    Rollup(_verifier, _poseidon, _maxTx, _maxOnChainTx) public {}

  function forgeBatch(
        address payable beneficiaryAddress,
        uint[2] calldata proofA,
        uint[2][2] calldata proofB,
        uint[2] calldata proofC,
        uint[8] calldata input,
        bytes calldata compressedTxs
    ) external {
        // Verify old state roots
        require(bytes32(input[oldStateRootInput]) == stateRoots[getStateDepth()],
            'old state root does not match current state root');

        // Verify on-chain hash
        require(input[onChainHashInput] == miningOnChainTxsHash,
            'on-chain hash does not match current filling on-chain hash');

        // Verify all off-chain are committed on the public zk-snark input
        uint256 offChainTxHash = hashOffChainTx(compressedTxs, MAX_TX);
        require(offChainTxHash == input[offChainHashInput],
            'off chain tx does not match its public hash');

        // Verify zk-snark circuit
        require(verifier.verifyProof(proofA, proofB, proofC, input) == true,
            'zk-snark proof is not valid');

        // Calculate fees and pay them
        bytes32[2] memory feePlan = [bytes32(input[feePlanCoinsInput]), bytes32(input[feePlanFeesInput])];
        bytes32 nTxPerToken = bytes32(input[nTxperTokenInput]);

        for (uint i = 0; i < 16; i++) {
            (uint tokenId, uint totalTokenFee) = calcTokenTotalFee(bytes32(feePlan[0]), bytes32(feePlan[1]),
            bytes32(nTxPerToken), i);

            if(totalTokenFee != 0) {
                require(withdrawToken(uint32(tokenId), beneficiaryAddress, totalTokenFee),
                    'Fail ERC20 withdraw');
            }
        }

        // Pay onChain transactions fees
        uint payOnChainFees = totalMinningOnChainFee;
        beneficiaryAddress.transfer(payOnChainFees);

        // Update state roots
        stateRoots.push(bytes32(input[1]));

        // Update exit roots
        exitRoots.push(bytes32(input[2]));

        // Clean fillingOnChainTxsHash an its fees
        miningOnChainTxsHash = fillingOnChainTxsHash;
        fillingOnChainTxsHash = 0;
        totalMinningOnChainFee = totalFillingOnChainFee;
        totalFillingOnChainFee = 0;

        // Update number of on-chain transactions
        currentOnChainTx = 0;

        // event with all compressed transactions given its batch number
        emit ForgeBatch(getStateDepth() - 1, block.number);
    }

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

    require(bytes32(oldStateRoot) == stateRoots[getStateDepth()], 'old state root does not match current state root');
    // Verify on-chain hash
    require(onChainHash == miningOnChainTxsHash, 'on-chain hash does not match current filling on-chain hash');

    // Verify all off-chain are commited on the public zk-snark input
    uint256 offChainTxHash = hashOffChainTx(compressedTxs, MAX_TX);
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

    // Update number of on-chain transactions
    currentOnChainTx = 0;

    // event with all compressed transactions given its batch number
    emit ForgeBatch(getStateDepth() - 1, block.number);
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