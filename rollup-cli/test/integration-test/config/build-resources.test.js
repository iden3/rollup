/* eslint-disable no-underscore-dangle */
/* eslint-disable no-use-before-define */
/* eslint-disable consistent-return */
/* eslint-disable no-restricted-syntax */
/* global artifacts */
/* global contract */
/* global web3 */

const chai = require('chai');
const fs = require('fs');
const poseidonUnit = require('circomlib/src/poseidon_gencontract');
const { Wallet } = require('../../../src/utils/wallet.js');

const { expect } = chai;
const Verifier = artifacts.require('../../../../contracts/test/VerifierHelper');
const RollupTest = artifacts.require('../../../../contracts/test/RollupTest');
const TokenRollup = artifacts.require('../../../../contracts/test/TokenRollup');
const configPath = '../src/resources/';

contract('Rollup', async (accounts) => {
    let insPoseidonUnit;
    let insTokenRollup;
    let insRollupTest;
    let insVerifier;
    let walletEth;
    const maxTx = 10;
    const maxOnChainTx = 5;
    const tokenInitialAmount = 1000;
    const {
        0: owner,
        1: id1,
        2: tokenList,
    } = accounts;

    let password;

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
        insRollupTest = await RollupTest.new(insVerifier.address, insPoseidonUnit._address,
            maxTx, maxOnChainTx);

        password = 'foo';

        const configJson = {
            wallet: './src/resources/wallet.json',
            operator: 'http://127.0.0.1:9000',
            address: insRollupTest.address,
            nodeEth: 'http://localhost:8545',
            abi: './src/resources/rollupabi.json',
            id: '1',
        };
        fs.writeFileSync(`${configPath}config.json`, JSON.stringify(configJson, null, 1), 'utf-8');
        fs.writeFileSync(`${configPath}rollupabi.json`, JSON.stringify(insRollupTest.abi, null, 1), 'utf-8');

        const walletRollup = await Wallet.createRandom();
        const walletJson = await walletRollup.toEncryptedJson(password);
        fs.writeFileSync(`${configPath}wallet.json`, JSON.stringify(walletJson, null, 1), 'utf-8');
        walletEth = walletRollup.ethWallet.wallet;
    });

    it('Distribute token rollup', async () => {
        await insTokenRollup.transfer(walletEth.address, 100, { from: id1 });
    });

    it('Rollup token listing', async () => {
        // Check balances token
        const resWalletEth = await insTokenRollup.balanceOf(walletEth.address);
        const resId1 = await insTokenRollup.balanceOf(id1);
        expect(resWalletEth.toString()).to.be.equal('100');
        expect(resId1.toString()).to.be.equal('900');

        // Add token to rollup token list
        const resAddToken = await insRollupTest.addToken(insTokenRollup.address,
            { from: tokenList, value: web3.utils.toWei('1', 'ether') });

        expect(resAddToken.logs[0].event).to.be.equal('AddToken');
        expect(resAddToken.logs[0].args.tokenAddress).to.be.equal(insTokenRollup.address);
        expect(resAddToken.logs[0].args.tokenId.toString()).to.be.equal('0');
    });

    it('transfer ether and approve tokens', async () => {
        const depositAmount = 10;
        web3.eth.sendTransaction({ to: walletEth.address, from: id1, value: web3.utils.toWei('20', 'ether') });// provide funds to our account
        const tx = {
            from: walletEth.address,
            // target address, this could be a smart contract address
            gasLimit: web3.utils.toHex(800000), // Raise the gas limit to a much higher amount
            gasPrice: web3.utils.toHex(web3.utils.toWei('10', 'gwei')),
            to: insTokenRollup.address,
            // optional if you want to specify the gas limit
            data: insTokenRollup.contract.methods.approve(insRollupTest.address, depositAmount).encodeABI(),
        };
        const signPromise = await web3.eth.accounts.signTransaction(tx, walletEth.privateKey);
        await web3.eth.sendSignedTransaction(signPromise.rawTransaction);
    });
});
