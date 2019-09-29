/* global artifacts */
/* global contract */
/* global web3 */

const chai = require("chai");
const { expect } = chai;
const lodash = require("lodash");
const poseidonUnit = require("circomlib/src/poseidon_gencontract");
const TokenRollup = artifacts.require("../contracts/test/TokenRollup");
const Verifier = artifacts.require("../contracts/test/VerifierHelper");
const StakerManager = artifacts.require("../contracts/RollupPoS");
const RollupTest = artifacts.require("../contracts/test/RollupTest");
const Synchronizer = require("../src/synch");
const MemDb = require("../../rollup-utils/mem-db");
const RollupDB = require("../../js/rollupdb");
const SMTMemDB = require("circomlib/src/smt_memdb");
const { BabyJubWallet } = require("../../rollup-utils/babyjub-wallet");
const {timeout, buildInputSm, manageEvent } = require("../src/utils");

async function checkSynch(synch, opRollupDb){
    // Check fully synchronized
    const totalSynched = await synch.getSynchPercentage();
    expect(totalSynched).to.be.equal(Number(100).toFixed(2));
    // Check database-synch matches database-op
    const tmpOpDb = opRollupDb.db.nodes;
    const synchDb = await synch.getState();
    expect(lodash.isEqual(tmpOpDb, synchDb)).to.be.equal(true);
}

contract("Synchronizer", (accounts) => {
    
    async function forgeBlock(events = undefined) {
        const block = await opRollupDb.buildBlock(maxTx, nLevels);
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
        0: owner,
        1: id1,
        2: id2,
        3: synchAddress,
        4: beneficiary,
    } = accounts;

    let synchDb;
    let synch;

    const maxTx = 10;
    const maxOnChainTx = 5;
    const nLevels = 24;
    const tokenInitialAmount = 1000;
    const tokenId = 0;

    // Operator database
    let opDb;
    let opRollupDb;

    // Synchronizer database
    let db;
    let synchRollupDb;

    let insPoseidonUnit;
    let insTokenRollup;
    let insStakerManager;
    let insRollupTest;
    let insVerifier;

    let configSynch = {
        treeDb: undefined,
        synchDb: undefined,
        ethNodeUrl: "http://localhost:8545",
        contractAddress: undefined,
        creationHash: undefined,
        ethAddress: synchAddress,
        abi: RollupTest.abi,
    }; 

    // BabyJubjub public key
    const mnemonic = "urban add pulse prefer exist recycle verb angle sell year more mosquito";
    const wallet = BabyJubWallet.fromMnemonic(mnemonic);
    const Ax = wallet.publicKey[0].toString();
    const Ay = wallet.publicKey[1].toString();

    // Fake proofs
    const proofA = ["0", "0"];
    const proofB = [["0", "0"], ["0", "0"]];
    const proofC = ["0", "0"];

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

        // Deploy Staker manager
        insStakerManager = await StakerManager.new(insRollupTest.address);

        // load forge batch mechanism ( not used in this test)
        await insRollupTest.loadForgeBatchMechanism(insStakerManager.address);
        
        // Init Synch Rollup databases
        synchDb = new MemDb();
        db = new SMTMemDB();
        synchRollupDb = await RollupDB(db);
        // Init operator Rollup Database
        opDb = new SMTMemDB();
        opRollupDb = await RollupDB(opDb);

        // load configuration synchronizer
        configSynch.contractAddress = insRollupTest.address;
        configSynch.creationHash = insRollupTest.transactionHash;
        configSynch.treeDb = synchRollupDb;
        configSynch.synchDb = synchDb;
    });

    it("manage rollup token", async () => { 
        const amountDistribution = 100;

        await insRollupTest.addToken(insTokenRollup.address,
            { from: id1, value: web3.utils.toWei("1", "ether") });
        await insTokenRollup.transfer(id2, amountDistribution, { from: id1 });
        
        await insTokenRollup.approve(insRollupTest.address, tokenInitialAmount,
            { from: id1 });
        await insTokenRollup.approve(insRollupTest.address, amountDistribution,
            { from: id2 });
    });

    it("Should initialize synchronizer", async () => {
        synch = new Synchronizer(configSynch.synchDb, configSynch.treeDb, configSynch.ethNodeUrl,
            configSynch.contractAddress, configSynch.abi, configSynch.creationHash, configSynch.ethAddress);
        synch.synchLoop();
    });

    it("Should add two deposits and synch", async () => {
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
        await timeout(12000);
        await checkSynch(synch, opRollupDb);
    });

    it("Should add off-chain tx and synch", async () => {
        const events = [];
        events.push({event:"OffChainTx", fromId: 1, toId: 2, amount: 3});
        await forgeBlock(events);
        await timeout(12000);
        await checkSynch(synch, opRollupDb);
    });

    it("Should add on-chain and off-chain tx and synch", async () => {
        const events = [];
        const toId = 1;
        const onTopAmount = 10;
        const tokenId = 0;
        const event = await insRollupTest.depositOnTop(toId, onTopAmount, tokenId,
            { from: id2, value: web3.utils.toWei("1", "ether") });
        events.push(event.logs[0]);
        events.push({event:"OffChainTx", fromId: 1, toId: 2, amount: 2});
        events.push({event:"OffChainTx", fromId: 2, toId: 1, amount: 3});
        await forgeBlock();
        await forgeBlock(events);
        await timeout(12000);
        await checkSynch(synch, opRollupDb);
    });

    it("Should add bunch off-chain tx and synch", async () => {
        let events = [];
        const numBatchForged = 30;
        for (let i = 0; i < numBatchForged; i++) {
            events = [];
            const from = (i % 2) ? 1 : 2;
            const to = (i % 2) ? 2 : 1;
            events.push({event:"OffChainTx", fromId: from, toId: to, amount: 1});
            await forgeBlock(events);
        }
        await timeout(30000);
        await checkSynch(synch, opRollupDb);
    });
});
