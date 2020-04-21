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
        uint[10] calldata input,
        bytes calldata compressedOnChainTx
    ) external payable override {

      // Verify old state roots
      require(bytes32(input[oldStateRootInput]) == stateRoots[getStateDepth()],
          'old state root does not match current state root');

      // Initial index must be the final index of the last batch
      require(batchToInfo[getStateDepth()].lastLeafIndex == input[initialIdx], 'Initial index does not match');

      // Deposits that will be added in this batch
      uint64 depositOffChainLength = uint64(compressedOnChainTx.length/DEPOSIT_BYTES);
      uint32 depositCount = batchToInfo[getStateDepth()+1].depositOnChainCount;

      // Operator must pay for every off-chain deposit
      require(msg.value >= FEE_OFFCHAIN_DEPOSIT*depositOffChainLength, 'Amount deposited less than fee required');
    
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
      require(batchToInfo[getStateDepth()+1].lastLeafIndex == input[finalIdx], 'Final index does not match');

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