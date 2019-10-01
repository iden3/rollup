/* global artifacts */
/* global contract */
/* global web3 */

const chai = require("chai");
const { expect } = chai;
const TokenRollup = artifacts.require("../contracts/test/TokenRollup");
const RollupTest = artifacts.require("../contracts/test/RollupTest");
const RollupPoS = artifacts.require("../contracts/RollupPoS");
const fs = require("fs");
const path = require("path");
const { unstringifyBigInts } = require("snarkjs");
const RollupDB = require("../../../js/rollupdb");
const SMTMemDB = require("circomlib/src/smt_memdb");
const { BabyJubWallet } = require("../../../rollup-utils/babyjub-wallet");
const { timeout, buildInputSm, manageEvent } = require("../../src/utils");
const configTestPath = path.join(__dirname, "../config/test.json");
const SynchServer = require("../../src/api-synch");
const serverUrl = "http://127.0.0.1:9000";



contract("Synchronizer", (accounts) => {

    async function forgeBlock(events = undefined) {
        const block = await opRollupDb.buildBatch(maxTx, nLevels);
        if (events) {
            events.forEach(elem => {
                block.addTx(manageEvent(elem));
            });
        }
        await block.build();
        const inputSm = buildInputSm(block, beneficiary);
        const compressedTx = `0x${block.getDataAvailable().toString("hex")}`;
        await insRollupTest.forgeBatch(beneficiary, proofA, proofB, proofC, inputSm, compressedTx);
        await opRollupDb.consolidate(block);
    }

    const {
        1: id1,
        2: id2,
        4: beneficiary
    } = accounts;

    // BabyJubjub public key
    const mnemonic = "urban add pulse prefer exist recycle verb angle sell year more mosquito";
    const wallet = BabyJubWallet.fromMnemonic(mnemonic);
    const Ax = wallet.publicKey[0].toString();
    const Ay = wallet.publicKey[1].toString();
    
    
    const maxTx = 10;
    const nLevels = 24;
    const tokenInitialAmount = 1000;
    const tokenId = 0;

    let insTokenRollup;
    let insRollupTest;
    let insRollupPoS;

    // Operator database
    let opDb;
    let opRollupDb;

    // Client api
    const apiClient = new SynchServer(serverUrl);

    // Fake proofs
    const proofA = ["0", "0"];
    const proofB = [["0", "0"], ["0", "0"]];
    const proofC = ["0", "0"];

    before(async () => {
        // Load test configuration
        const configTest = JSON.parse(fs.readFileSync(configTestPath));
        // Load TokenRollup
        insTokenRollup = await TokenRollup.at(configTest.tokenAddress);
        // Load Rollup
        insRollupTest = await RollupTest.at(configTest.rollupAddress);
        // Load rollup PoS
        insRollupPoS = await RollupPoS.at(configTest.posAddress);

        // Init operator Rollup Database
        opDb = new SMTMemDB();
        opRollupDb = await RollupDB(opDb);
    });

    it("Manage token rollup", async () => {
        const amountDistribution = 100;

        await insRollupTest.addToken(insTokenRollup.address,
            { from: id1, value: web3.utils.toWei("1", "ether") });
        await insTokenRollup.transfer(id2, amountDistribution, { from: id1 });
        
        await insTokenRollup.approve(insRollupTest.address, tokenInitialAmount,
            { from: id1 });
        await insTokenRollup.approve(insRollupTest.address, amountDistribution,
            { from: id2 });
    });

    it("Should add two deposits", async () => {
        const loadAmount = 10;
        const events = [];
        const event0 = await insRollupTest.deposit(loadAmount, tokenId, id1,
            [Ax, Ay], { from: id1, value: web3.utils.toWei("1", "ether") });
        events.push(event0.logs[0]);
        const event1 = await insRollupTest.deposit(loadAmount, tokenId, id2,
            [Ax, Ay], { from: id2, value: web3.utils.toWei("1", "ether") });
        events.push(event1.logs[0]);
        await forgeBlock();
        await forgeBlock(events);
        await timeout(20000);
    });

    it("Should check operator leafs", async () => {
        let res = await apiClient.getInfoById(1);
        let infoLeaf = unstringifyBigInts(res.data);
        expect(infoLeaf.amount.toString()).to.be.equal("10");

        res = await apiClient.getInfoById(2);
        infoLeaf = unstringifyBigInts(res.data);
        expect(infoLeaf.amount.toString()).to.be.equal("10");
    });
});
