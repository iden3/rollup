const { expect } = require("chai");
const { stringifyBigInts } = require("snarkjs");
const lodash = require("lodash");
const SMTMemDB = require("circomlib").SMTMemDB;
const util = require("util");
const exec = util.promisify( require("child_process").exec);

const RollupAccount = require("../../js/rollupaccount");
const RollupDB = require("../../js/rollupdb");
const { SMTLevelDb } = require("../../rollup-utils/smt-leveldb");

async function initRollupDb(rollupDB) {

    const bb = await rollupDB.buildBatch(4, 8);

    const account1 = new RollupAccount(1);
    const account2 = new RollupAccount(2);

    bb.addTx({ fromIdx: 1, loadAmount: 10, coin: 0, ax: account1.ax, ay: account1.ay,
        ethAddress: account1.ethAddress, onChain: true });

    bb.addTx({ fromIdx: 2, loadAmount: 10, coin: 1, ax: account1.ax, ay: account1.ay,
        ethAddress: account1.ethAddress, onChain: true });

    bb.addTx({ fromIdx: 3, loadAmount: 0, coin: 0, ax: account2.ax, ay: account2.ay,
        ethAddress: account2.ethAddress, onChain: true });

    bb.addTx({ fromIdx: 4, loadAmount: 0, coin: 1, ax: account2.ax, ay: account2.ay,
        ethAddress: account2.ethAddress, onChain: true });

    await bb.build();

    await rollupDB.consolidate(bb);
}

async function checkDb(memDb, toCheckDb){
    // Check root
    const memRoot = await memDb.db.getRoot();
    const checkRoot = await toCheckDb.db.getRoot();
    expect(memRoot).to.be.equal(checkRoot);
    
    // Check database
    const keys = Object.keys(memDb.db.nodes);
    for (const key of keys) {
        const valueMem = JSON.stringify(stringifyBigInts(await memDb.db.get(key)));
        const valueToCheck = JSON.stringify(stringifyBigInts(await toCheckDb.db.get(key)));
        expect(lodash.isEqual(valueMem, valueToCheck)).to.be.equal(true);
    }
}

describe("RollupDb", async function () {
    let rollupMemDb;
    let rollupLevelDb;

    const pathDb = `${__dirname}/tmp-rollupDb`;

    it("should initialize with memory database", async () => {
        const db = new SMTMemDB();
        rollupMemDb = await RollupDB(db);
        await initRollupDb(rollupMemDb);
    });

    it("should initialize with level-db database", async () => {
        const db = new SMTLevelDb(pathDb);
        rollupLevelDb = await RollupDB(db);
        await initRollupDb(rollupLevelDb);
    });

    it("should check equal databases", async () => {
        await checkDb(rollupMemDb, rollupLevelDb);
    });

    after(async () => {
        await exec(`rm -rf ${pathDb}`);
    });
});

describe("RollupDb - rollback functionality", async function () {
    let rollupDb;

    const account1 = new RollupAccount(1);
    const account2 = new RollupAccount(2);
    const account3 = new RollupAccount(3);

    it("should initialize with memory database", async () => {
        const db = new SMTMemDB();
        rollupDb = await RollupDB(db);
    });

    it("should add one deposit", async () => {
        const bb = await rollupDb.buildBatch(4, 8);
    
        bb.addTx({ fromIdx: 1, loadAmount: 10, coin: 0, ax: account1.ax, ay: account1.ay,
            ethAddress: account1.ethAddress, onChain: true });

        await bb.build();
        await rollupDb.consolidate(bb);
    });

    it("should forge empty batch", async () => {
        const bb = await rollupDb.buildBatch(4, 8);
        await bb.build();
        await rollupDb.consolidate(bb);
    });

    it("should add one deposit", async () => {
        const bb = await rollupDb.buildBatch(4, 8);

        bb.addTx({ fromIdx: 2, loadAmount: 10, coin: 0, ax: account1.ax, ay: account1.ay,
            ethAddress: account2.ethAddress, onChain: true }); 

        await bb.build();
        await rollupDb.consolidate(bb);
    });

    it("Check rollup database", async () => {
        // get info by Id
        const resId = await rollupDb.getStateByIdx(1);
        // check leaf info matches deposit
        expect(resId.ax).to.be.equal(account1.ax);
        expect(resId.ay).to.be.equal(account1.ay);
        expect(resId.ethAddress).to.be.equal(account1.ethAddress.toString().toLowerCase());

        // get leafs info by AxAy
        const resAxAy = await rollupDb.getStateByAxAy(account1.ax, account1.ay);
        // check leaf info matches deposits
        expect(resAxAy.length).to.be.equal(2); // 2 deposits with equal Ax, Ay
        expect(resAxAy[0].ethAddress).to.be.equal(account1.ethAddress.toString().toLowerCase());
        expect(resAxAy[1].ethAddress).to.be.equal(account2.ethAddress.toString().toLowerCase());

        // get leaf info by ethAddress
        const resEthAddress = await rollupDb.getStateByEthAddr(account1.ethAddress.toString());
        // check leaf info matches deposit
        expect(resEthAddress[0].ax).to.be.equal(account1.ax);
        expect(resEthAddress[0].ay).to.be.equal(account1.ay);

        // get leaf info by ethAddress
        const resEthAddress2 = await rollupDb.getStateByEthAddr(account2.ethAddress.toString());
        // check leaf info matches deposit
        expect(resEthAddress2[0].ax).to.be.equal(account1.ax);
        expect(resEthAddress2[0].ay).to.be.equal(account1.ay);
    });

    it("should rollback last off-chain transaction", async () => {
        // old states
        const oldNumBatch = rollupDb.lastBatch;
        const oldStateId1 = await rollupDb.getStateByIdx(1);
        const oldStateId2 = await rollupDb.getStateByIdx(2);

        // add off-chain transaction
        const tx = {
            fromIdx: 1,
            toIdx: 2,
            amount: 3,
        };
        const bb = await rollupDb.buildBatch(4, 8);
        bb.addTx(tx);
        await bb.build();
        await rollupDb.consolidate(bb);

        // check current state database
        const stateId1 = await rollupDb.getStateByIdx(1);
        expect(stateId1.amount.toJSNumber()).to.be.equal(oldStateId1.amount.toJSNumber() - tx.amount);
        const stateId2 = await rollupDb.getStateByIdx(2);
        expect(stateId2.amount.toJSNumber()).to.be.equal(oldStateId2.amount.toJSNumber() + tx.amount);

        // rollback database
        await rollupDb.rollbackToBatch(oldNumBatch);

        // check states
        const newStateId1 = await rollupDb.getStateByIdx(1);
        const newStateId2 = await rollupDb.getStateByIdx(2);
        expect(lodash.isEqual(newStateId1, oldStateId1)).to.be.equal(true);
        expect(lodash.isEqual(newStateId2, oldStateId2)).to.be.equal(true);
    });

    it("should rollback last deposit on-chain transaction", async () => {
        // old states
        const oldNumBatch = rollupDb.lastBatch;
        const oldStateId1 = await rollupDb.getStateByIdx(1);
        const oldStateId2 = await rollupDb.getStateByIdx(2);
        const oldStateId3 = await rollupDb.getStateByIdx(3);
        const oldStatesAxAy = await rollupDb.getStateByAxAy(account1.ax, account1.ay);
        const oldStateEthAdd1 = await rollupDb.getStateByEthAddr(account1.ethAddress.toString());
        const oldStateEthAdd2 = await rollupDb.getStateByEthAddr(account2.ethAddress.toString());
        const oldStateEthAdd3 = await rollupDb.getStateByEthAddr(account3.ethAddress.toString());

        // add deposit on-chain transaction
        const bb = await rollupDb.buildBatch(4, 8);
        const tx = {
            fromIdx: 3,
            loadAmount: 10,
            coin: 0,
            ax: account1.ax,
            ay: account1.ay,
            ethAddress: account3.ethAddress,
            onChain: true,
        };
        bb.addTx(tx);
        await bb.build();
        await rollupDb.consolidate(bb);

        // check current state database
        const stateId3 = await rollupDb.getStateByIdx(3);
        expect(stateId3.amount.toJSNumber()).to.be.equal(tx.loadAmount);

        const stateAxAy = await rollupDb.getStateByAxAy(account1.ax, account1.ay);
        expect(stateAxAy.length).to.be.equal(3);

        const stateEthAdd3 = await rollupDb.getStateByEthAddr(account3.ethAddress.toString());
        expect(stateEthAdd3.length).to.be.equal(1);
        // rollback database
        await rollupDb.rollbackToBatch(oldNumBatch);

        // check states
        const newStateId1 = await rollupDb.getStateByIdx(1);
        const newStateId2 = await rollupDb.getStateByIdx(2);
        const newStateId3 = await rollupDb.getStateByIdx(3);
        const newStatesAxAy = await rollupDb.getStateByAxAy(account1.ax, account1.ay);
        const newStateEthAdd1 = await rollupDb.getStateByEthAddr(account1.ethAddress.toString());
        const newStateEthAdd2 = await rollupDb.getStateByEthAddr(account2.ethAddress.toString());
        const newStateEthAdd3 = await rollupDb.getStateByEthAddr(account3.ethAddress.toString());

        expect(lodash.isEqual(newStateId1, oldStateId1)).to.be.equal(true);
        expect(lodash.isEqual(newStateId2, oldStateId2)).to.be.equal(true);
        expect(lodash.isEqual(newStateId3, oldStateId3)).to.be.equal(true);
        expect(lodash.isEqual(newStatesAxAy, oldStatesAxAy)).to.be.equal(true);
        expect(lodash.isEqual(newStateEthAdd1, oldStateEthAdd1)).to.be.equal(true);
        expect(lodash.isEqual(newStateEthAdd2, oldStateEthAdd2)).to.be.equal(true);
        expect(lodash.isEqual(newStateEthAdd3, oldStateEthAdd3)).to.be.equal(true);
    });

    it("should rollback two batches", async () => {
        // old states
        const oldNumBatch = rollupDb.lastBatch;
        const oldStateId1 = await rollupDb.getStateByIdx(1);
        const oldStateId2 = await rollupDb.getStateByIdx(2);
        const oldStateId3 = await rollupDb.getStateByIdx(3);
        const oldStatesAxAy = await rollupDb.getStateByAxAy(account1.ax, account1.ay);
        const oldStateEthAdd1 = await rollupDb.getStateByEthAddr(account1.ethAddress.toString());
        const oldStateEthAdd2 = await rollupDb.getStateByEthAddr(account2.ethAddress.toString());
        const oldStateEthAdd3 = await rollupDb.getStateByEthAddr(account3.ethAddress.toString());
        // add deposit on-chain transaction
        const bb = await rollupDb.buildBatch(4, 8);
        const tx = {
            fromIdx: 3,
            loadAmount: 10,
            coin: 0,
            ax: account1.ax,
            ay: account1.ay,
            ethAddress: account3.ethAddress,
            onChain: true,
        };
        bb.addTx(tx);
        await bb.build();
        await rollupDb.consolidate(bb);

        // check current state database
        const stateId3 = await rollupDb.getStateByIdx(3);
        expect(stateId3.amount.toJSNumber()).to.be.equal(tx.loadAmount);

        const stateAxAy = await rollupDb.getStateByAxAy(account1.ax, account1.ay);
        expect(stateAxAy.length).to.be.equal(3);
        const stateEthAdd3 = await rollupDb.getStateByEthAddr(account3.ethAddress.toString());
        expect(stateEthAdd3.length).to.be.equal(1);

        // add off-chain transaction
        const tx2 = {
            fromIdx: 1,
            toIdx: 2,
            amount: 3,
        };
        const bb2 = await rollupDb.buildBatch(4, 8);
        bb2.addTx(tx2);
        await bb2.build();
        await rollupDb.consolidate(bb2);

        // check current state database
        const stateId1 = await rollupDb.getStateByIdx(1);
        expect(stateId1.amount.toJSNumber()).to.be.equal(oldStateId1.amount.toJSNumber() - tx2.amount);
        const stateId2 = await rollupDb.getStateByIdx(2);
        expect(stateId2.amount.toJSNumber()).to.be.equal(oldStateId2.amount.toJSNumber() + tx2.amount);

        // rollback database
        await rollupDb.rollbackToBatch(oldNumBatch);

        // check states
        const newStateId1 = await rollupDb.getStateByIdx(1);
        const newStateId2 = await rollupDb.getStateByIdx(2);
        const newStateId3 = await rollupDb.getStateByIdx(3);
        const newStatesAxAy = await rollupDb.getStateByAxAy(account1.ax, account1.ay);
        const newStateEthAdd1 = await rollupDb.getStateByEthAddr(account1.ethAddress.toString());
        const newStateEthAdd2 = await rollupDb.getStateByEthAddr(account2.ethAddress.toString());
        const newStateEthAdd3 = await rollupDb.getStateByEthAddr(account3.ethAddress.toString());

        expect(lodash.isEqual(newStateId1, oldStateId1)).to.be.equal(true);
        expect(lodash.isEqual(newStateId2, oldStateId2)).to.be.equal(true);
        expect(lodash.isEqual(newStateId3, oldStateId3)).to.be.equal(true);
        expect(lodash.isEqual(newStatesAxAy, oldStatesAxAy)).to.be.equal(true);
        expect(lodash.isEqual(newStateEthAdd1, oldStateEthAdd1)).to.be.equal(true);
        expect(lodash.isEqual(newStateEthAdd2, oldStateEthAdd2)).to.be.equal(true);
        expect(lodash.isEqual(newStateEthAdd3, oldStateEthAdd3)).to.be.equal(true);
    });

    it("should rollback to genesis state", async () => {
        const futureState = rollupDb.lastBatch + 1;
        try {
            await rollupDb.rollbackToBatch(futureState);
            expect(true).to.be.equal(false);
        } catch(error){
            const flagError = error.message.includes("Cannot rollback to future state");
            expect(flagError).to.be.equal(true); 
        }
    });

    it("should rollback to genesis state", async () => {
        const genesisBatch = 0;
        await rollupDb.rollbackToBatch(genesisBatch);

        // check states
        const newStateId1 = await rollupDb.getStateByIdx(1);
        const newStateId2 = await rollupDb.getStateByIdx(2);
        const newStateId3 = await rollupDb.getStateByIdx(3);
        const newStatesAxAy = await rollupDb.getStateByAxAy(account1.ax, account1.ay);
        const newStateEthAdd1 = await rollupDb.getStateByEthAddr(account1.ethAddress.toString());
        const newStateEthAdd2 = await rollupDb.getStateByEthAddr(account2.ethAddress.toString());
        const newStateEthAdd3 = await rollupDb.getStateByEthAddr(account3.ethAddress.toString());

        expect(newStateId1).to.be.equal(null);
        expect(newStateId2).to.be.equal(null);
        expect(newStateId3).to.be.equal(null);
        expect(newStatesAxAy).to.be.equal(null);
        expect(newStateEthAdd1).to.be.equal(null);
        expect(newStateEthAdd2).to.be.equal(null);
        expect(newStateEthAdd3).to.be.equal(null);
    });

    it("should start new rollupdb state", async () => {
        const db = new SMTMemDB();
        rollupDb = await RollupDB(db);
    });

    it("should add three deposits", async () => {
        const bb = await rollupDb.buildBatch(4, 8);

        bb.addTx({ fromIdx: 1, loadAmount: 10, coin: 0, ax: account1.ax, ay: account1.ay,
            ethAddress: account2.ethAddress, onChain: true }); 
        bb.addTx({ fromIdx: 2, loadAmount: 10, coin: 0, ax: account1.ax, ay: account1.ay,
            ethAddress: account2.ethAddress, onChain: true }); 
        bb.addTx({ fromIdx: 3, loadAmount: 10, coin: 0, ax: account1.ax, ay: account1.ay,
            ethAddress: account2.ethAddress, onChain: true }); 

        await bb.build();
        await rollupDb.consolidate(bb);
    });

    it("should add off-chain transaction", async () => {
        const lastBatch = 6;
        const numBatchToForge = 4;
        // move forward 'numBatchToForge' batch
        for (let i = 0; i<numBatchToForge ;i++ ){
            const bb = await rollupDb.buildBatch(4, 8);
            await bb.build();
            await rollupDb.consolidate(bb);
        }

        // add off-chain transaction
        const tx = {
            fromIdx: 3,
            toIdx: 0,
            coin: 0,
            amount: 5,
        };
        const bb2 = await rollupDb.buildBatch(4, 8);
        bb2.addTx(tx);
        await bb2.build();
        await rollupDb.consolidate(bb2);

        expect(rollupDb.lastBatch).to.be.equal(lastBatch);
    });

    it("should rollback and check accounts", async () => {
        const initialAmount = 10;

        // rollback database
        await rollupDb.rollbackToBatch(5);

        const newStateId1 = await rollupDb.getStateByIdx(1);
        const newStateId2 = await rollupDb.getStateByIdx(2);
        const newStateId3 = await rollupDb.getStateByIdx(3);
        
        expect(newStateId1.amount.toString()).to.be.equal(initialAmount.toString());
        expect(newStateId2.amount.toString()).to.be.equal(initialAmount.toString());
        expect(newStateId3.amount.toString()).to.be.equal(initialAmount.toString());

        // add off-chain transaction
        const amountToWithdraw = 1;
        const tx = {
            fromIdx: 1,
            toIdx: 0,
            coin: 0,
            amount: amountToWithdraw,
        };
        const bb = await rollupDb.buildBatch(4, 8);
        bb.addTx(tx);
        await bb.build();
        await rollupDb.consolidate(bb);

        const finalStateId1 = await rollupDb.getStateByIdx(1);
        const finalStateId2 = await rollupDb.getStateByIdx(2);
        const finalStateId3 = await rollupDb.getStateByIdx(3);
        
        expect(finalStateId1.amount.toString()).to.be.equal((initialAmount - amountToWithdraw).toString());
        expect(finalStateId2.amount.toString()).to.be.equal(initialAmount.toString());
        expect(finalStateId3.amount.toString()).to.be.equal(initialAmount.toString());
    });
});