/* eslint-disable no-underscore-dangle */
/* global artifacts */
/* global contract */
/* global web3 */
/* global BigInt */

const chai = require('chai');
const BalanceTree = require('./helpers/balance-tree.js');
const utils = require('./helpers/rollup-test-utils.js');
const { hashArray } = require('./helpers/poseidon-utils.js');

const { expect } = chai;
const poseidonUnit = require('../../node_modules/circomlib/src/poseidon_gencontract.js');

const TokenRollup = artifacts.require('../contracts/test/TokenRollup');
const StakerManager = artifacts.require('../contracts/StakeManager');
const RollupTest = artifacts.require('../contracts/test/RollupTest');

contract('Rollup', (accounts) => {
  let balanceTree;
  let fillingOnChainTest;
  let minningOnChainTest;

  let insPoseidonUnit;
  let insTokenRollup;
  let insStakerManager;
  let insRollupTest;

  // BabyJub public key
  const Ax = BigInt(30890499764467592830739030727222305800976141688008169211302);
  const Ay = BigInt(19826930437678088398923647454327426275321075228766562806246);

  // tokenRollup initial amount
  const tokenInitialAmount = 100;

  const {
    0: owner,
    1: id1,
    2: withdrawAddress,
    3: tokenList,
    4: beneficiary,
  } = accounts;

  before(async () => {
    // Deploy poseidon
    const C = new web3.eth.Contract(poseidonUnit.abi);
    insPoseidonUnit = await C.deploy({ data: poseidonUnit.createCode() })
      .send({ gas: 2500000, from: owner });

    // Deploy TokenRollup
    insTokenRollup = await TokenRollup.new(id1, tokenInitialAmount);

    // Deploy Rollup test
    insRollupTest = await RollupTest.new(insPoseidonUnit._address);

    // Deploy Staker manager
    insStakerManager = await StakerManager.new(insRollupTest.address);
  });

  it('Load Staker manager', async () => {
    await insRollupTest.loadStakeManager(insStakerManager.address);
    try {
      await insRollupTest.loadStakeManager(insStakerManager.address, { from: id1 });
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
    const resAddToken = await insRollupTest.addToken(insTokenRollup.address,
      { from: tokenList, value: web3.utils.toWei('1', 'ether') });

    expect(resAddToken.logs[0].event).to.be.equal('AddToken');
    expect(resAddToken.logs[0].args.tokenAddress).to.be.equal(insTokenRollup.address);
    expect(resAddToken.logs[0].args.tokenId.toString()).to.be.equal('0');
  });

  it('Check token address', async () => {
    // Check token address
    const resTokenAddress = await insRollupTest.getTokenAddress(0);
    expect(resTokenAddress).to.be.equal(insTokenRollup.address);
  });

  it('Deposit balance tree', async () => {
    // Steps:
    // - Transaction to deposit 'TokenRollup' from 'id1' to 'rollup smart contract'(owner)
    // - Check 'tokenRollup' balances
    // - Get event data
    // - Add leaf to balance tree
    // - Check 'filling on-chain' hash

    const depositAmount = 10;
    const tokenId = 0;

    const resApprove = await insTokenRollup.approve(insRollupTest.address, depositAmount, { from: id1 });
    expect(resApprove.logs[0].event).to.be.equal('Approval');

    const resDeposit = await insRollupTest.deposit(depositAmount, tokenId, [Ax.toString(), Ay.toString()],
      withdrawAddress, { from: id1, value: web3.utils.toWei('1', 'ether') });
    expect(resDeposit.logs[0].event).to.be.equal('Deposit');

    // Check token balances for id1 and rollup smart contract
    const resRollup = await insTokenRollup.balanceOf(insRollupTest.address);
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

    // calculate filling on chain hash by the operator
    let fillingOnChainTxsHash = BigInt(0);
    fillingOnChainTxsHash = hashArray([fillingOnChainTxsHash, resAddId.hashValue]);

    const resFillingTest = await insRollupTest.fillingOnChainTxsHash();
    expect(fillingOnChainTxsHash.toString()).to.be.equal(BigInt(resFillingTest).toString());

    // Update on-chain hashes
    fillingOnChainTest = BigInt(resFillingTest).toString();
    minningOnChainTest = 0;
  });

  it('Forge genesis batch', async () => {
    // Forge first batch implies not state change at all
    // it forces the next batch to incorporate on-chain transactions
    // i.e. transaction that has been in previous step
    const oldStateRoot = BigInt(0).toString();
    const newStateRoot = BigInt(0).toString();
    const newExitRoot = BigInt(0).toString();
    const onChainHash = BigInt(0).toString();
    const feePlan = [BigInt(0).toString(), BigInt(0).toString()];

    const offChainTx = utils.createOffChainTx(1);
    const offChainHash = offChainTx.hashOffChain.toString();
    const compressedTxs = offChainTx.bytesTx;

    const nTxPerToken = BigInt(0).toString();

    const resForge = await insRollupTest.forgeBatch(oldStateRoot, newStateRoot, newExitRoot,
      onChainHash, feePlan, compressedTxs, offChainHash, nTxPerToken, beneficiary);

    expect(resForge.logs[0].event).to.be.equal('ForgeBatch');
    expect(resForge.logs[0].args.batchNumber.toString()).to.be.equal('0');
    expect(resForge.logs[0].args.offChainTx).to.be.equal(compressedTxs);

    // Update on-chain hashes
    minningOnChainTest = fillingOnChainTest;
    fillingOnChainTest = BigInt(0).toString();

    // Check minning / filling on-chain hash
    const resMinning = await insRollupTest.miningOnChainTxsHash();
    const resFilling = await insRollupTest.fillingOnChainTxsHash();

    expect(minningOnChainTest).to.be.equal(BigInt(resMinning).toString());
    expect(fillingOnChainTest).to.be.equal(BigInt(resFilling).toString());

    // Check last state root forged
    const resState = await insRollupTest.getStateRoot('0');
    expect(BigInt(resState).toString()).to.be.equal('0');
  });

  it('Forge batch', async () => {
    // Operator must introduce a new leaf into the balance tree which
    // comes from the first deposit on-chain transaction
    // It implies that the balance tree has now one leaf, therefore its
    // root must be updated

    const oldStateRoot = BigInt(0).toString();
    const newStateRoot = balanceTree.getRoot().toString();
    const newExitRoot = BigInt(0).toString(); // Assume no off-chain tx
    const onChainHash = minningOnChainTest;
    const feePlan = [BigInt(0).toString(), BigInt(0).toString()];

    const offChainTx = utils.createOffChainTx(1);
    const offChainHash = offChainTx.hashOffChain.toString();
    const compressedTxs = offChainTx.bytesTx;

    const nTxPerToken = BigInt(0).toString();

    const resForge = await insRollupTest.forgeBatch(oldStateRoot, newStateRoot, newExitRoot,
      onChainHash, feePlan, compressedTxs, offChainHash, nTxPerToken, beneficiary);

    expect(resForge.logs[0].event).to.be.equal('ForgeBatch');
    expect(resForge.logs[0].args.batchNumber.toString()).to.be.equal('1');
    expect(resForge.logs[0].args.offChainTx).to.be.equal(compressedTxs);

    // Update on-chain hashes
    minningOnChainTest = BigInt(0).toString();
    fillingOnChainTest = BigInt(0).toString();

    // Check minning / filling on-chain hash
    const resMinning = await insRollupTest.miningOnChainTxsHash();
    const resFilling = await insRollupTest.fillingOnChainTxsHash();

    expect(minningOnChainTest).to.be.equal(BigInt(resMinning).toString());
    expect(fillingOnChainTest).to.be.equal(BigInt(resFilling).toString());

    // Check last state root forged
    const resState = await insRollupTest.getStateRoot('1');
    expect(BigInt(resState).toString()).to.be.equal(newStateRoot);
  });
});
