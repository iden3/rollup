pragma solidity ^0.6.1;

import '../Rollup.sol';

contract RollupTest is Rollup {

  constructor(address _verifier, address _poseidon, uint _maxTx, uint _maxOnChainTx, address payable _feeTokenAddress)
    Rollup(_verifier, _poseidon, _maxTx, _maxOnChainTx, _feeTokenAddress) public {}

  function forgeBatch(
        uint[2] calldata proofA,
        uint[2][2] calldata proofB,
        uint[2] calldata proofC,
        uint[10] calldata input,
        bytes calldata compressedOnChainTx
    ) external payable override {

      // Verify old state roots
      require(bytes32(input[oldStateRootInput]) == stateRoots[getStateDepth()],
          'old state root does not match current state root');

      // Initial index must be the final index of the last batch
      require(batchToInfo[getStateDepth()].lastLeafIndex == input[initialIdxInput], 'Initial index does not match');

      // Deposits that will be added in this batch
      uint64 depositOffChainLength = uint64(compressedOnChainTx.length/DEPOSIT_BYTES);
      uint32 depositCount = batchToInfo[getStateDepth()+1].depositOnChainCount;

      // Operator must pay for every off-chain deposit
      require(msg.value >=  depositFee * depositOffChainLength, 'Amount deposited less than fee required');
    
      // Add deposits off-chain
      for (uint32 i = 0; i < depositOffChainLength; i++) {  
          uint32 initialByte = DEPOSIT_BYTES*i;
          uint256 Ax = abi.decode(compressedOnChainTx[initialByte:initialByte+32], (uint256));
          uint256 Ay = abi.decode(compressedOnChainTx[initialByte+32:initialByte+64], (uint256));
          address ethAddress = address(abi.decode(compressedOnChainTx[initialByte+52:initialByte+84], (uint256)));
          uint32 token = uint32(abi.decode(compressedOnChainTx[initialByte+56:initialByte+88], (uint256)));
          depositCount++;
          depositOffChain(token, ethAddress, [Ax, Ay], depositCount);
      }

      // Update and verify lastLeafIndex
      batchToInfo[getStateDepth()+1].lastLeafIndex = batchToInfo[getStateDepth()].lastLeafIndex + depositCount;
      require(batchToInfo[getStateDepth()+1].lastLeafIndex == input[finalIdxInput], 'Final index does not match');

      // Verify on-chain hash
      require(input[onChainHashInput] == miningOnChainTxsHash,
       'on-chain hash does not match current mining on-chain hash');

      // Verify zk-snark circuit
      require(verifier.verifyProof(proofA, proofB, proofC, input) == true,
        'zk-snark proof is not valid');

      // curren batch filling Info
      fillingInfo storage currentFilling = fillingMap[getStateDepth()];

      // Get beneficiary address from zk-inputs 
      address payable beneficiaryAddress = address(input[beneficiaryAddressInput]);

      // Clean fillingOnChainTxsHash an its fees
      uint payOnChainFees = totalMinningOnChainFee;

      miningOnChainTxsHash = currentFilling.fillingOnChainTxsHash;
      totalMinningOnChainFee = currentFilling.totalFillingOnChainFee;

      // If the current state does not match currentFillingBatch means that
      // currentFillingBatch > getStateDepth(), and that batch fees were already updated
      if (getStateDepth() == currentFillingBatch) { 
          feeOnchainTx = updateOnchainFee(currentFilling.currentOnChainTx, feeOnchainTx);
          currentFillingBatch++;
      }
      delete fillingMap[getStateDepth()];

      // Update deposit fee
      depositFee = updateDepositFee(depositCount, depositFee);


      // Update state roots
      stateRoots.push(bytes32(input[newStateRootInput]));

      // Update exit roots
      exitRoots.push(bytes32(input[newExitRootInput]));

      // Calculate fees and pay them
      withdrawTokens(bytes32(input[feePlanCoinsInput]), bytes32(input[feeTotalsInput]),
       beneficiaryAddress);


      // Pay onChain transactions fees
      beneficiaryAddress.transfer(payOnChainFees);

      // event with all compressed transactions given its batch number
      emit ForgeBatch(getStateDepth(), block.number);
    }

  function withdrawToken(uint tokenId, address receiver, uint amount) private returns(bool){
    return IERC20(tokenList[tokenId]).transfer(receiver, amount);
  }

  function setCurrentFillingMap(uint256 onChainTx) public returns (uint256) {
    fillingMap[currentFillingBatch].currentOnChainTx = onChainTx;
  }

  function setCurrentBatchToInfo(uint256 depositsNum, uint64 lastLeaf) public returns (uint256) {
      batchToInfo[currentFillingBatch].lastLeafIndex = lastLeaf;
      batchToInfo[currentFillingBatch].depositOnChainCount = uint32(depositsNum);
  }
}