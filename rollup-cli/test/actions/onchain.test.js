/* eslint-disable no-underscore-dangle */
/* eslint-disable no-use-before-define */
/* eslint-disable consistent-return */
/* eslint-disable no-await-in-loop */
/* global artifacts */
/* global contract */
/* global web3 */

const fs = require('fs');
const { expect } = require('chai');
const poseidonUnit = require('circomlib/src/poseidon_gencontract');
const SMTMemDB = require('circomlib/src/smt_memdb');
const path = require('path');

const { ForgerTest } = require('../helpers/helpers');
const { Wallet } = require('../../src/utils/wallet.js');
const RollupDB = require('../../../js/rollupdb');
const { createWallet, deleteResources } = require('../integration-test/config/build-resources');
const {
    depositTx, depositOnTopTx, withdrawTx, forceWithdrawTx, transferTx, depositAndTransferTx,
} = require('../../src/utils/cli-utils');

const Verifier = artifacts.require('../../../../contracts/test/VerifierHelper');
const RollupTest = artifacts.require('../../../../contracts/test/RollupTest');
const TokenRollup = artifacts.require('../../../../contracts/test/TokenRollup');

const walletPathDefault = path.join(__dirname, '../integration-test/resources/wallet-test.json');

const gasLimit = 5000000;
const gasMultiplier = 1;

contract('Rollup', async (accounts) => {
    let insPoseidonUnit;
    let insTokenRollup;
    let insRollupTest;
    let insVerifier;
    let walletEth;
    let rollupDB;
    let db;
    const nLevels = 24;
    let forgerTest;

    const maxTx = 10;
    const maxOnChainTx = 6;
    const tokenInitialAmount = 1000;
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
    let walletRollup;

    const tokenId = 0;
    const wallets = [];


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

        db = new SMTMemDB();
        rollupDB = await RollupDB(db);

        abi = RollupTest.abi;
        UrlOperator = 'http://127.0.0.1:9000';
        addressSC = insRollupTest.address;

        // Load encrypted wallet from file
        walletJson = JSON.parse(fs.readFileSync(walletPathDefault, 'utf8'));
        walletRollup = await Wallet.fromEncryptedJson(walletJson, password);
        walletEth = walletRollup.ethWallet.wallet;

        forgerTest = new ForgerTest(rollupDB, maxTx, nLevels, beneficiary, insRollupTest);

        for (let i = 0; i < 2; i++) {
            const newWallet = await Wallet.createRandom();
            wallets.push(
                {
                    walletEth: newWallet.ethWallet.wallet,
                    walletJson: await newWallet.toEncryptedJson('foo'),
                    walletBaby: newWallet.babyjubWallet,
                },
            );
        }
    });

    it('Distribute token rollup & funds', async () => {
        web3.eth.sendTransaction({ to: walletEth.address, from: providerfunds, value: web3.utils.toWei('5', 'ether') });
        web3.eth.sendTransaction({ to: wallets[0].walletEth.address, from: providerfunds, value: web3.utils.toWei('5', 'ether') });
        web3.eth.sendTransaction({ to: wallets[1].walletEth.address, from: providerfunds, value: web3.utils.toWei('5', 'ether') });
        await insTokenRollup.transfer(walletEth.address, 50, { from: id1 });
        await insTokenRollup.transfer(wallets[0].walletEth.address, 50, { from: id1 });
        await insTokenRollup.transfer(wallets[1].walletEth.address, 50, { from: id1 });
    });

    it('Rollup token listing', async () => {
        // Check balances token
        const resWalletEth = await insTokenRollup.balanceOf(walletEth.address);
        const resId1 = await insTokenRollup.balanceOf(id1);
        expect(resWalletEth.toString()).to.be.equal('50');
        expect(resId1.toString()).to.be.equal('850');

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

        await forgerTest.forgeBatch();

        // Forge block with deposit transaction

        await forgerTest.forgeBatch(event);

        forgerTest.checkBatchNumber(event);
    });

    it('Deposit on top and forge it', async () => {
        const onTopAmount = 5;
        const babyjubReceiver = walletRollup.babyjubWallet.publicKeyCompressed.toString('hex');

        const tx = {
            from: walletEth.address,
            gasLimit: web3.utils.toHex(800000),
            gasPrice: web3.utils.toHex(web3.utils.toWei('10', 'gwei')),
            to: insTokenRollup.address,
            data: insTokenRollup.contract.methods.approve(insRollupTest.address, onTopAmount).encodeABI(),
        };


        const signPromise = await web3.eth.accounts.signTransaction(tx, walletEth.privateKey);
        await web3.eth.sendSignedTransaction(signPromise.rawTransaction);

        await depositOnTopTx(web3.currentProvider.host, addressSC, onTopAmount, tokenId, babyjubReceiver,
            walletJson, password, abi, gasLimit, gasMultiplier);

        const event = await insRollupTest.getPastEvents('OnChainTx');
        // Check token balances for walletEth and rollup smart contract
        const resRollup = await insTokenRollup.balanceOf(insRollupTest.address);
        const reswalletEth = await insTokenRollup.balanceOf(walletEth.address);
        expect(resRollup.toString()).to.be.equal('15');
        expect(reswalletEth.toString()).to.be.equal('35');

        await forgerTest.forgeBatch();

        await forgerTest.forgeBatch(event);
        // create balance tree and add leaf

        forgerTest.checkBatchNumber(event);
    });

    it('Should add force withdraw', async () => {
        // Steps:
        // - Transaction to force withdraw 'TokenRollup' from 'walletEth' to 'rollup smart contract'(owner)
        // - Get event data
        // - Update rollupTree
        // - forge blocks to include force withdraw
        // - it creates an exit root, it is created

        const amount = 10;

        await forceWithdrawTx(web3.currentProvider.host, addressSC, tokenId, amount,
            walletJson, password, abi, gasLimit, gasMultiplier);

        // forge block with no transactions
        // forge block force withdraw
        // Simulate exit tree to retrieve siblings
        const event = await insRollupTest.getPastEvents('OnChainTx');

        await forgerTest.forgeBatch();

        await forgerTest.forgeBatch(event);

        forgerTest.checkBatchNumber(event);
    });

    it('Should withdraw tokens', async () => {
        // Steps:
        // - Get data from 'exitTree'
        // - Transaction to withdraw amount indicated in previous step

        // Note that `amount` on the exit is hardcoded on dummy api-client
        const numExitRoot = 6;

        await withdrawTx(web3.currentProvider.host, addressSC, tokenId,
            walletJson, password, abi, UrlOperator, numExitRoot, gasLimit, gasMultiplier);

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
        const tx = {
            from: wallets[0].walletEth.address,
            gasLimit: web3.utils.toHex(800000),
            gasPrice: web3.utils.toHex(web3.utils.toWei('10', 'gwei')),
            to: insTokenRollup.address,
            data: insTokenRollup.contract.methods.approve(insRollupTest.address, depositAmount).encodeABI(),
        };

        const signPromise = await web3.eth.accounts.signTransaction(tx, wallets[0].walletEth.privateKey);
        await web3.eth.sendSignedTransaction(signPromise.rawTransaction);

        await depositTx(web3.currentProvider.host, addressSC, depositAmount, tokenId,
            wallets[0].walletJson, password, wallets[0].walletEth.address, abi, gasLimit, gasMultiplier);

        const event = await insRollupTest.getPastEvents('OnChainTx');

        // Check token balances for walletEth and rollup smart contract
        const resRollup = await insTokenRollup.balanceOf(insRollupTest.address);
        const resWalletEth = await insTokenRollup.balanceOf(wallets[0].walletEth.address);
        expect(resRollup.toString()).to.be.equal('15');
        expect(resWalletEth.toString()).to.be.equal('40');

        await forgerTest.forgeBatch();

        // Forge block with deposit transaction
        await forgerTest.forgeBatch(event);

        forgerTest.checkBatchNumber(event);
    });
    it('Should transfer', async () => {
        // Steps:
        // - Transaction onChain performing a "send" offchain Tx

        const amount = 10;
        const babyjubReceiver = wallets[0].walletBaby.publicKeyCompressed.toString('hex');

        // from 1 to 2
        await transferTx(web3.currentProvider.host, addressSC, amount, tokenId, babyjubReceiver,
            walletJson, password, abi, gasLimit, gasMultiplier);

        const event = await insRollupTest.getPastEvents('OnChainTx');
        await forgerTest.forgeBatch();

        // Forge block with deposit transaction
        await forgerTest.forgeBatch(event);

        forgerTest.checkBatchNumber(event);
    });
    it('Should DepositAndTransfer', async () => {
        // Steps:
        // - Combine both deposit and transfer deposit from wallet.Eth

        const depositAmount = 10;
        const amount = 5;
        const babyjubReceiver = wallets[0].walletBaby.publicKeyCompressed.toString('hex');

        const tx = {
            from: wallets[1].walletEth.address,
            gasLimit: web3.utils.toHex(800000),
            gasPrice: web3.utils.toHex(web3.utils.toWei('10', 'gwei')),
            to: insTokenRollup.address,
            data: insTokenRollup.contract.methods.approve(insRollupTest.address, depositAmount).encodeABI(),
        };

        const signPromise = await web3.eth.accounts.signTransaction(tx, wallets[1].walletEth.privateKey);
        await web3.eth.sendSignedTransaction(signPromise.rawTransaction);

        await depositAndTransferTx(web3.currentProvider.host, addressSC, depositAmount,
            amount, tokenId, babyjubReceiver, wallets[1].walletJson, password, wallets[1].walletEth.address, abi, gasLimit, gasMultiplier);
        const event = await insRollupTest.getPastEvents('OnChainTx');

        // Check token balances for walletEth and rollup smart contract
        const resRollup = await insTokenRollup.balanceOf(insRollupTest.address);
        const resWalletEth = await insTokenRollup.balanceOf(wallets[1].walletEth.address);
        expect(resRollup.toString()).to.be.equal('25');
        expect(resWalletEth.toString()).to.be.equal('40');

        await forgerTest.forgeBatch();

        // Forge block with deposit transaction
        await forgerTest.forgeBatch(event);

        forgerTest.checkBatchNumber(event);
    });

    after(async () => {
        await deleteResources();
    });
});
