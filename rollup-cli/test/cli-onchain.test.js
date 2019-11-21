/* eslint-disable no-underscore-dangle */
/* eslint-disable no-use-before-define */
/* eslint-disable consistent-return */
/* eslint-disable no-restricted-syntax */
/* global artifacts */
/* global contract */
/* global web3 */
/* global BigInt */

const chai = require('chai');
const fs = require('fs');
const SMTMemDB = require('circomlib/src/smt_memdb');
const process = require('child_process');
const poseidonUnit = require('circomlib/src/poseidon_gencontract');
const abiDecoder = require('abi-decoder');
const path = require('path');

const { buildInputSm } = require('../../rollup-operator/src/utils');
const rollupUtils = require('../../rollup-utils/rollup-utils.js');
const RollupDB = require('../../js/rollupdb');
const { Wallet } = require('../src/wallet.js');
const {
    createWallet, createConfig, createRollupAbi, deleteResources,
} = require('./config/build-resources');

const Verifier = artifacts.require('../../../../contracts/test/VerifierHelper');
const RollupTest = artifacts.require('../../../../contracts/test/RollupTest');
const TokenRollup = artifacts.require('../../../../contracts/test/TokenRollup');

const { expect } = chai;
const walletPathDefault = path.join(__dirname, './resources/wallet-test.json');

abiDecoder.addABI(RollupTest.abi);

const proofA = ['0', '0'];
const proofB = [['0', '0'], ['0', '0']];
const proofC = ['0', '0'];


function buildFullInputSm(bb, beneficiary) {
    const input = buildInputSm(bb);
    return {
        beneficiary,
        proofA,
        proofB,
        proofC,
        input,
    };
}

function manageEvent(event) {
    if (event.event === 'OnChainTx') {
        const txData = rollupUtils.decodeTxData(event.args.txData);
        return {
            fromIdx: txData.fromId,
            toIdx: txData.toId,
            amount: txData.amount,
            loadAmount: BigInt(event.args.loadAmount),
            coin: txData.tokenId,
            ax: BigInt(event.args.Ax).toString(16),
            ay: BigInt(event.args.Ay).toString(16),
            ethAddress: BigInt(event.args.ethAddress).toString(),
            onChain: true,
        };
    }
}
contract('Rollup', async (accounts) => {
    async function forgeBlock(events = undefined) {
        const block = await rollupDB.buildBatch(maxTx, nLevels);
        if (events) {
            events.forEach((elem) => {
                block.addTx(manageEvent(elem));
            });
        }
        await block.build();

        const inputSm = buildFullInputSm(block, beneficiary);
        await insRollupTest.forgeBatch(inputSm.beneficiary, inputSm.proofA,
            inputSm.proofB, inputSm.proofC, inputSm.input);

        await rollupDB.consolidate(block);
    }
    function checkBatchNumber(events) {
        events.forEach((elem) => {
            const eventBatch = BigInt(elem.args.batchNumber);
            expect(eventBatch.add(BigInt(2)).toString()).to.be.equal(BigInt(rollupDB.lastBatch).toString());
        });
    }
    let insPoseidonUnit;
    let insTokenRollup;
    let insRollupTest;
    let insVerifier;
    let walletEth;
    let rollupDB;
    let db;
    let walletJson;
    const nLevels = 24;

    const maxTx = 10;
    const maxOnChainTx = 5;
    const tokenInitialAmount = 100;
    const {
        0: owner,
        1: id1,
        2: tokenList,
        3: beneficiary,
        4: providerfunds,
    } = accounts;

    let password;

    before(async () => {
        await createWallet();
        // Deploy poseidon
        const C = new web3.eth.Contract(poseidonUnit.abi);
        insPoseidonUnit = await C.deploy({ data: poseidonUnit.createCode() })
            .send({ gas: 2500000, from: owner });

        // Deploy TokenRollup
        insTokenRollup = await TokenRollup.new(id1, tokenInitialAmount);

        // Deploy Verifier
        insVerifier = await Verifier.new();

        // Deploy Rollup test
        insRollupTest = await RollupTest.new(insVerifier.address, insPoseidonUnit._address,
            maxTx, maxOnChainTx);

        db = new SMTMemDB();
        rollupDB = await RollupDB(db);
        password = 'foo';

        await createConfig(insRollupTest.address);

        walletJson = JSON.parse(fs.readFileSync(walletPathDefault, 'utf8'));
        const walletRollup = await Wallet.fromEncryptedJson(walletJson, password);

        await createRollupAbi(RollupTest.abi);

        walletEth = walletRollup.ethWallet.wallet;
    });

    it('Distribute token rollup', async () => {
        await insTokenRollup.transfer(walletEth.address, 50, { from: id1 });
    });

    it('Rollup token listing', async () => {
        // Check balances token
        const resWalletEth = await insTokenRollup.balanceOf(walletEth.address);
        const resId1 = await insTokenRollup.balanceOf(id1);
        expect(resWalletEth.toString()).to.be.equal('50');
        expect(resId1.toString()).to.be.equal('50');

        // Add token to rollup token list
        const resAddToken = await insRollupTest.addToken(insTokenRollup.address,
            { from: tokenList, value: web3.utils.toWei('1', 'ether') });

        expect(resAddToken.logs[0].event).to.be.equal('AddToken');
        expect(resAddToken.logs[0].args.tokenAddress).to.be.equal(insTokenRollup.address);
        expect(resAddToken.logs[0].args.tokenId.toString()).to.be.equal('0');
    });

    it('Deposit balance tree', async () => {
    // Steps:
    // - Transaction to deposit 'TokenRollup' from 'walletEth' to 'rollup smart contract'(owner)
    // - Check 'tokenRollup' balances
    // - Get event data
    // - Add leaf to balance tree
    // - Check 'filling on-chain' hash
        const depositAmount = 10;
        const tokenId = 0;

        web3.eth.sendTransaction({ to: walletEth.address, from: providerfunds, value: web3.utils.toWei('5', 'ether') });// provide funds to our account

        const tx = {
            from: walletEth.address,
            gasLimit: web3.utils.toHex(800000),
            gasPrice: web3.utils.toHex(web3.utils.toWei('10', 'gwei')),
            to: insTokenRollup.address,
            data: insTokenRollup.contract.methods.approve(insRollupTest.address, depositAmount).encodeABI(),
        };

        const signPromise = await web3.eth.accounts.signTransaction(tx, walletEth.privateKey);
        await web3.eth.sendSignedTransaction(signPromise.rawTransaction);

        process.execSync(`cd ..; node cli.js onchaintx --type deposit --pass ${password} --amount ${depositAmount} --tokenid ${tokenId} --dethaddr ${walletEth.address}`);
        const event = await insRollupTest.getPastEvents('OnChainTx');

        const resRollup = await insTokenRollup.balanceOf(insRollupTest.address);
        const resWalletEth = await insTokenRollup.balanceOf(walletEth.address);
        expect(resRollup.toString()).to.be.equal('10');
        expect(resWalletEth.toString()).to.be.equal('40');

        await forgeBlock();
        await forgeBlock(event);

        checkBatchNumber(event);
    });

    it('Deposit on top and forge it', async () => {
        const onTopAmount = 5;
        const tokenId = 0;

        const tx = {
            from: walletEth.address,
            gasLimit: web3.utils.toHex(800000),
            gasPrice: web3.utils.toHex(web3.utils.toWei('10', 'gwei')),
            to: insTokenRollup.address,
            data: insTokenRollup.contract.methods.approve(insRollupTest.address, onTopAmount).encodeABI(),
        };

        const signPromise = await web3.eth.accounts.signTransaction(tx, walletEth.privateKey);
        await web3.eth.sendSignedTransaction(signPromise.rawTransaction);

        process.execSync(`cd ..; node cli.js onchaintx --type depositontop --pass ${password} --amount ${onTopAmount} --tokenid ${tokenId}`);
        const event = await insRollupTest.getPastEvents('OnChainTx');

        const resRollup = await insTokenRollup.balanceOf(insRollupTest.address);
        const resId1 = await insTokenRollup.balanceOf(walletEth.address);
        expect(resRollup.toString()).to.be.equal('15');
        expect(resId1.toString()).to.be.equal('35');

        await forgeBlock();

        await forgeBlock(event);
        checkBatchNumber(event);
    });

    it('Should add force withdraw', async () => {
        // Steps:
        // - Transaction to force wothdraw 'TokenRollup' from 'id1' to 'rollup smart contract'(owner)
        // - Check 'tokenRollup' balances
        // - Get event data
        // - Update rollupTree
        // - forge blocks to include force withdraw
        // - it creates an exit root, it is created
        const amount = 10;
        // Should trigger error since id2 is the sender, does not match id1
        process.execSync(`cd ..; node cli.js onchaintx --type forcewithdraw --pass ${password} --amount ${amount}`);
        const event = await insRollupTest.getPastEvents('OnChainTx');
        // forge block with no transactions
        // forge block force withdraw
        // Simulate exit tree to retrieve siblings
        await forgeBlock();

        await forgeBlock(event);
    });

    it('Should withdraw tokens', async () => {
        // Steps:
        // - Get data from 'exitTree'
        // - Transaction to withdraw amount indicated in previous step
        // const amount = 10;
        // Note the amount of tokens is taken from dummy api-client
        const numExitRoot = 6;

        process.execSync(`cd ..; node cli.js onchaintx --type withdraw --pass ${password} --numexitroot ${numExitRoot}`);

        const resRollup = await insTokenRollup.balanceOf(insRollupTest.address);
        const reswalletEth = await insTokenRollup.balanceOf(walletEth.address);
        expect(resRollup.toString()).to.be.equal('5');
        expect(reswalletEth.toString()).to.be.equal('45');
    });

    it('Second deposit to have more leafs in tree', async () => {
        // Steps:
        // - Transaction to deposit 'TokenRollup' from 'walletEth' to 'rollup smart contract'(owner)
        // - Check 'tokenRollup' balances
        // - Get event data
        // - Add leaf to balance tree
        // - Check 'filling on-chain' hash
        const depositAmount = 10;
        const tokenId = 0;

        web3.eth.sendTransaction({ to: walletEth.address, from: providerfunds, value: web3.utils.toWei('5', 'ether') });// provide funds to our account

        const tx = {
            from: walletEth.address,
            gasLimit: web3.utils.toHex(800000),
            gasPrice: web3.utils.toHex(web3.utils.toWei('10', 'gwei')),
            to: insTokenRollup.address,
            data: insTokenRollup.contract.methods.approve(insRollupTest.address, depositAmount).encodeABI(),
        };

        const signPromise = await web3.eth.accounts.signTransaction(tx, walletEth.privateKey);
        await web3.eth.sendSignedTransaction(signPromise.rawTransaction);

        process.execSync(`cd ..; node cli.js onchaintx --type deposit --pass ${password} --amount ${depositAmount} --tokenid ${tokenId}`);
        const event = await insRollupTest.getPastEvents('OnChainTx');

        const resRollup = await insTokenRollup.balanceOf(insRollupTest.address);
        const resWalletEth = await insTokenRollup.balanceOf(walletEth.address);
        expect(resRollup.toString()).to.be.equal('15');
        expect(resWalletEth.toString()).to.be.equal('35');

        await forgeBlock();
        await forgeBlock(event);

        checkBatchNumber(event);
    });

    it('Should transfer tokens', async () => {
        // Steps:
        // - Get data from 'exitTree'
        // - Transaction to withdraw amount indicated in previous step
        const amount = 2;
        const tokenId = 0;
        const to = 2;

        process.execSync(`cd ..; node cli.js onchaintx --type TRANSFER --pass ${password} --amount ${amount} --tokenid ${tokenId} --to ${to}`);
    });

    it('Should depositAndTransfer', async () => {
        // Steps:
        // - Get data from 'exitTree'
        // - Transaction to withdraw amount indicated in previous step
        const amount = 5;
        const tokenId = 0;
        const to = 2;
        const loadamount = 10;

        const tx = {
            from: walletEth.address,
            gasLimit: web3.utils.toHex(800000),
            gasPrice: web3.utils.toHex(web3.utils.toWei('10', 'gwei')),
            to: insTokenRollup.address,
            data: insTokenRollup.contract.methods.approve(insRollupTest.address, loadamount).encodeABI(),
        };

        const signPromise = await web3.eth.accounts.signTransaction(tx, walletEth.privateKey);
        await web3.eth.sendSignedTransaction(signPromise.rawTransaction);

        process.execSync(`cd ..; node cli.js onchaintx --type DEPOSITANDTRANSFER --pass ${password} --amount ${amount} --tokenid ${tokenId} --to ${to} --loadamount ${loadamount}`);

        const resRollup = await insTokenRollup.balanceOf(insRollupTest.address);
        const reswalletEth = await insTokenRollup.balanceOf(walletEth.address);
        expect(resRollup.toString()).to.be.equal('25');
        expect(reswalletEth.toString()).to.be.equal('25');
    });

    after(async () => {
        await deleteResources();
    });
});
