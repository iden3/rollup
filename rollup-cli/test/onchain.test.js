/* eslint-disable no-underscore-dangle */
/* eslint-disable no-use-before-define */
/* eslint-disable consistent-return */
/* global artifacts */
/* global contract */
/* global web3 */
/* global BigInt */

const fs = require('fs');
const chai = require('chai');
const poseidonUnit = require('circomlib/src/poseidon_gencontract');
const SMTMemDB = require('circomlib/src/smt_memdb');
const abiDecoder = require('abi-decoder');
const path = require('path');

const { Wallet } = require('../src/wallet.js');
const rollupUtils = require('../../rollup-utils/rollup-utils.js');
const RollupDB = require('../../js/rollupdb');
const { createWallet, deleteResources } = require('./config/build-resources');
const { buildInputSm } = require('../../rollup-operator/src/utils');
const {
    depositTx, depositOnTopTx, withdrawTx, forceWithdrawTx, transferTx, depositAndTransferTx,
} = require('../src/cli-utils');

const walletPathDefault = path.join(__dirname, './resources/wallet-test.json');
const { expect } = chai;

const Verifier = artifacts.require('../../../../contracts/test/VerifierHelper');
const RollupTest = artifacts.require('../../../../contracts/test/RollupTest');
const TokenRollup = artifacts.require('../../../../contracts/test/TokenRollup');

abiDecoder.addABI(RollupTest.abi);

const proofA = ['0', '0'];
const proofB = [['0', '0'], ['0', '0']];
const proofC = ['0', '0'];
const gasLimit = 5000000;
const gasMultiplier = 1;

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
    const nLevels = 24;

    const maxTx = 10;
    const maxOnChainTx = 6;
    const tokenInitialAmount = 100;
    const {
        0: owner,
        1: id1,
        2: tokenList,
        3: beneficiary,
        4: providerfunds,
        5: feeTokenAddress,
    } = accounts;

    let addressSC;
    const password = 'foo';
    let abi;
    let UrlOperator;
    let walletJson;

    let walletJsonTest;
    let walletEthTest;

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
            maxTx, maxOnChainTx, feeTokenAddress);


        walletJson = JSON.parse(fs.readFileSync(walletPathDefault, 'utf8'));
        const walletRollup = await Wallet.fromEncryptedJson(walletJson, password);
        walletEth = walletRollup.ethWallet.wallet;

        db = new SMTMemDB();
        rollupDB = await RollupDB(db);

        abi = RollupTest.abi;
        UrlOperator = 'http://127.0.0.1:9000';
        addressSC = insRollupTest.address;

        const walletTest = await Wallet.createRandom();
        walletEthTest = walletTest.ethWallet.wallet;
        walletJsonTest = await walletTest.toEncryptedJson('foo');
    });

    it('Distribute token rollup & funds', async () => {
        web3.eth.sendTransaction({ to: walletEth.address, from: providerfunds, value: web3.utils.toWei('5', 'ether') });// provide funds to our account
        web3.eth.sendTransaction({ to: walletEthTest.address, from: providerfunds, value: web3.utils.toWei('5', 'ether') });// provide funds to test account
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
    // - Add leaf to balance tree
    // - Check 'filling on-chain' hash

        const depositAmount = 10;
        const tokenId = 0;

        const tx = {
            from: walletEth.address,
            gasLimit: web3.utils.toHex(800000),
            gasPrice: web3.utils.toHex(web3.utils.toWei('10', 'gwei')),
            to: insTokenRollup.address,
            data: insTokenRollup.contract.methods.approve(insRollupTest.address, depositAmount).encodeABI(),
        };

        const signPromise = await web3.eth.accounts.signTransaction(tx, walletEth.privateKey);
        await web3.eth.sendSignedTransaction(signPromise.rawTransaction);

        await depositTx(web3.currentProvider.host, addressSC, depositAmount, tokenId,
            walletJson, password, walletEth.address, abi, gasLimit, gasMultiplier);

        const event = await insRollupTest.getPastEvents('OnChainTx');

        // Check token balances for walletEth and rollup smart contract
        const resRollup = await insTokenRollup.balanceOf(insRollupTest.address);
        const resWalletEth = await insTokenRollup.balanceOf(walletEth.address);
        expect(resRollup.toString()).to.be.equal('10');
        expect(resWalletEth.toString()).to.be.equal('40');

        await forgeBlock();

        // Forge block with deposit transaction

        await forgeBlock(event);

        checkBatchNumber(event);
    });

    it('Deposit on top and forge it', async () => {
        const onTopAmount = 5;
        const tokenId = 0;
        const idFrom = 1;

        const tx = {
            from: walletEth.address,
            gasLimit: web3.utils.toHex(800000),
            gasPrice: web3.utils.toHex(web3.utils.toWei('10', 'gwei')),
            to: insTokenRollup.address,
            data: insTokenRollup.contract.methods.approve(insRollupTest.address, onTopAmount).encodeABI(),
        };


        const signPromise = await web3.eth.accounts.signTransaction(tx, walletEth.privateKey);
        await web3.eth.sendSignedTransaction(signPromise.rawTransaction);

        await depositOnTopTx(web3.currentProvider.host, addressSC, onTopAmount, tokenId,
            walletJson, password, abi, idFrom, gasLimit, gasMultiplier);

        const event = await insRollupTest.getPastEvents('OnChainTx');
        // Check token balances for walletEth and rollup smart contract
        const resRollup = await insTokenRollup.balanceOf(insRollupTest.address);
        const reswalletEth = await insTokenRollup.balanceOf(walletEth.address);
        expect(resRollup.toString()).to.be.equal('15');
        expect(reswalletEth.toString()).to.be.equal('35');

        await forgeBlock();

        await forgeBlock(event);
        // create balance tree and add leaf

        checkBatchNumber(event);
    });

    it('Should add force withdraw', async () => {
        // Steps:
        // - Transaction to force withdraw 'TokenRollup' from 'walletEth' to 'rollup smart contract'(owner)
        // - Get event data
        // - Update rollupTree
        // - forge blocks to include force withdraw
        // - it creates an exit root, it is created

        const amount = 10;
        const idFrom = 1;

        await forceWithdrawTx(web3.currentProvider.host, addressSC, amount,
            walletJson, password, abi, idFrom, gasLimit, gasMultiplier);

        // forge block with no transactions
        // forge block force withdraw
        // Simulate exit tree to retrieve siblings
        const event = await insRollupTest.getPastEvents('OnChainTx');

        await forgeBlock();

        await forgeBlock(event);

        checkBatchNumber(event);
    });

    it('Should withdraw tokens', async () => {
        // Steps:
        // - Get data from 'exitTree'
        // - Transaction to withdraw amount indicated in previous step

        // Note that `amount` on the exit is hardcoded on dummy api-client
        const idFrom = 1;
        const numExitRoot = 6;

        await withdrawTx(web3.currentProvider.host, addressSC,
            walletJson, password, abi, UrlOperator, idFrom, numExitRoot, gasLimit, gasMultiplier);

        const resRollup = await insTokenRollup.balanceOf(insRollupTest.address);
        const reswalletEth = await insTokenRollup.balanceOf(walletEth.address);
        expect(resRollup.toString()).to.be.equal('5');
        expect(reswalletEth.toString()).to.be.equal('45');
    });

    it('Second deposit to have more leafs in tree', async () => {
        // Steps:
        // - Transaction to deposit 'TokenRollup' from 'walletEth' to 'rollup smart contract'(owner)
        // - Check 'tokenRollup' balances
        // - Add leaf to balance tree
        // - Check 'filling on-chain' hash

        const depositAmount = 10;
        const tokenId = 0;

        const tx = {
            from: walletEth.address,
            gasLimit: web3.utils.toHex(800000),
            gasPrice: web3.utils.toHex(web3.utils.toWei('10', 'gwei')),
            to: insTokenRollup.address,
            data: insTokenRollup.contract.methods.approve(insRollupTest.address, depositAmount).encodeABI(),
        };

        const signPromise = await web3.eth.accounts.signTransaction(tx, walletEth.privateKey);
        await web3.eth.sendSignedTransaction(signPromise.rawTransaction);

        await depositTx(web3.currentProvider.host, addressSC, depositAmount, tokenId,
            walletJson, password, walletEth.address, abi, gasLimit, gasMultiplier);

        const event = await insRollupTest.getPastEvents('OnChainTx');

        // Check token balances for walletEth and rollup smart contract
        const resRollup = await insTokenRollup.balanceOf(insRollupTest.address);
        const resWalletEth = await insTokenRollup.balanceOf(walletEth.address);
        expect(resRollup.toString()).to.be.equal('15');
        expect(resWalletEth.toString()).to.be.equal('35');

        await forgeBlock();

        // Forge block with deposit transaction
        await forgeBlock(event);

        checkBatchNumber(event);
    });
    it('Should transfer', async () => {
        // Steps:
        // - Transaction onChain performing a "send" offchain Tx
        const amount = 10;
        const tokenId = 0;
        const fromId = 1;
        const toId = 2;
        // from 1 to 2
        await transferTx(web3.currentProvider.host, addressSC, amount, tokenId,
            walletJson, password, abi, fromId, toId, gasLimit, gasMultiplier);

        const event = await insRollupTest.getPastEvents('OnChainTx');
        await forgeBlock();

        // Forge block with deposit transaction
        await forgeBlock(event);

        checkBatchNumber(event);
    });
    it('Should DepositAndTransfer', async () => {
        // Steps:
        // - Combine both deposit and transfer deposit from wallet.Eth
        const depositAmount = 10;
        const tokenId = 0;
        const amount = 5;
        const toId = 2;

        const tx = {
            from: walletEth.address,
            gasLimit: web3.utils.toHex(800000),
            gasPrice: web3.utils.toHex(web3.utils.toWei('10', 'gwei')),
            to: insTokenRollup.address,
            data: insTokenRollup.contract.methods.approve(insRollupTest.address, depositAmount).encodeABI(),
        };

        const signPromise = await web3.eth.accounts.signTransaction(tx, walletEth.privateKey);
        await web3.eth.sendSignedTransaction(signPromise.rawTransaction);

        await depositAndTransferTx(web3.currentProvider.host, addressSC, depositAmount,
            amount, tokenId, walletJson, password, walletEth.address, abi, toId, gasLimit, gasMultiplier);
        const event = await insRollupTest.getPastEvents('OnChainTx');

        // Check token balances for walletEth and rollup smart contract
        const resRollup = await insTokenRollup.balanceOf(insRollupTest.address);
        const resWalletEth = await insTokenRollup.balanceOf(walletEth.address);
        expect(resRollup.toString()).to.be.equal('25');
        expect(resWalletEth.toString()).to.be.equal('25');

        await forgeBlock();

        // Forge block with deposit transaction
        await forgeBlock(event);

        checkBatchNumber(event);
    });

    it('Should Deposit and give ownership to another account', async () => {
        // Steps:
        // - Transaction deposit from 'walletEth' but owner is walletEthTest
        const depositAmount = 10;
        const tokenId = 0;

        const tx = {
            from: walletEth.address,
            gasLimit: web3.utils.toHex(800000),
            gasPrice: web3.utils.toHex(web3.utils.toWei('10', 'gwei')),
            to: insTokenRollup.address,
            data: insTokenRollup.contract.methods.approve(insRollupTest.address, depositAmount).encodeABI(),
        };

        const signPromise = await web3.eth.accounts.signTransaction(tx, walletEth.privateKey);
        await web3.eth.sendSignedTransaction(signPromise.rawTransaction);

        await depositTx(web3.currentProvider.host, addressSC, depositAmount, tokenId,
            walletJson, password, walletEthTest.address, abi, gasLimit, gasMultiplier);

        const event = await insRollupTest.getPastEvents('OnChainTx');

        // Check token balances for walletEth and rollup smart contract
        const resRollup = await insTokenRollup.balanceOf(insRollupTest.address);
        const resWalletEth = await insTokenRollup.balanceOf(walletEth.address);
        expect(resRollup.toString()).to.be.equal('35');
        expect(resWalletEth.toString()).to.be.equal('15');

        await forgeBlock();

        // Forge block with deposit transaction
        await forgeBlock(event);

        checkBatchNumber(event);
    });
    it('ShouldTransfer from wallet Test', async () => {
        // Steps:
        // - Try transfer from walletEth account with expected error
        // - Try transfer from walletEthTest account wich is the owner of the leaf
        const amount = 10;
        const tokenId = 0;
        const fromId = 4;
        const toId = 2;
        // from 1 to 2
        try {
            await transferTx(web3.currentProvider.host, addressSC, amount, tokenId,
                walletJson, password, abi, fromId, toId, gasLimit, gasMultiplier);
        } catch (error) {
            expect((error.message).includes('Sender does not match identifier balance tree')).to.be.equal(true);
        }
        await transferTx(web3.currentProvider.host, addressSC, amount, tokenId,
            walletJsonTest, password, abi, fromId, toId, gasLimit, gasMultiplier);

        const event = await insRollupTest.getPastEvents('OnChainTx');
        await forgeBlock();
        // Forge block with deposit transaction
        await forgeBlock(event);

        checkBatchNumber(event);
    });

    it('Should Deposit and transfer, with ownership to another account', async () => {
        // Steps:
        // - Perform Deposit and transfer from WalletEth but owner is walletEthTest
        const depositAmount = 10;
        const tokenId = 0;
        const amount = 5;
        const toId = 2;

        const tx = {
            from: walletEth.address,
            gasLimit: web3.utils.toHex(800000),
            gasPrice: web3.utils.toHex(web3.utils.toWei('10', 'gwei')),
            to: insTokenRollup.address,
            data: insTokenRollup.contract.methods.approve(insRollupTest.address, depositAmount).encodeABI(),
        };

        const signPromise = await web3.eth.accounts.signTransaction(tx, walletEth.privateKey);
        await web3.eth.sendSignedTransaction(signPromise.rawTransaction);

        await depositAndTransferTx(web3.currentProvider.host, addressSC, depositAmount,
            amount, tokenId, walletJson, password, walletEthTest.address, abi, toId, gasLimit, gasMultiplier);
        const event = await insRollupTest.getPastEvents('OnChainTx');

        // Check token balances for walletEth and rollup smart contract
        const resRollup = await insTokenRollup.balanceOf(insRollupTest.address);
        const resWalletEth = await insTokenRollup.balanceOf(walletEth.address);
        expect(resRollup.toString()).to.be.equal('45');
        expect(resWalletEth.toString()).to.be.equal('5');

        await forgeBlock();

        // Forge block with deposit transaction
        await forgeBlock(event);

        checkBatchNumber(event);
    });
    it('ShouldTransfer from wallet Test', async () => {
        // Steps:
        // - Try transfer from walletEth account with expected error
        // - Try transfer from walletEthTest account wich is the owner of the leaf
        const amount = 10;
        const tokenId = 0;
        const fromId = 5;
        const toId = 2;
        // from 1 to 2
        try {
            await transferTx(web3.currentProvider.host, addressSC, amount, tokenId,
                walletJson, password, abi, fromId, toId, gasLimit, gasMultiplier);
        } catch (error) {
            expect((error.message).includes('Sender does not match identifier balance tree')).to.be.equal(true);
        }
        await transferTx(web3.currentProvider.host, addressSC, amount, tokenId,
            walletJsonTest, password, abi, fromId, toId, gasLimit, gasMultiplier);

        const event = await insRollupTest.getPastEvents('OnChainTx');
        await forgeBlock();
        // Forge block with deposit transaction
        await forgeBlock(event);

        checkBatchNumber(event);
    });

    after(async () => {
        await deleteResources();
    });
});
