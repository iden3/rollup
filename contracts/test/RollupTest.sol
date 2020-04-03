pragma solidity ^0.6.1;

import '../Rollup.sol';

contract RollupTest is Rollup {

  constructor(address _verifier, address _poseidon, uint _maxTx, uint _maxOnChainTx, address payable _feeTokenAddress)
    Rollup(_verifier, _poseidon, _maxTx, _maxOnChainTx, _feeTokenAddress) public {}

  function forgeBatch(
        address payable beneficiaryAddress,
        uint[2] calldata proofA,
        uint[2][2] calldata proofB,
        uint[2] calldata proofC,
        uint[8] calldata input,
        uint256[] calldata compressedOnChainTx
    ) external payable override {

        // Verify old state roots
        require(bytes32(input[oldStateRootInput]) == stateRoots[getStateDepth()],
            'old state root does not match current state root');
        //add deposits off-chain
        // verify all the fields of the off-chain deposit
         uint64 depositLength = uint64(compressedOnChainTx.length/3);

        //index+deposits offchain = lastLeafIndex + depositCount of the previous batch
        uint64 currentlastLeafIndex;
        uint32 latBatchdepositCount;
        if (getStateDepth() != 0){
            currentlastLeafIndex = batchToIndex[getStateDepth()-1].lastLeafIndex + batchToIndex[getStateDepth()-1].depositCount;
            latBatchdepositCount = batchToIndex[getStateDepth()-1].depositCount;
        }
        require(msg.value >= FEE_OFFCHAIN_DEPOSIT*depositLength, 'Amount deposited less than fee required');
        for (uint256 i = 0; i < depositLength; i++) {
           depositOffChain(compressedOnChainTx[i*3],[compressedOnChainTx[i*3+1], compressedOnChainTx[i*3+2]], ++latBatchdepositCount);
        }
        //previous last Leaf index + onchain deposit in the preovious batch, + offchain deposits in current batch = new index
        batchToIndex[getStateDepth()].lastLeafIndex = currentlastLeafIndex + depositLength;
        // Verify on-chain hash
        require(input[onChainHashInput] == miningOnChainTxsHash,
            'on-chain hash does not match current mining on-chain hash');

        // Verify zk-snark circuit
        require(verifier.verifyProof(proofA, proofB, proofC, input) == true,
            'zk-snark proof is not valid');

        // Update state roots
        stateRoots.push(bytes32(input[newStateRootInput]));

        // Update exit roots
        exitRoots.push(bytes32(input[newExitRootInput]));

        // Clean fillingOnChainTxsHash an its fees
        uint payOnChainFees = totalMinningOnChainFee;

        miningOnChainTxsHash = fillingOnChainTxsHash;
        fillingOnChainTxsHash = 0;
        totalMinningOnChainFee = totalFillingOnChainFee;
        totalFillingOnChainFee = 0;

        // Update number of on-chain transactions
        currentOnChainTx = 0;

        // Calculate fees and pay them
        withdrawTokens([bytes32(input[feePlanCoinsInput]), bytes32(input[feePlanFeesInput])],
        bytes32(input[nTxperTokenInput]), beneficiaryAddress);


        // Pay onChain transactions fees
        beneficiaryAddress.transfer(payOnChainFees);

        // event with all compressed transactions given its batch number
        emit ForgeBatch(getStateDepth(), block.number);
    }

  function withdrawToken(uint tokenId, address receiver, uint amount) private returns(bool){
    return IERC20(tokenList[tokenId]).transfer(receiver, amount);
  }

  function getMinningOnChainTxsHash() public view returns (uint256) {
    return miningOnChainTxsHash;
  }

  function getFillingOnChainTxsHash() public view returns (uint256) {
    return fillingOnChainTxsHash;
  }
}