pragma solidity ^0.5.0;

import '../Rollup.sol';

contract RollupTest is Rollup {

  constructor(address _verifier, address _poseidon, uint _maxTx, uint _maxOnChainTx, address payable _feeTokenAddress)
    Rollup(_verifier, _poseidon, _maxTx, _maxOnChainTx, _feeTokenAddress) public {}

  function forgeBatch(
        address payable beneficiaryAddress,
        uint[2] calldata proofA,
        uint[2][2] calldata proofB,
        uint[2] calldata proofC,
        uint[8] calldata input
    ) external {
        // Verify old state roots
        require(bytes32(input[oldStateRootInput]) == stateRoots[getStateDepth()],
            'old state root does not match current state root');

        // Verify on-chain hash
        require(input[onChainHashInput] == miningOnChainTxsHash,
            'on-chain hash does not match current filling on-chain hash');

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
        emit ForgeBatch(getStateDepth(), block.number);
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