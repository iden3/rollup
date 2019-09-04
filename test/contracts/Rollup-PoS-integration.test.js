/* eslint-disable no-underscore-dangle */
/* eslint-disable no-await-in-loop */
/* global artifacts */
/* global contract */
/* global web3 */
/* global BigInt */

const chai = require('chai');
const BalanceTree = require('./helpers/balance-tree.js');
const rollupUtils = require('./helpers/rollup-utils.js');
const utils = require('./helpers/utils.js');
const timeTravel = require('./helpers/timeTravel.js');

const { expect } = chai;
const poseidonUnit = require('../../node_modules/circomlib/src/poseidon_gencontract.js');

const TokenRollup = artifacts.require('../contracts/test/TokenRollup');
const Verifier = artifacts.require('../contracts/test/VerifierHelper');
const RollupPoS = artifacts.require('../contracts/RollupPoS');
const Rollup = artifacts.require('../contracts/Rollup');

async function getEtherBalance(address) {
  let balance = await web3.eth.getBalance(address);
  balance = web3.utils.fromWei(balance, 'ether');
  return Number(balance);
}

contract('Rollup - RollupPoS', (accounts) => {
  const {
    0: owner,
    1: id1,
    2: withdrawAddress,
    3: tokenList,
    4: operator1,
  } = accounts;

  let balanceTree;
  let fillingOnChainTest;
  let minningOnChainTest;

  const tokenId = 0;

  const hashChain = [];
  const slotPerEra = 20;
  const blocksPerSlot = 100;
  const blockPerEra = slotPerEra * blocksPerSlot;
  const amountToStake = 2;

  // BabyJub public key
  const Ax = BigInt(30890499764467592830739030727222305800976141688008169211302);
  const Ay = BigInt(19826930437678088398923647454327426275321075228766562806246);

  // tokenRollup initial amount
  const tokenInitialAmount = 50;
  const initialMsg = 'rollup';

  let insPoseidonUnit;
  let insTokenRollup;
  let insRollupPoS;
  let insRollup;
  let insVerifier;

  before(async () => {
    // Deploy poseidon
    const C = new web3.eth.Contract(poseidonUnit.abi);
    insPoseidonUnit = await C.deploy({ data: poseidonUnit.createCode() })
      .send({ gas: 2500000, from: owner });

    // Deploy TokenRollup
    insTokenRollup = await TokenRollup.new(id1, tokenInitialAmount);

    // Deploy Verifier
    insVerifier = await Verifier.new();

    // Deploy Rollup test
    insRollup = await Rollup.new(insVerifier.address, insPoseidonUnit._address, { from: owner });

    // Deploy Staker manager
    insRollupPoS = await RollupPoS.new(insRollup.address);

    // Init balance tree
    balanceTree = await BalanceTree.newBalanceTree();

    // Create hash chain for the operator
    hashChain.push(web3.utils.keccak256(initialMsg));
    for (let i = 1; i < 5; i++) {
      hashChain.push(web3.utils.keccak256(hashChain[i - 1]));
    }
    // send ether to RollupPoS
    // await insRollupPoS.sendTransaction({ from: accounts[13], value: 10000000000000000000 });
    // const bal = await getEtherBalance(insRollupPoS.address);
    // console.log('balance insRollupPoS', bal);
  });

  it('Initialization', async () => {
    // Add forge batch mechanism
    await insRollup.loadForgeBatchMechanism(insRollupPoS.address, { from: owner });
    // Add token to rollup token list
    await insRollup.addToken(insTokenRollup.address,
      { from: tokenList, value: web3.utils.toWei('1', 'ether') });

    // Add operator to PoS
    await insRollupPoS.addOperator(hashChain[4],
      { from: operator1, value: web3.utils.toWei(amountToStake.toString(), 'ether') });
  });

  it('Deposit', async () => {
    const depositAmount = 10;
    await insTokenRollup.approve(insRollup.address, depositAmount, { from: id1 });

    const resDeposit = await insRollup.deposit(depositAmount, tokenId, [Ax.toString(), Ay.toString()],
      withdrawAddress, { from: id1, value: web3.utils.toWei('1', 'ether') });

    // Get event 'Deposit' data
    const resId = BigInt(resDeposit.logs[0].args.idBalanceTree);
    const resDepositAmount = BigInt(resDeposit.logs[0].args.depositAmount);
    const resTokenId = BigInt(resDeposit.logs[0].args.tokenId);
    const resAx = BigInt(resDeposit.logs[0].args.Ax);
    const resAy = BigInt(resDeposit.logs[0].args.Ay);
    const resWithdrawAddress = BigInt(resDeposit.logs[0].args.withdrawAddress);

    // create balance tree and add leaf
    balanceTree = await BalanceTree.newBalanceTree();
    await balanceTree.addId(resId, resDepositAmount,
      resTokenId, resAx, resAy, resWithdrawAddress, BigInt(0));

    // Calculate Deposit hash given the events triggered
    const calcFilling = rollupUtils.hashDeposit(resId, resDepositAmount, resTokenId, resAx,
      resAy, resWithdrawAddress, BigInt(0));

    // calculate filling on chain hash by the operator
    let fillingOnChainTxsHash = BigInt(0);
    fillingOnChainTxsHash = utils.hash([fillingOnChainTxsHash, calcFilling]);

    // Update on-chain hashes
    fillingOnChainTest = fillingOnChainTxsHash.toString();
    minningOnChainTest = 0;
  });

  it('Forge batches by operator PoS', async () => {
    const proofA = ['0', '0'];
    const proofB = [['0', '0'], ['0', '0']];
    const proofC = ['0', '0'];
    // move forward block number to allow the operator to forge a batch
    let currentBlock = await web3.eth.getBlockNumber();
    const genesisBlock = await insRollupPoS.genesisBlock();
    await timeTravel.addBlocks(genesisBlock - currentBlock);
    currentBlock = await web3.eth.getBlockNumber();
    await timeTravel.addBlocks(blockPerEra);
    currentBlock = await web3.eth.getBlockNumber();
    await timeTravel.addBlocks(blockPerEra);
    currentBlock = await web3.eth.getBlockNumber();

    // build inputs
    const oldStateRoot = BigInt(0).toString();
    const newStateRoot = BigInt(0).toString();
    const newExitRoot = BigInt(0).toString();
    const onChainHash = BigInt(0).toString();
    const feePlan = [BigInt(0).toString(), BigInt(0).toString()];
    const nTxPerToken = BigInt(0).toString();

    const offChainTx = rollupUtils.createOffChainTx(1);
    const offChainHash = offChainTx.hashOffChain.toString();
    const compressedTxs = offChainTx.bytesTx;

    let inputs = [
      oldStateRoot,
      newStateRoot,
      newExitRoot,
      onChainHash,
      offChainHash,
      feePlan[0],
      feePlan[1],
      nTxPerToken,
    ];

    // Check balances
    const balOpBeforeForge = await getEtherBalance(operator1);
    // Forge genesis batch by operator 1
    await insRollupPoS.forgeBatchPoS(hashChain[3], proofA, proofB,
      proofC, inputs, compressedTxs, { from: operator1 });
    // Update on-chain hashes
    minningOnChainTest = fillingOnChainTest;
    fillingOnChainTest = BigInt(0).toString();

    // build inputs
    inputs = [
      oldStateRoot,
      balanceTree.getRoot().toString(),
      newExitRoot,
      minningOnChainTest,
      offChainHash,
      feePlan[0],
      feePlan[1],
      nTxPerToken,
    ];

    // Forge batch by operator 1
    await insRollupPoS.forgeBatchPoS(hashChain[2], proofA, proofB,
      proofC, inputs, compressedTxs, { from: operator1 });

    // Check balances
    const balOpAfterForge = await getEtherBalance(operator1);
    expect(Math.ceil(balOpBeforeForge) + 1).to.be.equal(Math.ceil(balOpAfterForge));
  });
});
