/* global artifacts */
/* global contract */
/* global web3 */
const poseidonUnit = require('circomlib/src/poseidon_gencontract');
const path = require('path');

const TokenRollup = artifacts.require('../contracts/test/TokenRollup');
const Verifier = artifacts.require('../contracts/test/VerifierHelper');
const RollupPoS = artifacts.require('../contracts/RollupPoS');
const Rollup = artifacts.require('../contracts/test/Rollup');
const fs = require('fs');
const ethers = require('ethers');

const mnemonic = 'jaguar exhaust token lounge clerk gun metal vacant raven roast youth jealous';
const passString = 'foo';

const walletPath = path.join(__dirname, '../wallet-test.json');
const configPath = path.join(__dirname, '../config.json');

contract('Build configuration files for cli-pos', (accounts) => {
    const {
        0: owner,
        1: tokenId,
        2: feeTokenAddress,
    } = accounts;

    const maxTx = 10;
    const maxOnChainTx = 5;
    const tokenInitialAmount = 1000;

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
        insTokenRollup = await TokenRollup.new(tokenId, tokenInitialAmount);

        // Deploy Verifier
        insVerifier = await Verifier.new();

        // Deploy Rollup test
        insRollup = await Rollup.new(insVerifier.address, insPoseidonUnit._address,
            maxTx, maxOnChainTx, feeTokenAddress);

        // Deploy Staker manager
        insRollupPoS = await RollupPoS.new(insRollup.address, maxTx);

        // load forge batch mechanism
        await insRollup.loadForgeBatchMechanism(insRollupPoS.address);

        // add token to Rollup
        await insRollup.addToken(insTokenRollup.address,
            { from: tokenId, value: web3.utils.toWei('1', 'ether') });
    });

    it('Should save wallet', async () => {
        const wallet = await ethers.Wallet.fromMnemonic(mnemonic);
        const encWallet = await wallet.encrypt(passString);
        fs.writeFileSync(walletPath, JSON.stringify(JSON.parse(encWallet), null, 1), 'utf-8');
    });

    it('Should load configuration file', async () => {
        const nodeUrl = 'http://127.0.0.1:8545';
        const posAddress = insRollupPoS.address;
        const posAbi = RollupPoS.abi;
        const config = { nodeUrl, posAddress, posAbi };
        fs.writeFileSync(configPath, JSON.stringify(config), 'utf-8');
    });
});
