/* global artifacts */
/* global contract */
/* global web3 */

const chai = require("chai");
const { expect } = chai;
const lodash = require("lodash");
const poseidonUnit = require("circomlib/src/poseidon_gencontract");
const TokenRollup = artifacts.require("../contracts/test/TokenRollup");
const Verifier = artifacts.require("../contracts/test/VerifierHelper");
const RollupPoS = artifacts.require("../contracts/RollupPoS");
const RollupTest = artifacts.require("../contracts/test/RollupTest");
const Synchronizer = require("../src/synch");
const MemDb = require("../../rollup-utils/mem-db");
const RollupDB = require("../../js/rollupdb");
const SMTMemDB = require("circomlib/src/smt_memdb");
const { BabyJubWallet } = require("../../rollup-utils/babyjub-wallet");
const { timeout, buildInputSm, manageEvent } = require("../src/utils");
const timeTravel = require("../../test/contracts/helpers/timeTravel");

const proofA = ["0", "0"];
const proofB = [["0", "0"], ["0", "0"]];
const proofC = ["0", "0"];

function buildFullInputSm(bb, beneficiary) {
    const input = buildInputSm(bb);
    return {
        beneficiary: beneficiary,
        proofA,
        proofB,
        proofC,
        input,
    };
}

async function checkSynch(synch, opRollupDb){
    // Check fully synchronized
    const totalSynched = await synch.getSynchPercentage();
    expect(totalSynched).to.be.equal(Number(100).toFixed(2));
    const isSynched = await synch.isSynched();
    expect(isSynched).to.be.equal(true);
    // Check database-synch matches database-op
    const tmpOpDb = opRollupDb.db.nodes;
    const synchDb = await synch.getState();
    expect(lodash.isEqual(tmpOpDb, synchDb)).to.be.equal(true);
}

// timeouts test
const timeoutAddBlocks = 2000;
const timeoutSynch = 15000;
const timeoutFinal = 60000;

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
        ptr = ptr - 1;
        await insRollupPoS.commitAndForge(hashChain[ptr] , `0x${block.getDataAvailable().toString("hex")}`,
            proofA, proofB, proofC, inputSm);
        await opRollupDb.consolidate(block);
    }

    const {
        0: owner,
        1: id1,
        2: id2,
        3: id3,
        4: synchAddress,
        5: beneficiary,
        6: op1,
    } = accounts;

    let synchDb;
    let synch;

    const maxTx = 10;
    const maxOnChainTx = 5;
    const nLevels = 24;
    const tokenInitialAmount = 1000;
    const tokenId = 0;
    const url = "localhost";
    const hashChain = [];
    let ptr = 0;
    const initialMsg = "rollup";

    const slotPerEra = 20;
    const blocksPerSlot = 100;
    const blockPerEra = slotPerEra * blocksPerSlot;
    // Operator database
    let opDb;
    let opRollupDb;

    // Synchronizer database
    let db;
    let synchRollupDb;

    let insPoseidonUnit;
    let insTokenRollup;
    let insRollupPoS;
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
        contractPoS: undefined,
        posAbi: RollupPoS.abi,
    }; 

    // BabyJubjub public key
    const mnemonic = "urban add pulse prefer exist recycle verb angle sell year more mosquito";
    const wallet = BabyJubWallet.fromMnemonic(mnemonic);
    const Ax = wallet.publicKey[0].toString();
    const Ay = wallet.publicKey[1].toString();

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
        insRollupPoS = await RollupPoS.new(insRollupTest.address, maxTx);

        // load forge batch mechanism
        await insRollupTest.loadForgeBatchMechanism(insRollupPoS.address);
        
        // Init Synch Rollup databases
        synchDb = new MemDb();
        db = new SMTMemDB();
        synchRollupDb = await RollupDB(db);
        // Init operator Rollup Database
        opDb = new SMTMemDB();
        opRollupDb = await RollupDB(opDb);

        // load configuration synchronizer
        configSynch.contractPoS = insRollupPoS.address;
        configSynch.contractAddress = insRollupTest.address;
        configSynch.creationHash = insRollupTest.transactionHash;
        configSynch.treeDb = synchRollupDb;
        configSynch.synchDb = synchDb;

        // Add operator
        // Create hash chain for the operator
        hashChain.push(web3.utils.keccak256(initialMsg));
        for (let i = 1; i < 100; i++) {
            hashChain.push(web3.utils.keccak256(hashChain[i - 1]));
            ptr = i;
        }
        // Add operator to PoS
        const amountToStake = 2;
        await insRollupPoS.addOperator(hashChain[ptr], url,
            { from: op1, value: web3.utils.toWei(amountToStake.toString(), "ether") });
    });

    it("manage rollup token", async () => { 
        const amountDistribution = 100;

        await insRollupTest.addToken(insTokenRollup.address,
            { from: id1, value: web3.utils.toWei("1", "ether") });
        await insTokenRollup.transfer(id2, amountDistribution, { from: id1 });
        await insTokenRollup.transfer(id3, amountDistribution, { from: id1 });
        
        await insTokenRollup.approve(insRollupTest.address, tokenInitialAmount,
            { from: id1 });
        await insTokenRollup.approve(insRollupTest.address, amountDistribution,
            { from: id2 });
        await insTokenRollup.approve(insRollupTest.address, amountDistribution,
            { from: id3 });
    });

    let eventsInitial = [];

    it("Should initialize synchronizer", async () => {
        synch = new Synchronizer(configSynch.synchDb, configSynch.treeDb, configSynch.ethNodeUrl,
            configSynch.contractAddress, configSynch.abi, configSynch.contractPoS,
            configSynch.posAbi, configSynch.creationHash, configSynch.ethAddress);
        synch.synchLoop();
    });

    it("Should add one deposit", async () => {
        const loadAmount = 10;
        const event0 = await insRollupTest.deposit(loadAmount, tokenId, id1,
            [Ax, Ay], { from: id1, value: web3.utils.toWei("1", "ether") });
        eventsInitial.push(event0.logs[0]);
    });

    it("Should move to era 2 and synch", async () => {
        let currentBlock = await web3.eth.getBlockNumber();
        const genesisBlock = await insRollupPoS.genesisBlock();
        await timeTravel.addBlocks(genesisBlock - currentBlock); // era 0
        await timeout(timeoutAddBlocks);

        await timeTravel.addBlocks(blockPerEra); // era 1
        await timeout(timeoutAddBlocks);

        await timeTravel.addBlocks(blockPerEra); // era 2
        await timeout(timeoutAddBlocks);
        await forgeBlock(); // genesis
        await timeout(timeoutSynch);
        await checkSynch(synch, opRollupDb);

        await forgeBlock(eventsInitial); // add initial onchain event deposit
        await timeout(timeoutSynch);
        await checkSynch(synch, opRollupDb);
    });

    it("Should add two deposits and synch", async () => {
        const loadAmount = 10;
        const events = [];
        const event0 = await insRollupTest.deposit(loadAmount, tokenId, id2,
            [Ax, Ay], { from: id2, value: web3.utils.toWei("1", "ether") });
        events.push(event0.logs[0]);
        const event1 = await insRollupTest.deposit(loadAmount, tokenId, id3,
            [Ax, Ay], { from: id3, value: web3.utils.toWei("1", "ether") });
        events.push(event1.logs[0]);
        await forgeBlock();
        await forgeBlock(events);
        await timeout(timeoutSynch);
        await checkSynch(synch, opRollupDb);
    });

    it("Should retrieve balance tree information", async () => {
        const axStr = wallet.publicKey[0].toString("16");
        const ayStr = wallet.publicKey[1].toString("16");
        // get info by Id
        const resId = await synch.getStateById(1);
        // check leaf info matches deposit
        expect(resId.ax).to.be.equal(axStr);
        expect(resId.ay).to.be.equal(ayStr);
        expect(resId.ethAddress).to.be.equal(id1.toString().toLowerCase());

        // get leafs info by AxAy
        const resAxAy = await synch.getStateByAxAy(axStr, ayStr);
        // check leaf info matches deposits
        expect(resAxAy.length).to.be.equal(3); // 3 deposits with equal Ax, Ay
        expect(resAxAy[0].ethAddress).to.be.equal(id1.toString().toLowerCase());
        expect(resAxAy[1].ethAddress).to.be.equal(id2.toString().toLowerCase());
        expect(resAxAy[2].ethAddress).to.be.equal(id3.toString().toLowerCase());

        // get leaf info by ethAddress
        const resEthAddress = await synch.getStateByEthAddr(id1.toString());
        // check leaf info matches deposit
        expect(resEthAddress[0].ax).to.be.equal(axStr);
        expect(resEthAddress[0].ay).to.be.equal(ayStr);

        // get leaf info by ethAddress
        const resEthAddress2 = await synch.getStateByEthAddr(id2.toString());
        // check leaf info matches deposit
        expect(resEthAddress2[0].ax).to.be.equal(axStr);
        expect(resEthAddress2[0].ay).to.be.equal(ayStr);

        // get leaf info by ethAddress
        const resEthAddress3 = await synch.getStateByEthAddr(id3.toString());
        // check leaf info matches deposit
        expect(resEthAddress3[0].ax).to.be.equal(axStr);
        expect(resEthAddress3[0].ay).to.be.equal(ayStr);
    });

    it("Should add off-chain tx with fee and synch", async () => {
        const tx = {
            fromIdx: 1,
            toIdx: 2,
            coin: 0,
            amount: 1,
            nonce: 0,
            userFee: 1
        };
        const bb = await opRollupDb.buildBatch(maxTx, nLevels);
        bb.addTx(tx);
        // Add fee
        bb.addCoin(0, 1);

        await bb.build();

        const inputSm = buildFullInputSm(bb, beneficiary);
        ptr = ptr - 1;
        await insRollupPoS.commitAndForge(hashChain[ptr] , `0x${bb.getDataAvailable().toString("hex")}`,
            inputSm.proofA, inputSm.proofB, inputSm.proofC, inputSm.input);
        
        await opRollupDb.consolidate(bb);
        await timeout(timeoutSynch);
        await checkSynch(synch, opRollupDb);
    });

    it("Should add off-chain tx and synch", async () => {
        const events = [];
        events.push({event:"OffChainTx", fromId: 1, toId: 2, amount: 3});
        await forgeBlock(events);
        await timeout(timeoutSynch);
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
        await timeout(timeoutSynch);
        await checkSynch(synch, opRollupDb);
    });

    it("Should get off-chain tx by batch", async () => {
        // get off-chain tx forge in batch 5
        const res0 = await synch.getOffChainTxByBatch(5);
        expect(res0[0].fromIdx.toString()).to.be.equal("1");
        expect(res0[0].toIdx.toString()).to.be.equal("2");
        expect(res0[0].amount.toString()).to.be.equal("3");

        // get off-chain tx forged in batch 7
        const res1 = await synch.getOffChainTxByBatch(7);
        // Should retrieve two off-chain tx
        expect(res1.length).to.be.equal(2);
        // tx 0
        expect(res1[0].fromIdx.toString()).to.be.equal("1");
        expect(res1[0].toIdx.toString()).to.be.equal("2");
        expect(res1[0].amount.toString()).to.be.equal("2");
        // tx1
        expect(res1[1].fromIdx.toString()).to.be.equal("2");
        expect(res1[1].toIdx.toString()).to.be.equal("1");
        expect(res1[1].amount.toString()).to.be.equal("3");
    });

    it("Should add bunch off-chain tx and synch", async () => {
        let events = [];
        const numBatchForged = 10;
        for (let i = 0; i < numBatchForged; i++) {
            events = [];
            const from = (i % 2) ? 1 : 2;
            const to = (i % 2) ? 2 : 1;
            events.push({event:"OffChainTx", fromId: from, toId: to, amount: 1});
            await forgeBlock(events);
        }
        await timeout(timeoutFinal);
        await checkSynch(synch, opRollupDb);
    });
});
