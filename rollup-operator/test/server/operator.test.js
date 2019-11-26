/* global artifacts */
/* global contract */
/* global web3 */

const chai = require("chai");
const { expect } = chai;
const { addBlocks } = require("../../../test/contracts/helpers/timeTravel");
const ethers = require("ethers");
const TokenRollup = artifacts.require("../contracts/test/TokenRollup");
const Rollup = artifacts.require("../contracts/test/Rollup");
const RollupPoS = artifacts.require("../contracts/RollupPoS");
const fs = require("fs");
const path = require("path");
const process = require("child_process");
const { timeout } = require("../../src/utils");
const configTestPath = path.join(__dirname, "../config/test.json");

const CliAdminOp = require("../../src/cli-admin-operator");
const CliExternalOp = require("../../src/cli-external-operator");

// This test assumes 'server-proof' is running locally on port 10001
// This test assumes 'operator' api-admin is running locally on port 9000
// This test assumes 'operator' api-external is running locally on port 9001

contract("Operator", (accounts) => {
    const {
        0: owner,
    } = accounts;

    // Clients
    let cliAdminOp;
    let cliExternalOp;

    // Url
    const urlAdminOp = "http://127.0.0.1:9000";
    const urlExternalOp = "http://127.0.0.1:9001";

    // Constants to move to a specific era
    const slotPerEra = 20;
    const blocksPerSlot = 100;
    const blockPerEra = slotPerEra * blocksPerSlot;

    // Operator wallet
    const passphrase = "passphrase";
    let walletOp;
    let walletOpEnc;

    // Contract instances
    let insRollupPoS;

    before(async () => {
        // Load test configuration
        const configTest = JSON.parse(fs.readFileSync(configTestPath));
        // Load TokenRollup
        await TokenRollup.at(configTest.tokenAddress);
        // Load Rollup
        await Rollup.at(configTest.rollupAddress);
        // Load rollup PoS
        insRollupPoS = await RollupPoS.at(configTest.posAddress);

        // Load clients
        cliAdminOp = new CliAdminOp(urlAdminOp);
        cliExternalOp = new CliExternalOp(urlExternalOp);

        // load operator wallet with funds
        let privateKey = "0x0123456789012345678901234567890123456789012345678901234567890123";
        walletOp = new ethers.Wallet(privateKey);
        const initBalance = 1000;
        await web3.eth.sendTransaction({to: walletOp.address, from: owner,
            value: web3.utils.toWei(initBalance.toString(), "ether")});
        walletOpEnc = await walletOp.encrypt(passphrase);
    });

    it("Should load operator wallet", async () => {
        await cliAdminOp.loadWallet(walletOpEnc, passphrase);
    });

    it("Should register operator", async () => {
        const stake = 2;
        const url = "localhost";
        const seed = "rollup"; 
        await cliAdminOp.register(stake, url, seed);
    });

    it("Should move to era 2", async () => {
        const genesisBlock = Number(await insRollupPoS.genesisBlock());
        let currentBlock = await web3.eth.getBlockNumber();
        await addBlocks(genesisBlock - currentBlock + 1); // move to era 0
        await timeout(5000); // wait time to add all blocks
        await addBlocks(blockPerEra); // move to era 1
        await timeout(5000); // wait time to add all blocks
        await addBlocks(blockPerEra); // move to era 2
        await timeout(5000); // wait time to add all blocks
    });

    it("Should forge at least one batch", async () => {
        let batchForged = false;
        let counter = 0;
        while(!batchForged && counter < 10) {
            const res = await cliExternalOp.getState();
            const info = res.data;
            if (info.rollupSynch.lastBatchSynched > 0) {
                batchForged = true;
                break;
            } 
            await timeout(10000);
            counter += 1;
        }
        expect(batchForged).to.be.equal(true);
    });

    after(async () => {
        process.exec("find . -depth -type d -name 'tmp-*' -prune -exec rm -rf {} +");
    });
});