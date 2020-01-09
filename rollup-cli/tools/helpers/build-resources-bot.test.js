/* eslint-disable no-underscore-dangle */
/* eslint-disable no-use-before-define */
/* eslint-disable no-await-in-loop */
/* eslint-disable consistent-return */
/* eslint-disable no-restricted-syntax */
/* global artifacts */
/* global contract */
/* global web3 */
const path = require('path');
const chai = require('chai');
const fs = require('fs');
const poseidonUnit = require('circomlib/src/poseidon_gencontract');
const { Wallet } = require('../../src/wallet.js');

const { expect } = chai;
const Verifier = artifacts.require('../../../../contracts/test/VerifierHelper');
const RollupTest = artifacts.require('../../../../contracts/test/RollupTest');
const TokenRollup = artifacts.require('../../../../contracts/test/TokenRollup');
const configBot = path.join(__dirname, '../resourcesBot/');

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
        3: providerfunds,
        4: feeTokenAddress,
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
            maxTx, maxOnChainTx, feeTokenAddress);

        password = 'foo';
        const configJson = {
            walletFunder: path.join(__dirname, '../../tools/resourcesBot/walletFunder.json'),
            operator: 'http://127.0.0.1:9000',
            addressRollup: insRollupTest.address,
            addressTokens: insTokenRollup.address,
            nodeEth: 'http://localhost:8545',
            abiTokens: path.join(__dirname, '../../tools/resourcesBot/tokens-abi.json'),
            abiRollup: path.join(__dirname, '../../tools/resourcesBot/rollup-abi.json'),
        };
        if (!fs.existsSync(configBot)) {
            await fs.mkdirSync(configBot);
        }
        fs.writeFileSync(`${configBot}configBot.json`, JSON.stringify(configJson, null, 1), 'utf-8');
        fs.writeFileSync(`${configBot}rollup-abi.json`, JSON.stringify(insRollupTest.abi, null, 1), 'utf-8');
        fs.writeFileSync(`${configBot}tokens-abi.json`, JSON.stringify(insTokenRollup.abi, null, 1), 'utf-8');

        const walletRollup = await Wallet.createRandom();
        const walletJson = await walletRollup.toEncryptedJson(password);
        fs.writeFileSync(`${configBot}walletFunder.json`, JSON.stringify(walletJson, null, 1), 'utf-8');
        walletEth = walletRollup.ethWallet.wallet;
    });

    it('Distribute tokens and funds', async () => {
        await insTokenRollup.transfer(walletEth.address, 300, { from: id1 });

        let balance = await web3.eth.getBalance(providerfunds);
        let account = 4;
        while (web3.utils.fromWei(balance) < 90) {
            account += 1;
            balance = await web3.eth.getBalance(accounts[account]);
        }
        web3.eth.sendTransaction({ to: walletEth.address, from: accounts[account], value: web3.utils.toWei('90', 'ether') });// provide funds to our account
    });

    it('Rollup token listing', async () => {
        // Check balances token
        const resWalletEth = await insTokenRollup.balanceOf(walletEth.address);
        const resId1 = await insTokenRollup.balanceOf(id1);
        expect(resWalletEth.toString()).to.be.equal('300');
        expect(resId1.toString()).to.be.equal('700');

        // Add token to rollup token list
        const resAddToken = await insRollupTest.addToken(insTokenRollup.address,
            { from: tokenList, value: web3.utils.toWei('1', 'ether') });

        expect(resAddToken.logs[0].event).to.be.equal('AddToken');
        expect(resAddToken.logs[0].args.tokenAddress).to.be.equal(insTokenRollup.address);
        expect(resAddToken.logs[0].args.tokenId.toString()).to.be.equal('0');
    });
});
