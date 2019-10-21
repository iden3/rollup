/* eslint-disable no-underscore-dangle */
/* eslint-disable no-await-in-loop */
/* eslint-disable consistent-return */
/* global artifacts */
/* global contract */
/* global web3 */

// const chai = require("chai");
// const { expect } = chai;
// ganache-cli --mnemonic "vivid bitter wealth early teach village shoot tide beauty universe green vanish"

const fs = require('fs');
const poseidonUnit = require('circomlib/src/poseidon_gencontract');
const { slashSC } = require('./slasher');
const timeTravel = require('../../test/contracts/helpers/timeTravel');

const Verifier = artifacts.require('../../../../contracts/test/VerifierHelper');
const RollupTest = artifacts.require('../../../../contracts/test/RollupTest');
const RollupPoS = artifacts.require('../../../../contracts/test/RollupPoS');
const { timeout } = require('../../rollup-operator/src/utils');


contract('RollupPoS', async (accounts) => {
    let insPoseidonUnit;
    let insRollupTest;
    let insVerifier;
    let insRollupPoS;

    const urlNode = 'http://localhost:8545';
    let addressSC;
    const walletPath = './walletSlash.json';
    const pass = 'foo';
    let abi;
    let walletJson;
    const maxTx = 10;
    const maxOnChainTx = 10;
    const {
        0: owner,
    } = accounts;


    before(async () => {
        // Deploy poseidon
        const C = new web3.eth.Contract(poseidonUnit.abi);
        insPoseidonUnit = await C.deploy({ data: poseidonUnit.createCode() })
            .send({ gas: 2500000, from: owner });

        // Deploy Verifier
        insVerifier = await Verifier.new();

        // Deploy Rollup test
        insRollupTest = await RollupTest.new(insVerifier.address, insPoseidonUnit._address,
            maxTx, maxOnChainTx);

        insRollupPoS = await RollupPoS.new(insRollupTest.address, maxTx);

        addressSC = insRollupPoS.contract._address;
        abi = insRollupPoS.abi;
        walletJson = JSON.parse(fs.readFileSync(walletPath, 'utf8'));
    });
    it('slash', async () => {
        await timeTravel.addBlocks(1011);

        slashSC(urlNode, addressSC, walletJson, pass, abi, 0);
        await timeout(30000);
    });
});
