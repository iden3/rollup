/* eslint-disable no-underscore-dangle */
/* global artifacts */
/* global contract */
/* global web3 */

const chai = require('chai');
const ethers = require('ethers');
const fs = require('fs');
const poseidonUnit = require('circomlib/src/poseidon_gencontract');
const path = require('path');
const { createWallet, createConfig, createRollupAbi } = require('./build-resources');

const { expect } = chai;

const walletPathDefault = path.join(__dirname, '../resources/wallet-test.json');

const Verifier = artifacts.require('../../../../contracts/test/VerifierHelper');
const RollupTest = artifacts.require('../../../../contracts/test/RollupTest');
const TokenRollup = artifacts.require('../../../../contracts/test/TokenRollup');

contract('Rollup', async (accounts) => {
    let insPoseidonUnit;
    let insTokenRollup;
    let insRollupTest;
    let insVerifier;
    let walletEth;

    const maxTx = 10;
    const maxOnChainTx = 10;
    const tokenInitialAmount = 100;
    const {
        0: owner,
        1: id1,
        2: tokenList,
        3: providerfunds,
        4: feeTokenAddress,
    } = accounts;


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

        walletEth = await ethers.Wallet.fromEncryptedJson(JSON.stringify(JSON.parse(fs.readFileSync(walletPathDefault, 'utf8')).ethWallet), 'foo');

        await createRollupAbi(RollupTest.abi);
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

    it('transfer ether and approve tokens', async () => {
        const depositAmount = 10;
        web3.eth.sendTransaction({ to: walletEth.address, from: providerfunds, value: web3.utils.toWei('5', 'ether') });// provide funds to our account
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

        await createConfig(insRollupTest.address);
    });
});
