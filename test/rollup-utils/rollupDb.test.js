const chai = require("chai");
const { expect } = chai;
const { assert } = chai;
const { stringifyBigInts } = require("snarkjs");
const lodash = require("lodash");
const SMTMemDB = require("circomlib").SMTMemDB;
const util = require("util");
const exec = util.promisify( require("child_process").exec);

const RollupAccount = require("../../js/rollupaccount");
const RollupDB = require("../../js/rollupdb");
const { SMTLevelDb } = require("../../rollup-utils/smt-leveldb");
const { bigInt } = require("snarkjs");

async function initRollupDb(rollupDB) {

    const bb = await rollupDB.buildBatch(4, 8);

    const account1 = new RollupAccount(1);
    const account2 = new RollupAccount(2);

    bb.addTx({ 
        loadAmount: 10, 
        coin: 0, 
        fromAx: account1.ax, 
        fromAy: account1.ay,
        fromEthAddr: account1.ethAddress,
        toAx: 0,
        toAy: 0,
        toEthAddr: 0,
        onChain: true 
    });

    bb.addTx({ 
        loadAmount: 10, 
        coin: 1, 
        fromAx: account1.ax, 
        fromAy: account1.ay,
        fromEthAddr: account1.ethAddress,
        toAx: 0,
        toAy: 0,
        toEthAddr: 0, 
        onChain: true 
    });

    bb.addTx({  
        loadAmount: 0, 
        coin: 0, 
        fromAx: account2.ax, 
        fromAy: account2.ay,
        fromEthAddr: account2.ethAddress,
        toAx: 0,
        toAy: 0,
        toEthAddr: 0, 
        onChain: true 
    });

    bb.addTx({
        loadAmount: 0, 
        coin: 1, 
        fromAx: account2.ax, 
        fromAy: account2.ay,
        fromEthAddr: account2.ethAddress,
        toAx: 0,
        toAy: 0,
        toEthAddr: 0, 
        onChain: true 
    });

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

describe("Rollup Db - batchbuilder", async function(){
    it("Should get states correctly", async () => {
        // Start a new state
        const db = new SMTMemDB();
        const rollupDB = await RollupDB(db);
        const bb = await rollupDB.buildBatch(4, 8);
    
        const account1 = new RollupAccount(1);
        const account2 = new RollupAccount(2);

        bb.addTx({
            loadAmount: 1000,
            coin: 1,
            fromAx: account1.ax,
            fromAy: account1.ay,
            fromEthAddr: account1.ethAddress,
            toAx: 0,
            toAy: 0,
            toEthAddr: 0,
            onChain: true
        });
    
        bb.addTx({
            loadAmount: 2000,
            coin: 1,
            fromAx: account2.ax,
            fromAy: account2.ay,
            fromEthAddr: account2.ethAddress,
            toAx: 0,
            toAy: 0,
            toEthAddr: 0,
            onChain: true
        });
    
        bb.addTx({
            loadAmount: 3000,
            coin: 2,
            fromAx: account1.ax,
            fromAy: account1.ay,
            fromEthAddr: account1.ethAddress,
            toAx: 0,
            toAy: 0,
            toEthAddr: 0,
            onChain: true
        });
    
        await bb.build();
        bb.getInput();
    
        await rollupDB.consolidate(bb);
    
        const s1 = await rollupDB.getStateByIdx(1);
        assert.equal(s1.ax, account1.ax);
        assert.equal(s1.ay, account1.ay);
        assert.equal(s1.ethAddress, account1.ethAddress);
        assert.equal(s1.amount, 1000);
        assert.equal(s1.coin, 1);
        assert.equal(s1.nonce, 0);
    
        const s2 = await rollupDB.getStateByIdx(2);
        assert.equal(s2.ax, account2.ax);
        assert.equal(s2.ay, account2.ay);
        assert.equal(s2.ethAddress, account2.ethAddress);
        assert.equal(s2.amount, 2000);
        assert.equal(s2.coin, 1);
        assert.equal(s2.nonce, 0);
    
        const bb2 = await rollupDB.buildBatch(4, 8);

        const tx = {
            toAx: account2.ax,
            toAy: account2.ay,
            toEthAddr: account2.ethAddress,
            coin: 1,
            amount: bigInt("50"),
            nonce: 0,
            userFee: bigInt("6")
        };

        account1.signTx(tx);
        bb2.addTx(tx);
    
        bb2.addCoin(1, 5);
    
        await bb2.build();
        bb2.getInput();
    
        await rollupDB.consolidate(bb2);
    
        const s2_1 = await rollupDB.getStateByIdx(1);
        assert.equal(s2_1.ax, account1.ax);
        assert.equal(s2_1.ay, account1.ay);
        assert.equal(s2_1.ethAddress, account1.ethAddress);
        assert.equal(s2_1.amount, 945);
        assert.equal(s2_1.coin, 1);
        assert.equal(s2_1.nonce, 1);
    
        const s2_2 = await rollupDB.getStateByIdx(2);
        assert.equal(s2_2.ax, account2.ax);
        assert.equal(s2_2.ay, account2.ay);
        assert.equal(s2_2.ethAddress, account2.ethAddress);
        assert.equal(s2_2.amount, 2050);
        assert.equal(s2_2.coin, 1);
        assert.equal(s2_2.nonce, 0);
    
        const s2_3 = await rollupDB.getStateByIdx(3);
        assert.equal(s2_3.ax, account1.ax);
        assert.equal(s2_3.ay, account1.ay);
        assert.equal(s2_3.ethAddress, account1.ethAddress);
        assert.equal(s2_3.amount, 3000);
        assert.equal(s2_3.coin, 2);
        assert.equal(s2_3.nonce, 0);
    
        const s3 = await rollupDB.getStateByAxAy(account1.ax, account1.ay);
        assert.deepEqual(s3[0], s2_1);
        assert.deepEqual(s3[1], s2_3);
    
        const s4 = await rollupDB.getStateByEthAddr(account1.ethAddress);
        assert.deepEqual(s4[0], s2_1);
        assert.deepEqual(s4[1], s2_3);
    
        const s5 = await rollupDB.getStateByEthAddr(account2.ethAddress);
        assert.deepEqual(s5[0], s2_2);
    });

    it("Should check error offchain with loadAmount", async () => {
        // Start a new state
        const db = new SMTMemDB();
        const rollupDB = await RollupDB(db);
        const bb = await rollupDB.buildBatch(4, 8);
        
        const account1 = new RollupAccount(1);
        const account2 = new RollupAccount(2);
        
        bb.addTx({
            loadAmount: 1000,
            coin: 0,
            fromAx: account1.ax,
            fromAy: account1.ay,
            fromEthAddr: account1.ethAddress,
            toAx: 0,
            toAy: 0,
            toEthAddr: 0,
            onChain: true
        });
        
        bb.addTx({
            loadAmount: 2000,
            coin: 0,
            fromAx: account2.ax,
            fromAy: account2.ay,
            fromEthAddr: account2.ethAddress,
            toAx: 0,
            toAy: 0,
            toEthAddr: 0,
            onChain: true
        });
        
        await bb.build();
        await rollupDB.consolidate(bb);
        
        const bb2 = await rollupDB.buildBatch(4, 8);
        
        const tx = {
            toAx: account2.ax,
            toAy: account2.ay,
            toEthAddr: account2.ethAddress,
            loadAmount: 100,
            coin: 0,
            amount: 50,
            nonce: 0,
            userFee: 10
        };

        account1.signTx(tx);
        bb2.addTx(tx);
        bb2.addCoin(0, 5);

        try {
            await bb2.build();
            assert(false);
        } catch (error) {
            assert.include(error.message, "Load amount must be 0 for offChainTxs");
        }
    });

    it("Should check error offchain send to unexisting leaf", async () => {
        // Start a new state
        const db = new SMTMemDB();
        const rollupDB = await RollupDB(db);
        const bb = await rollupDB.buildBatch(4, 8);
        
        const account1 = new RollupAccount(1);
        const account2 = new RollupAccount(2);
        const account3 = new RollupAccount(3);
        
        bb.addTx({
            loadAmount: 1000,
            coin: 0,
            fromAx: account1.ax,
            fromAy: account1.ay,
            fromEthAddr: account1.ethAddress,
            toAx: 0,
            toAy: 0,
            toEthAddr: 0,
            onChain: true
        });
        
        bb.addTx({
            loadAmount: 2000,
            coin: 1,
            fromAx: account2.ax,
            fromAy:account2.ay,
            fromEthAddr: account2.ethAddress,
            toAx: 0,
            toAy: 0,
            toEthAddr: 0,
            onChain: true
        });
        
        await bb.build();
        await rollupDB.consolidate(bb);
        
        const bb2 = await rollupDB.buildBatch(4, 8);
        
        const tx = {
            toAx: account3.ax,
            toAy: account3.ay,
            toEthAddr: account3.ethAddress,
            coin: 0,
            amount: 50,
            nonce: 0,
            userFee: 10
        };
        account1.signTx(tx);
        bb2.addTx(tx);
        
        bb2.addCoin(0, 5);
        try { 
            await bb2.build();
            assert(false);
        } catch (error) {
            assert.include(error.message, "trying to send to a non existing account");
        }
    });

    it("Should check error loadAmount must be 0 from off-chain transaction", async () => {
        // Start a new state
        const db = new SMTMemDB();
        const rollupDB = await RollupDB(db);
        const bb = await rollupDB.buildBatch(4, 8);
        
        const account1 = new RollupAccount(1);
        const account2 = new RollupAccount(2);
        const account3 = new RollupAccount(3);
        
        bb.addTx({
            loadAmount: 1000,
            coin: 0,
            fromAx: account1.ax,
            fromAy: account1.ay,
            fromEthAddr: account1.ethAddress,
            toAx: 0,
            toAy: 0,
            toEthAddr: 0,
            onChain: true
        });
        
        bb.addTx({
            loadAmount: 2000,
            coin: 1,
            fromAx: account2.ax,
            fromAy: account2.ay,
            fromEthAddr: account2.ethAddress,
            toAx: 0,
            toAy: 0,
            toEthAddr: 0,
            onChain: true
        });
        
        await bb.build();
        await rollupDB.consolidate(bb);
        
        const bb2 = await rollupDB.buildBatch(4, 8);
        
        bb2.addTx({
            loadAmount: 50,
            coin: 1,
            fromAx: account3.ax,
            fromAy: account3.ay,
            fromEthAddr: account3.ethAddress,
            toAx: 0,
            toAy: 0,
            toEthAddr: 0,
        });
        
        try {
            await bb2.build();   
            await rollupDB.consolidate(bb2);
            assert(false);
        } catch (error) {
            assert.include(error.message, "Load amount must be 0 for offChainTxs");
        }
    });
});

describe("RollupDb - LevelDb", async function () {
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
    
        bb.addTx({  
            loadAmount: 10, 
            coin: 0, 
            fromAx: account1.ax, 
            fromAy: account1.ay,
            fromEthAddr: account1.ethAddress,
            toAx: 0,
            toAy: 0,
            toEthAddr: 0, 
            onChain: true 
        });

        await bb.build();
        await rollupDb.consolidate(bb);
    });

    it("should forge empty batch", async () => {
        const bb = await rollupDb.buildBatch(4, 8);
        await bb.build();
        await rollupDb.consolidate(bb);
    });

    it("should add two deposits", async () => {
        const bb = await rollupDb.buildBatch(4, 8);

        bb.addTx({  
            loadAmount: 10, 
            coin: 1, 
            fromAx: account1.ax, 
            fromAy: account1.ay,
            fromEthAddr: account2.ethAddress,
            toAx: 0,
            toAy: 0,
            toEthAddr: 0, 
            onChain: true 
        });

        bb.addTx({  
            loadAmount: 10, 
            coin: 0, 
            fromAx: account2.ax, 
            fromAy: account2.ay,
            fromEthAddr: account1.ethAddress,
            toAx: 0,
            toAy: 0,
            toEthAddr: 0, 
            onChain: true 
        });

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
        const oldStateId3 = await rollupDb.getStateByIdx(3);

        const tx = {
            fromAx: account1.ax,
            fromAy: account1.ay,
            fromEthAddr: account2.ethAddress,
            toAx: account2.ax,
            toAy: account2.ay,
            toEthAddr: account1.ethAddress,
            amount: 3,
            coin: 0,
        };

        const bb = await rollupDb.buildBatch(4, 8);
        bb.addTx(tx);
        await bb.build();
        await rollupDb.consolidate(bb);

        // check current state database
        const stateId1 = await rollupDb.getStateByIdx(1);
        const stateId2 = await rollupDb.getStateByIdx(2);
        const stateId3 = await rollupDb.getStateByIdx(3);

        expect(stateId1.amount.toJSNumber()).to.be.equal(oldStateId1.amount.toJSNumber() - tx.amount);
        expect(stateId2.amount.toJSNumber()).to.be.equal(oldStateId2.amount.toJSNumber());
        expect(stateId3.amount.toJSNumber()).to.be.equal(oldStateId3.amount.toJSNumber() + tx.amount);

        // rollback database
        await rollupDb.rollbackToBatch(oldNumBatch);

        // check states
        const newStateId1 = await rollupDb.getStateByIdx(1);
        const newStateId2 = await rollupDb.getStateByIdx(2);
        const newStateId3 = await rollupDb.getStateByIdx(3);
        expect(lodash.isEqual(newStateId1, oldStateId1)).to.be.equal(true);
        expect(lodash.isEqual(newStateId2, oldStateId2)).to.be.equal(true);
        expect(lodash.isEqual(newStateId3, oldStateId3)).to.be.equal(true);
    });
    
    it("should rollback last deposit on-chain transaction", async () => {
        // old states
        const oldNumBatch = rollupDb.lastBatch;
        const oldStateId1 = await rollupDb.getStateByIdx(1);
        const oldStateId2 = await rollupDb.getStateByIdx(2);
        const oldStateId3 = await rollupDb.getStateByIdx(3);
        const oldStateId4 = await rollupDb.getStateByIdx(4);
        const oldStatesAxAy = await rollupDb.getStateByAxAy(account1.ax, account1.ay);
        const oldStateEthAdd1 = await rollupDb.getStateByEthAddr(account1.ethAddress.toString());
        const oldStateEthAdd2 = await rollupDb.getStateByEthAddr(account2.ethAddress.toString());
        const oldStateEthAdd3 = await rollupDb.getStateByEthAddr(account3.ethAddress.toString());

        // add deposit on-chain transaction
        const bb = await rollupDb.buildBatch(4, 8);
        
        const tx = {  
            loadAmount: 10, 
            coin: 2, 
            fromAx: account1.ax, 
            fromAy: account1.ay,
            fromEthAddr: account3.ethAddress,
            toAx: 0,
            toAy: 0,
            toEthAddr: 0, 
            onChain: true 
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
        const newStateId4 = await rollupDb.getStateByIdx(4);
        const newStatesAxAy = await rollupDb.getStateByAxAy(account1.ax, account1.ay);
        const newStateEthAdd1 = await rollupDb.getStateByEthAddr(account1.ethAddress.toString());
        const newStateEthAdd2 = await rollupDb.getStateByEthAddr(account2.ethAddress.toString());
        const newStateEthAdd3 = await rollupDb.getStateByEthAddr(account3.ethAddress.toString());

        expect(lodash.isEqual(newStateId1, oldStateId1)).to.be.equal(true);
        expect(lodash.isEqual(newStateId2, oldStateId2)).to.be.equal(true);
        expect(lodash.isEqual(newStateId3, oldStateId3)).to.be.equal(true);
        expect(lodash.isEqual(newStateId4, oldStateId4)).to.be.equal(true);
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
        const oldStateId4 = await rollupDb.getStateByIdx(4);
        const oldStatesAxAy = await rollupDb.getStateByAxAy(account1.ax, account1.ay);
        const oldStateEthAdd1 = await rollupDb.getStateByEthAddr(account1.ethAddress.toString());
        const oldStateEthAdd2 = await rollupDb.getStateByEthAddr(account2.ethAddress.toString());
        const oldStateEthAdd3 = await rollupDb.getStateByEthAddr(account3.ethAddress.toString());
        
        // add deposit on-chain transaction
        const bb = await rollupDb.buildBatch(4, 8);
        const tx = {
            loadAmount: 10, 
            coin: 2, 
            fromAx: account1.ax, 
            fromAy: account1.ay,
            fromEthAddr: account3.ethAddress,
            toAx: 0,
            toAy: 0,
            toEthAddr: 0, 
            onChain: true
        };

        bb.addTx(tx);
        
        await bb.build();
        await rollupDb.consolidate(bb);

        // check current state database
        const stateId4 = await rollupDb.getStateByIdx(4);
        expect(stateId4.amount.toJSNumber()).to.be.equal(tx.loadAmount);

        const stateAxAy = await rollupDb.getStateByAxAy(account1.ax, account1.ay);
        expect(stateAxAy.length).to.be.equal(3);
        const stateEthAdd3 = await rollupDb.getStateByEthAddr(account3.ethAddress.toString());
        expect(stateEthAdd3.length).to.be.equal(1);

        // add off-chain transaction
        const tx2 = {
            fromAx: account1.ax,
            fromAy: account1.ay,
            fromEthAddr: account2.ethAddress,
            toAx: account2.ax,
            toAy: account2.ay,
            toEthAddr: account1.ethAddress,
            amount: 3,
            coin: 0,
        };
        const bb2 = await rollupDb.buildBatch(4, 8);
        bb2.addTx(tx2);
        await bb2.build();
        await rollupDb.consolidate(bb2);

        // check current state database
        const stateId1 = await rollupDb.getStateByIdx(1);
        const stateId2 = await rollupDb.getStateByIdx(2);
        const stateId3 = await rollupDb.getStateByIdx(3);
        expect(stateId1.amount.toJSNumber()).to.be.equal(oldStateId1.amount.toJSNumber() - tx2.amount);
        expect(stateId2.amount.toJSNumber()).to.be.equal(oldStateId2.amount.toJSNumber());
        expect(stateId3.amount.toJSNumber()).to.be.equal(oldStateId3.amount.toJSNumber() + tx2.amount);

        // rollback database
        await rollupDb.rollbackToBatch(oldNumBatch);

        // check states
        const newStateId1 = await rollupDb.getStateByIdx(1);
        const newStateId2 = await rollupDb.getStateByIdx(2);
        const newStateId3 = await rollupDb.getStateByIdx(3);
        const newStateId4 = await rollupDb.getStateByIdx(4);
        const newStatesAxAy = await rollupDb.getStateByAxAy(account1.ax, account1.ay);
        const newStateEthAdd1 = await rollupDb.getStateByEthAddr(account1.ethAddress.toString());
        const newStateEthAdd2 = await rollupDb.getStateByEthAddr(account2.ethAddress.toString());
        const newStateEthAdd3 = await rollupDb.getStateByEthAddr(account3.ethAddress.toString());

        expect(lodash.isEqual(newStateId1, oldStateId1)).to.be.equal(true);
        expect(lodash.isEqual(newStateId2, oldStateId2)).to.be.equal(true);
        expect(lodash.isEqual(newStateId3, oldStateId3)).to.be.equal(true);
        expect(lodash.isEqual(newStateId4, oldStateId4)).to.be.equal(true);
        expect(lodash.isEqual(newStatesAxAy, oldStatesAxAy)).to.be.equal(true);
        expect(lodash.isEqual(newStateEthAdd1, oldStateEthAdd1)).to.be.equal(true);
        expect(lodash.isEqual(newStateEthAdd2, oldStateEthAdd2)).to.be.equal(true);
        expect(lodash.isEqual(newStateEthAdd3, oldStateEthAdd3)).to.be.equal(true);
    });

    it("should error when rollback to future state", async () => {
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

        bb.addTx({ 
            loadAmount: 10, 
            coin: 0, 
            fromAx: account1.ax, 
            fromAy: account1.ay,
            fromEthAddr: account1.ethAddress,
            toAx: 0,
            toAy: 0,
            toEthAddr: 0, 
            onChain: true 
        });

        bb.addTx({ 
            loadAmount: 10, 
            coin: 0, 
            fromAx: account2.ax, 
            fromAy: account2.ay,
            fromEthAddr: account2.ethAddress,
            toAx: 0,
            toAy: 0,
            toEthAddr: 0, 
            onChain: true 
        });

        bb.addTx({ 
            loadAmount: 10, 
            coin: 0, 
            fromAx: account3.ax, 
            fromAy: account3.ay,
            fromEthAddr: account3.ethAddress,
            toAx: 0,
            toAy: 0,
            toEthAddr: 0, 
            onChain: true 
        }); 

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
            fromAx: account3.ax,
            fromAy: account3.ay,
            fromEthAddr: account3.ethAddress,
            toAx: 0,
            toAy: 0,
            toEthAddr: 0,
            amount: 5,
            coin: 0,
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
            fromAx: account1.ax,
            fromAy: account1.ay,
            fromEthAddr: account2.ethAddress,
            toAx: 0,
            toAy: 0,
            toEthAddr: 0,
            amount: amountToWithdraw,
            coin: 0,
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