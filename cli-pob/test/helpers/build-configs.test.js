/* global artifacts */
/* global contract */
/* global web3 */
const poseidonUnit = require('circomlib/src/poseidon_gencontract');
const path = require('path');

const Verifier = artifacts.require('../contracts/test/VerifierHelper');
const RollupPoB = artifacts.require('../contracts/RollupPoB');
const Rollup = artifacts.require('../contracts/test/Rollup');
const fs = require('fs');
const ethers = require('ethers');

const mnemonic = 'jaguar exhaust token lounge clerk gun metal vacant raven roast youth jealous';
const passString = 'foo';


const walletPath = path.join(__dirname, '../../wallet-test.json');
const configPath = path.join(__dirname, '../../config.json');

contract('Build configuration files for cli-pob', (accounts) => {
    const {
        0: owner,
        1: feeTokenAddress,
        2: defaultOperator,
    } = accounts;

    const maxTx = 10;
    const maxOnChainTx = 5;
    const burnAddress = '0x0000000000000000000000000000000000000000';
    const url = 'localhost';

    let insPoseidonUnit;
    let insRollupPoB;
    let insRollup;
    let insVerifier;

    before(async () => {
        // Deploy poseidon
        const C = new web3.eth.Contract(poseidonUnit.abi);
        insPoseidonUnit = await C.deploy({ data: poseidonUnit.createCode() })
            .send({ gas: 2500000, from: owner });

        // Deploy Verifier
        insVerifier = await Verifier.new();

        // Deploy Rollup test
        insRollup = await Rollup.new(insVerifier.address, insPoseidonUnit._address,
            maxTx, maxOnChainTx, feeTokenAddress);

        // Deploy Staker manager
        insRollupPoB = await RollupPoB.new(insRollup.address, maxTx, burnAddress, defaultOperator, url);

        // load forge batch mechanism
        await insRollup.loadForgeBatchMechanism(insRollupPoB.address);
    });

    it('Should save wallet', async () => {
        const wallet = await ethers.Wallet.fromMnemonic(mnemonic);
        const encWallet = await wallet.encrypt(passString);
        fs.writeFileSync(walletPath, JSON.stringify(JSON.parse(encWallet), null, 1), 'utf-8');
    });

    it('Should load configuration file', async () => {
        const nodeUrl = 'http://127.0.0.1:8545';
        const pobAddress = insRollupPoB.address;
        const pobAbi = RollupPoB.abi;
        const config = { nodeUrl, pobAddress, pobAbi };
        fs.writeFileSync(configPath, JSON.stringify(config), 'utf-8');
    });
});
