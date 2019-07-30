/* eslint-disable no-underscore-dangle */
/* global artifacts */
/* global contract */
/* global web3 */
/* global BigInt */

const chai = require('chai');
const BalanceTree = require('./helpers/balance-tree.js');
const { hashArray } = require('./helpers/poseidon-utils.js');

const { expect } = chai;
const poseidonUnit = require('../../node_modules/circomlib/src/poseidon_gencontract.js');

const TokenRollup = artifacts.require('../contracts/test/TokenRollup');
const Verifier = artifacts.require('../contracts/test/VerifierHelper');
const StakerManager = artifacts.require('../contracts/StakeManager');
const Rollup = artifacts.require('../contracts/Rollup');

contract('Rollup', (accounts) => {
  let balanceTree;

  let insPoseidonUnit;
  let insTokenRollup;
  let insVerifier;
  let insStakerManager;
  let insRollup;

  // BabyJub public key
  const Ax = BigInt(30890499764467592830739030727222305800976141688008169211302);
  const Ay = BigInt(19826930437678088398923647454327426275321075228766562806246);

  // tokenRollup initial amount
  const tokenInitialAmount = 100;

  const {
    0: owner,
    1: id1,
    2: withdrawAddress,
  } = accounts;

  before(async () => {
    // Deploy poseidon
    const C = new web3.eth.Contract(poseidonUnit.abi);
    insPoseidonUnit = await C.deploy({ data: poseidonUnit.createCode() })
      .send({ gas: 2500000, from: owner });

    // Deploy verifier
    insVerifier = await Verifier.new();

    // Deploy TokenRollup
    insTokenRollup = await TokenRollup.new(id1, tokenInitialAmount);

    // Deploy rollup
    insRollup = await Rollup.new(insVerifier.address, insPoseidonUnit._address);

    // Deploy Staker manager
    insStakerManager = await StakerManager.new(insRollup.address);
  });

  it('Load Staker manager', async () => {
    await insRollup.loadStakeManager(insStakerManager.address);
    try {
      await insRollup.loadStakeManager(insStakerManager.address, { from: id1 });
    } catch (error) {
      expect((error.message).includes('caller is not the owner')).to.be.equal(true);
    }
  });

  it('Rollup token listing', async () => {
    // Check balances token
    const resOwner = await insTokenRollup.balanceOf(owner);
    const resId1 = await insTokenRollup.balanceOf(id1);
    expect(resOwner.toString()).to.be.equal('0');
    expect(resId1.toString()).to.be.equal('100');

    // Add token to rollup token list
    const resAddToken = await insRollup.addToken(insTokenRollup.address);

    expect(resAddToken.logs[0].event).to.be.equal('AddToken');
    expect(resAddToken.logs[0].args.tokenAddress).to.be.equal(insTokenRollup.address);
    expect(resAddToken.logs[0].args.tokenId.toString()).to.be.equal('0');
  });

  it('Check token address', async () => {
    // Check token address
    const resTokenAddress = await insRollup.getTokenAddress(0);
    expect(resTokenAddress).to.be.equal(insTokenRollup.address);
  });

  it('Deposit balance tree', async () => {
    // Steps:
    // - Transaction to deposit 'TokenRollup' from 'id1' to 'rollup smart contract'(owner)
    // - Check 'tokenRoullup' balances
    // - Get event data
    // - Add leaf to balance tree
    // - Check 'filling on-chain' hash

    const depositAmount = 10;
    const tokenId = 0;

    const resApprove = await insTokenRollup.approve(insRollup.address, depositAmount, { from: id1 });
    expect(resApprove.logs[0].event).to.be.equal('Approval');

    const resDeposit = await insRollup.deposit(depositAmount, tokenId, [Ax.toString(), Ay.toString()],
      withdrawAddress, { from: id1, value: web3.utils.toWei('1', 'ether') });
    expect(resDeposit.logs[0].event).to.be.equal('Deposit');

    // Check token balances for id1 and rollup smart contract
    const resRollup = await insTokenRollup.balanceOf(insRollup.address);
    const resId1 = await insTokenRollup.balanceOf(id1);
    expect(resRollup.toString()).to.be.equal('10');
    expect(resId1.toString()).to.be.equal('90');

    // Get event 'Deposit' data
    const resId = BigInt(resDeposit.logs[0].args.idBalanceTree);
    const resDepositAmount = BigInt(resDeposit.logs[0].args.depositAmount);
    const resTokenId = BigInt(resDeposit.logs[0].args.tokenId);
    const resAx = BigInt(resDeposit.logs[0].args.Ax);
    const resAy = BigInt(resDeposit.logs[0].args.Ay);
    const resWithdrawAddress = BigInt(resDeposit.logs[0].args.withdrawAddress);

    // create balance tree and add leaf
    balanceTree = await BalanceTree.newBalanceTree();
    const resAddId = await balanceTree.addId(resId, resDepositAmount,
      resTokenId, resAx, resAy, resWithdrawAddress, BigInt(0));

    // calculate filling on chain hash
    let fillingOnChainTxsHash = BigInt(0);
    fillingOnChainTxsHash = hashArray([fillingOnChainTxsHash, resAddId.hashValue]);
    console.log(fillingOnChainTxsHash);

    const resOnChainHash = await insRollup.getTest();
    console.log(BigInt(resOnChainHash).toString());

  });
});
