const chai = require("chai");
const path = require("path");
const snarkjs = require("snarkjs");
const compiler = require("circom");
const fs = require("fs");
const bigInt = require("snarkjs").bigInt;
const SMTMemDB = require("circomlib").SMTMemDB;
const RollupAccount = require("../js/rollupaccount");
const RollupDB = require("../js/rollupdb");
const checkBatch = require("./helpers/checkbatch");
const utils = require("../js/utils");
const assert = chai.assert;

const NTX = 5;
const NLEVELS = 8;

describe("Rollup Basic circuit TXs", function () {
    let circuit;

    this.timeout(100000);

    before( async() => {
        // const cirDef = await compiler(path.join(__dirname, "circuits", "rollup_test.circom"), {reduceConstraints:false});
        // fs.writeFileSync(path.join(`${__dirname}`, "circuit-example.json"), JSON.stringify(cirDef));
        const cirDef = JSON.parse(fs.readFileSync(path.join(`${__dirname}`, "circuit-example.json")));
        circuit = new snarkjs.Circuit(cirDef);
        console.log("NConstrains Rollup: " + circuit.nConstraints);
    });

    it("Should create empty txs", async () => {
        // Start a new state
        const db = new SMTMemDB();
        const rollupDB = await RollupDB(db);
        const bb = await rollupDB.buildBatch(NTX, NLEVELS);

        await bb.build();
        const input = bb.getInput();

        const w = circuit.calculateWitness(input, {logTrigger: false, logOutput: false, logSet: false});

        checkBatch(circuit, w, bb);
    });

    it("Should create 1 deposit on-chain TXs", async () => {
        // Start a new state
        const db = new SMTMemDB();
        const rollupDB = await RollupDB(db);
        const bb = await rollupDB.buildBatch(NTX, NLEVELS);

        const account1 = new RollupAccount(1);

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

        await bb.build();
        await rollupDB.consolidate(bb);
        const input = bb.getInput();

        const w = circuit.calculateWitness(input, {logTrigger:false, logOutput: false, logSet: false});

        checkBatch(circuit, w, bb);

        const state = await rollupDB.getStateByIdx(1);
        assert.equal(state.amount.toString(), 1000);
    });

    it("Should create 1 deposit on-chain and 1 deposit on top on-chain", async () => {
        // Start a new state
        const db = new SMTMemDB();
        const rollupDB = await RollupDB(db);
        const bb = await rollupDB.buildBatch(NTX, NLEVELS);

        const account1 = new RollupAccount(1);

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
            fromAx: account1.ax,
            fromAy: account1.ay,
            fromEthAddr: account1.ethAddress,
            toAx: 0,
            toAy: 0,
            toEthAddr: 0,
            onChain: true
        });

        await bb.build();
        await rollupDB.consolidate(bb);
        const input = bb.getInput();

        const w = circuit.calculateWitness(input, {logTrigger:false, logOutput: false, logSet: false});

        checkBatch(circuit, w, bb);

        const state = await rollupDB.getStateByIdx(1);
        assert.equal(state.amount.toString(), 3000);
    });

    it("Should create 2 deposit on-chain and then 1 transfer on-chain", async () => {
        // Start a new state
        const db = new SMTMemDB();
        const rollupDB = await RollupDB(db);
        const bb = await rollupDB.buildBatch(NTX, NLEVELS);

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

        const bb2 = await rollupDB.buildBatch(NTX, NLEVELS);

        bb2.addTx({
            fromAx: account1.ax,
            fromAy: account1.ay,
            fromEthAddr: account1.ethAddress,
            toAx: account2.ax,
            toAy: account2.ay,
            toEthAddr: account2.ethAddress,
            coin: 0,
            amount: 500,
            nonce: 0,
            onChain: true
        });

        await bb2.build();
        await rollupDB.consolidate(bb2);
        const input = bb2.getInput();
        const w = circuit.calculateWitness(input, {logTrigger:false, logOutput: false, logSet: false});

        checkBatch(circuit, w, bb2);

        const state1 = await rollupDB.getStateByIdx(1);
        assert.equal(state1.amount.toString(), 500);

        const state2 = await rollupDB.getStateByIdx(2);
        assert.equal(state2.amount.toString(), 2500);
    });

    it("Should create 1 deposit on-chain and then 1 deposit & transfer on-chain", async () => {
        // Start a new state
        const db = new SMTMemDB();
        const rollupDB = await RollupDB(db);
        const bb = await rollupDB.buildBatch(NTX, NLEVELS);

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

        await bb.build();
        await rollupDB.consolidate(bb);

        const bb2 = await rollupDB.buildBatch(NTX, NLEVELS);

        bb2.addTx({
            fromAx: account2.ax,
            fromAy: account2.ay,
            fromEthAddr: account2.ethAddress,
            toAx: account1.ax,
            toAy: account1.ay,
            toEthAddr: account1.ethAddress,
            coin: 0,
            loadAmount: 2000,
            amount: 500,
            nonce: 0,
            onChain: true
        });

        await bb2.build();
        await rollupDB.consolidate(bb2);
        const input = bb2.getInput();
        const w = circuit.calculateWitness(input, {logTrigger:false, logOutput: false, logSet: false});

        checkBatch(circuit, w, bb2);

        const state1 = await rollupDB.getStateByIdx(1);
        assert.equal(state1.amount.toString(), 1500);

        const state2 = await rollupDB.getStateByIdx(2);
        assert.equal(state2.amount.toString(), 1500);
    });

    it("Should create 1 deposit on-chain and then 1 force-withdraw on-chain", async () => {
        // Start a new state
        const db = new SMTMemDB();
        const rollupDB = await RollupDB(db);
        const bb = await rollupDB.buildBatch(NTX, NLEVELS);

        const account1 = new RollupAccount(1);

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

        await bb.build();
        await rollupDB.consolidate(bb);

        const bb2 = await rollupDB.buildBatch(NTX, NLEVELS);

        bb2.addTx({
            fromAx: account1.ax,
            fromAy: account1.ay,
            fromEthAddr: account1.ethAddress,
            toAx: 0,
            toAy: 0,
            toEthAddr: 0,
            coin: 0,
            amount: 500,
            nonce: 0,
            onChain: true
        });

        await bb2.build();
        await rollupDB.consolidate(bb2);
        const input = bb2.getInput();
        const w = circuit.calculateWitness(input, {logTrigger:false, logOutput: false, logSet: false});

        checkBatch(circuit, w, bb2);

        const state1 = await rollupDB.getStateByIdx(1);
        assert.equal(state1.amount.toString(), 500);
    });

    it("Should create 1 deposit & transfer on-chain, transfer is an exit", async () => {
        // Start a new state
        const db = new SMTMemDB();
        const rollupDB = await RollupDB(db);
        const bb = await rollupDB.buildBatch(NTX, NLEVELS);

        const account1 = new RollupAccount(1);

        bb.addTx({
            fromAx: account1.ax,
            fromAy: account1.ay,
            fromEthAddr: account1.ethAddress,
            toAx: 0,
            toAy: 0,
            toEthAddr: 0,
            coin: 0,
            loadAmount: 2000,
            amount: 500,
            nonce: 0,
            onChain: true
        });

        await bb.build();
        await rollupDB.consolidate(bb);
        const input = bb.getInput();
        const w = circuit.calculateWitness(input, {logTrigger:false, logOutput: false, logSet: false});
        
        checkBatch(circuit, w, bb);

        const state1 = await rollupDB.getStateByIdx(1);
        assert.equal(state1.amount.toString(), 1500);
    });

    it("Should create 2 deposits on-chain and then 1 off-chain transfer", async () => {
        // Start a new state
        const db = new SMTMemDB();
        const rollupDB = await RollupDB(db);
        const bb = await rollupDB.buildBatch(NTX, NLEVELS);

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

        const bb2 = await rollupDB.buildBatch(NTX, NLEVELS);

        const tx = {
            toAx: account2.ax,
            toAy: account2.ay,
            toEthAddr: account2.ethAddress,
            coin: 0,
            amount: 500,
            nonce: 0,
            userFee: 200
        };
        account1.signTx(tx);
        bb2.addTx(tx);
        bb2.addCoin(0, 100);
       
        await bb2.build();
        await rollupDB.consolidate(bb2);
        const input2 = bb2.getInput();

        const w2 = circuit.calculateWitness(input2, {logTrigger:false, logOutput: false, logSet: false});
        checkBatch(circuit, w2, bb2);

        const state1 = await rollupDB.getStateByIdx(1);
        assert.equal(state1.amount.toString(), 400);

        const state2 = await rollupDB.getStateByIdx(2);
        assert.equal(state2.amount.toString(), 2500);
    });

    it("Should create 1 deposit on-chain and then off-chain self transfer", async () => {
        // Start a new state
        const db = new SMTMemDB();
        const rollupDB = await RollupDB(db);
        const bb = await rollupDB.buildBatch(NTX, NLEVELS);

        const account1 = new RollupAccount(1);

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

        await bb.build();
        await rollupDB.consolidate(bb);

        const bb2 = await rollupDB.buildBatch(NTX, NLEVELS);

        const tx = {
            toAx: account1.ax,
            toAy: account1.ay,
            toEthAddr: account1.ethAddress,
            coin: 0,
            amount: 500,
            nonce: 0,
            userFee: 200
        };
        account1.signTx(tx);
        bb2.addTx(tx);
        bb2.addCoin(0, 100);
       
        await bb2.build();
        await rollupDB.consolidate(bb2);
        const input2 = bb2.getInput();

        const w2 = circuit.calculateWitness(input2, {logTrigger:false, logOutput: false, logSet: false});
        checkBatch(circuit, w2, bb2);

        const state1 = await rollupDB.getStateByIdx(1);
        assert.equal(state1.amount.toString(), 900);
    });

    it("Should create 2 deposits on-chain and then 3 off-chain transfers", async () => {
        // Start a new state
        const db = new SMTMemDB();
        const rollupDB = await RollupDB(db);
        const bb = await rollupDB.buildBatch(NTX, NLEVELS);

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

        const bb2 = await rollupDB.buildBatch(NTX, NLEVELS);

        const tx1 = {
            toAx: account2.ax,
            toAy: account2.ay,
            toEthAddr: account2.ethAddress,
            coin: 0,
            amount: 500,
            nonce: 0,
            userFee: 100
        };

        const tx2 = {
            toAx: account1.ax,
            toAy: account1.ay,
            toEthAddr: account1.ethAddress,
            coin: 0,
            amount: 1000,
            nonce: 0,
            userFee: 100
        };

        const tx3 = {
            toAx: account2.ax,
            toAy: account2.ay,
            toEthAddr: account2.ethAddress,
            coin: 0,
            amount: 500,
            nonce: 1,
            userFee: 100
        };

        account1.signTx(tx1);
        account2.signTx(tx2);
        account1.signTx(tx3);
        bb2.addTx(tx1);
        bb2.addTx(tx2);
        bb2.addTx(tx3);
        bb2.addCoin(0, 100);
       
        await bb2.build();
        await rollupDB.consolidate(bb2);
        const input2 = bb2.getInput();

        const w2 = circuit.calculateWitness(input2, {logTrigger:false, logOutput: false, logSet: false});
        checkBatch(circuit, w2, bb2);

        const state1 = await rollupDB.getStateByIdx(1);
        assert.equal(state1.amount.toString(), 800);

        const state2 = await rollupDB.getStateByIdx(2);
        assert.equal(state2.amount.toString(), 1900);
    });

    it("Should create 5 deposits on-chain and then 5 off-chain transfers", async () => {
        // Start a new state
        const db = new SMTMemDB();
        const rollupDB = await RollupDB(db);
        const bb = await rollupDB.buildBatch(NTX, NLEVELS);

        const account1 = new RollupAccount(1);
        const account2 = new RollupAccount(2);
        const account3 = new RollupAccount(3);
        const account4 = new RollupAccount(4);
        const account5 = new RollupAccount(5);

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

        bb.addTx({
            loadAmount: 3000,
            coin: 0,
            fromAx: account3.ax,
            fromAy: account3.ay,
            fromEthAddr: account3.ethAddress,
            toAx: 0,
            toAy: 0,
            toEthAddr: 0,
            onChain: true
        });

        bb.addTx({
            loadAmount: 4000,
            coin: 0,
            fromAx: account4.ax,
            fromAy: account4.ay,
            fromEthAddr: account4.ethAddress,
            toAx: 0,
            toAy: 0,
            toEthAddr: 0,
            onChain: true
        });

        bb.addTx({
            loadAmount: 5000,
            coin: 0,
            fromAx: account5.ax,
            fromAy: account5.ay,
            fromEthAddr: account5.ethAddress,
            toAx: 0,
            toAy: 0,
            toEthAddr: 0,
            onChain: true
        });

        await bb.build();
        await rollupDB.consolidate(bb);

        const bb2 = await rollupDB.buildBatch(NTX, NLEVELS);

        const tx1 = {
            toAx: account2.ax,
            toAy: account2.ay,
            toEthAddr: account2.ethAddress,
            coin: 0,
            amount: 500,
            nonce: 0,
            userFee: 100
        };

        const tx2 = {
            toAx: account3.ax,
            toAy: account3.ay,
            toEthAddr: account3.ethAddress,
            coin: 0,
            amount: 500,
            nonce: 0,
            userFee: 100
        };

        const tx3 = {
            toAx: account4.ax,
            toAy: account4.ay,
            toEthAddr: account4.ethAddress,
            coin: 0,
            amount: 500,
            nonce: 0,
            userFee: 100
        };

        const tx4 = {
            toAx: account5.ax,
            toAy: account5.ay,
            toEthAddr: account5.ethAddress,
            coin: 0,
            amount: 500,
            nonce: 0,
            userFee: 100
        };

        const tx5 = {
            toAx: account1.ax,
            toAy: account1.ay,
            toEthAddr: account1.ethAddress,
            coin: 0,
            amount: 500,
            nonce: 0,
            userFee: 100
        };

        account1.signTx(tx1);
        account2.signTx(tx2);
        account3.signTx(tx3);
        account4.signTx(tx4);
        account5.signTx(tx5);
        bb2.addTx(tx1);
        bb2.addTx(tx2);
        bb2.addTx(tx3);
        bb2.addTx(tx4);
        bb2.addTx(tx5);
        bb2.addCoin(0, 100);
       
        await bb2.build();
        await rollupDB.consolidate(bb2);
        const input2 = bb2.getInput();

        const w2 = circuit.calculateWitness(input2, {logTrigger:false, logOutput: false, logSet: false});
        checkBatch(circuit, w2, bb2);

        const state1 = await rollupDB.getStateByIdx(1);
        assert.equal(state1.amount.toString(), 900);

        const state2 = await rollupDB.getStateByIdx(2);
        assert.equal(state2.amount.toString(), 1900);

        const state3 = await rollupDB.getStateByIdx(3);
        assert.equal(state3.amount.toString(), 2900);

        const state4 = await rollupDB.getStateByIdx(4);
        assert.equal(state4.amount.toString(), 3900);

        const state5 = await rollupDB.getStateByIdx(5);
        assert.equal(state5.amount.toString(), 4900);
    });

    it("Should create 1 deposit on-chain of 0 amount", async () => {
        // Start a new state
        const db = new SMTMemDB();
        const rollupDB = await RollupDB(db);
        const bb = await rollupDB.buildBatch(NTX, NLEVELS);

        const account1 = new RollupAccount(1);

        bb.addTx({
            loadAmount: 0,
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
        await rollupDB.consolidate(bb);
        const input = bb.getInput();

        const w = circuit.calculateWitness(input, {logTrigger:false, logOutput: false, logSet: false});

        checkBatch(circuit, w, bb);

        const state1 = await rollupDB.getStateByIdx(1);
        assert.equal(state1.amount.toString(), 0);
    });

    it("Should create 1 deposit on-chain and then 1 off-chain exit", async () => {
        // Start a new state
        const db = new SMTMemDB();
        const rollupDB = await RollupDB(db);
        const bb = await rollupDB.buildBatch(NTX, NLEVELS);

        const account1 = new RollupAccount(1);

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
    
        await bb.build();
        await rollupDB.consolidate(bb);

        const bb2 = await rollupDB.buildBatch(NTX, NLEVELS);

        const tx = {
            toAx: 0,
            toAy: 0,
            toEthAddr: 0,
            coin: 0,
            amount: 50,
            nonce: 0,
            userFee: 10
        };
        account1.signTx(tx);
        bb2.addTx(tx);
        bb2.addCoin(0, 5);
       
        await bb2.build();
        await rollupDB.consolidate(bb2);
        const input2 = bb2.getInput();
    
        const w2 = circuit.calculateWitness(input2, {logTrigger:false, logOutput: false, logSet: false});
        checkBatch(circuit, w2, bb2);

        const state1 = await rollupDB.getStateByIdx(1);
        assert.equal(state1.amount.toString(), 945);
    });

    it("Should create 2 deposits on-chain and then 4 off-chain transfer, 3 of them are exits", async () => {
        // Start a new state
        const db = new SMTMemDB();
        const rollupDB = await RollupDB(db);
        const bb = await rollupDB.buildBatch(NTX, NLEVELS);

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
            loadAmount: 1000,
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

        const bb2 = await rollupDB.buildBatch(NTX, NLEVELS);

        const tx = {
            toAx: account2.ax,
            toAy: account2.ay,
            toEthAddr: account2.ethAddress,
            coin: 0,
            amount: 50,
            nonce: 0,
            userFee: 10
        };
        account1.signTx(tx);

        const tx2 = {
            toAx: 0,
            toAy: 0,
            toEthAddr: 0,
            coin: 0,
            amount: 10,
            nonce: 1,
            userFee: 10
        };
        account1.signTx(tx2);


        const tx3 = {
            toAx: 0,
            toAy: 0,
            toEthAddr: 0,
            coin: 0,
            amount: 200,
            nonce: 2,
            userFee: 10
        };
        account1.signTx(tx3);

        const tx4 = {
            toAx: 0,
            toAy: 0,
            toEthAddr: 0,
            coin: 0,
            amount: 100,
            nonce: 3,
            userFee: 10
        };
        account1.signTx(tx4);
        
        bb2.addTx(tx);
        bb2.addTx(tx2);
        bb2.addTx(tx3);
        bb2.addTx(tx4);
        bb2.addCoin(0, 5);
       
        await bb2.build();
        await rollupDB.consolidate(bb2);
        const input2 = bb2.getInput();

        const w2 = circuit.calculateWitness(input2, {logTrigger:false, logOutput: false, logSet: false});
        checkBatch(circuit, w2, bb2);

        const state1 = await rollupDB.getStateByIdx(1);
        assert.equal(state1.amount.toString(), 620);

        const state2 = await rollupDB.getStateByIdx(2);
        assert.equal(state2.amount.toString(), 1050);
    });
   
    it("Should create 1 deposit on-chain and then 1 on-chain force-withdraw and 2 off-chain exits", async () => {
        // Start a new state
        const db = new SMTMemDB();
        const rollupDB = await RollupDB(db);
        const bb = await rollupDB.buildBatch(NTX, NLEVELS);

        const account1 = new RollupAccount(1);

        bb.addTx({
            loadAmount: 100,
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
        await rollupDB.consolidate(bb);

        const bb2 = await rollupDB.buildBatch(NTX, NLEVELS);

        const tx1 = {
            toAx: 0,
            toAy: 0,
            toEthAddr: 0,
            coin: 0,
            amount: 30,
            nonce: 0,
            userFee: 5
        };
        account1.signTx(tx1);

        const tx2 = {
            toAx: 0,
            toAy: 0,
            toEthAddr: 0,
            coin: 0,
            amount: 30,
            nonce: 1,
            userFee: 5
        };
        account1.signTx(tx2);

        const tx3 = {
            coin: 0,
            amount: 30,
            fromAx: account1.ax,
            fromAy: account1.ay,
            fromEthAddr: account1.ethAddress,
            toAx: 0,
            toAy: 0,
            toEthAddr: 0,
            onChain: true
        };

        bb2.addTx(tx1);
        bb2.addTx(tx2);
        bb2.addTx(tx3);
        bb2.addCoin(0, 5);
       
        await bb2.build();
        const input2 = bb2.getInput();
        await rollupDB.consolidate(bb2);

        const w2 = circuit.calculateWitness(input2, {logTrigger:false, logOutput: false, logSet: false});
        checkBatch(circuit, w2, bb2);
        
        const state1 = await rollupDB.getStateByIdx(1);
        assert.equal(state1.amount.toString(), 0);
    });

    it("Should check underflow on-chain", async () => { 
        // Start a new state
        const db = new SMTMemDB();
        const rollupDB = await RollupDB(db);
        const bb = await rollupDB.buildBatch(NTX, NLEVELS);
  
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
  
        const bb2 = await rollupDB.buildBatch(NTX, NLEVELS);
  
        const tx = {
            coin: 0,
            amount: 5000,
            nonce: 0,
            fromAx: account1.ax,
            fromAy: account1.ay,
            fromEthAddr: account1.ethAddress,
            toAx: account2.ax,
            toAy: account2.ay,
            toEthAddr: account2.ethAddress,
            onChain: true
        };
        bb2.addTx(tx);

        await bb2.build();
        const input2 = bb2.getInput();
        await rollupDB.consolidate(bb2);
            
        const w2 = circuit.calculateWitness(input2, {logTrigger:false, logOutput: false, logSet: false});
        checkBatch(circuit, w2, bb2);
        
        const state1 = await rollupDB.getStateByIdx(1);
        assert.equal(state1.amount.toString(), 1000);
        const state2 = await rollupDB.getStateByIdx(2);
        assert.equal(state2.amount.toString(), 2000);
    });
    
    it("Should create 2 deposits on-chain and then 3 on-chain transfers to 0", async () => {
        // Start a new state
        const db = new SMTMemDB();
        const rollupDB = await RollupDB(db);
        const bb = await rollupDB.buildBatch(NTX, NLEVELS);
                
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
                
        const bb2 = await rollupDB.buildBatch(NTX, NLEVELS);
                
        const tx = {
            coin: 0,
            amount: 50,
            nonce: 0,
            fromAx: account1.ax,
            fromAy: account1.ay,
            fromEthAddr: account1.ethAddress,
            toAx: 0,
            toAy: 0,
            toEthAddr: 0,
            onChain: true
        };

        const tx2 = {
            coin: 0,
            amount: 100,
            nonce: 0,
            fromAx: account1.ax,
            fromAy: account1.ay,
            ethAddr: account1.ethAddress,
            toAx: 0,
            toAy: 0,
            toEthAddr: 0,
            onChain: true
        };

        const tx3 = {
            coin: 0,
            amount: 100,
            nonce: 0,
            fromAx: account2.ax,
            fromAy: account2.ay,
            fromEthAddr: account2.ethAddress,
            toAx: account1.ax,
            toAy: account1.ay,
            toEthAddr: account1.ethAddress,
            onChain: true
        };

        bb2.addTx(tx);
        bb2.addTx(tx2);
        bb2.addTx(tx3);

        await bb2.build();
        const input2 = bb2.getInput();
        await rollupDB.consolidate(bb2);

        const w2 = circuit.calculateWitness(input2, {logTrigger:false, logOutput: false, logSet: false});
        checkBatch(circuit, w2, bb2);
        
        const state1 = await rollupDB.getStateByIdx(1);
        assert.equal(state1.amount.toString(), 950);
        const state2 = await rollupDB.getStateByIdx(2);
        assert.equal(state2.amount.toString(), 1900);
    });

    it("Should check error transfer off-chain with invalid fee", async () => { 
        // Start a new state
        const db = new SMTMemDB();
        const rollupDB = await RollupDB(db);
        const bb = await rollupDB.buildBatch(NTX, NLEVELS);

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

        const bb2 = await rollupDB.buildBatch(NTX, NLEVELS);

        const tx = {
            toAx: account2.ax,
            toAy: account2.ay,
            toEthAddr: account2.ethAddress,
            coin: 0,
            amount: 50,
            nonce: 0,
            userFee: 0
        };

        account1.signTx(tx);
        bb2.addTx(tx);
        bb2.addCoin(0, 5);

        await bb2.build();
        const input2 = bb2.getInput();

        try {
            circuit.calculateWitness(input2, {logTrigger:false, logOutput: false, logSet: false});
            assert(false);
        } catch (error) {
            assert.include(error.message, "Constraint doesn't match main.Tx[4].balancesUpdater");
            assert.include(error.message, "1 != 0");
        }
    });

    it("Should check error transfer off-chain with invalid nonce", async () => {
        // Start a new state
        const db = new SMTMemDB();
        const rollupDB = await RollupDB(db);
        const bb = await rollupDB.buildBatch(NTX, NLEVELS);

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

        const bb2 = await rollupDB.buildBatch(NTX, NLEVELS);

        const tx = {
            toAx: account2.ax,
            toAy: account2.ay,
            toEthAddr: account2.ethAddress,
            coin: 0,
            amount: 50,
            nonce: 0,
            userFee: 10
        };
        const tx2 = {
            toAx: account2.ax,
            toAy: account2.ay,
            toEthAddr: account2.ethAddress,
            coin: 0,
            amount: 50,
            nonce: 0,
            userFee: 10
        };

        account1.signTx(tx);
        account1.signTx(tx2);
        bb2.addTx(tx);
        bb2.addTx(tx2);
        bb2.addCoin(0, 5);

        await bb2.build();
        await rollupDB.consolidate(bb2);
        const input2 = bb2.getInput();

        try {
            circuit.calculateWitness(input2, {logTrigger:false, logOutput: false, logSet: false});
        } catch (error) {
            assert.include(error.message, "Constraint doesn't match main.Tx[4].nonceChecker");
            assert.include(error.message, "1 != 0");
        }
    });

    it("Should check error transfer off-chain with invalid signature", async () => {
        // Start a new state
        const db = new SMTMemDB();
        const rollupDB = await RollupDB(db);
        const bb = await rollupDB.buildBatch(NTX, NLEVELS);
        
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
        
        const bb2 = await rollupDB.buildBatch(NTX, NLEVELS);
        
        const tx = {
            toAx: account2.ax,
            toAy: account2.ay,
            toEthAddr: account2.ethAddress,
            coin: 0,
            amount: 50,
            nonce: 0,
            userFee: 10
        };

        account2.signTx(tx);
        bb2.addTx(tx);
        bb2.addCoin(0, 5);

        await bb2.build();
        const input2 = bb2.getInput();

        // manipulate input
        input2.ax1[4] = bigInt("0x" + account1.ax);
        input2.ay1[4] = bigInt("0x" + account1.ay);
        input2.ethAddr1[4] = bigInt(account1.ethAddress);

        try {
            circuit.calculateWitness(input2, {logTrigger:false, logOutput: false, logSet: false});
            assert(false);
        } catch (error) {
            assert.include(error.message, "main.Tx[4].sigVerifier.eqCheckX");
        }
    });

    it("Should check error deposit on-chain with invalid idx", async () => {
        // Start a new state
        const db = new SMTMemDB();
        const rollupDB = await RollupDB(db);
        const bb = await rollupDB.buildBatch(NTX, NLEVELS);
        
        const account1 = new RollupAccount(1);
        
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
        
        await bb.build();
        const input = bb.getInput();

        // manipulate input
        input.fromIdx[0] = 2;

        try {
            circuit.calculateWitness(input, {logTrigger:false, logOutput: false, logSet: false});
            assert(false);
        } catch (error) {
            assert.include(error.message, "main.decodeTx[0].idxChecker");
        }
    });

    it("Should check error deposit on-chain with invalid loadAmount", async () => {
        // Start a new state
        const db = new SMTMemDB();
        const rollupDB = await RollupDB(db);
        const bb = await rollupDB.buildBatch(NTX, NLEVELS);
        
        const account1 = new RollupAccount(1);
        
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
        
        await bb.build();
        const input = bb.getInput();

        // manipulate input
        input.loadAmount[0] = bigInt(2000);

        try {
            circuit.calculateWitness(input, {logTrigger:false, logOutput: false, logSet: false});
            assert(false);
        } catch (error) {
            assert.include(error.message, "485755324514158938364995984950499853227357642664449302282745098803878424054 != 16589075666024781718324529505012770645802399877896988987633643042747968275396");
        }
    });

    it("Should check error deposit on-chain with invalid txData", async () => {
        // Start a new state
        const db = new SMTMemDB();
        const rollupDB = await RollupDB(db);
        const bb = await rollupDB.buildBatch(NTX, NLEVELS);
        
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
        
        await bb.build();
        const input = bb.getInput();

        // manipulate input
        const tx = {
            loadAmount: 1000,
            coin: 0,
            fromAx: account2.ax,
            fromAy: account2.ay,
            fromEthAddr: account2.ethAddress,
            toAx: 0,
            toAy: 0,
            toEthAddr: 0,
            onChain: false
        };
        let newAccount = 1;
        const txData = utils.buildTxData(Object.assign({newAccount: newAccount}, tx));
        input.txData[0] = txData;

        try {
            circuit.calculateWitness(input, {logTrigger:false, logOutput: false, logSet: false});
            assert(false);
        } catch (error) {
            assert.include(error.message, "main.Tx[0].states");
        }
    });

    it("Should check error deposit on-chain with invalid fromEthAddr", async () => {
        // Start a new state
        const db = new SMTMemDB();
        const rollupDB = await RollupDB(db);
        const bb = await rollupDB.buildBatch(NTX, NLEVELS);
        
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
        
        await bb.build();
        const input = bb.getInput();

        // manipulate input
        input.fromEthAddr[0] = bigInt(account2.ethAddress);
        
        try {
            circuit.calculateWitness(input, {logTrigger:false, logOutput: false, logSet: false});
            assert(false);
        } catch (error) {
            assert.include(error.message, "main.Tx[0].fromEthAddrChecker");
        }
    });

    it("Should check error deposit on-chain with invalid fromAx & fromAy", async () => {
        // Start a new state
        const db = new SMTMemDB();
        const rollupDB = await RollupDB(db);
        const bb = await rollupDB.buildBatch(NTX, NLEVELS);
        
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
        
        await bb.build();
        const input = bb.getInput();

        // manipulate input
        input.fromAx[0] = bigInt("0x" + account2.ax);
        input.fromAy[0] = bigInt("0x" + account2.ay);
        
        try {
            circuit.calculateWitness(input, {logTrigger:false, logOutput: false, logSet: false});
            assert(false);
        } catch (error) {
            assert.include(error.message, "doesn't match main");
        }
    });

    it("Should create 1 deposit on-chain and should check error deposit on top on-chain with invalid loadamount", async () => {
        // Start a new state
        const db = new SMTMemDB();
        const rollupDB = await RollupDB(db);
        const bb = await rollupDB.buildBatch(NTX, NLEVELS);

        const account1 = new RollupAccount(1);

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
            fromAx: account1.ax,
            fromAy: account1.ay,
            fromEthAddr: account1.ethAddress,
            toAx: 0,
            toAy: 0,
            toEthAddr: 0,
            onChain: true
        });

        await bb.build();
        await rollupDB.consolidate(bb);
        const input = bb.getInput();

        // manipulate input
        input.loadAmount[1] = bigInt(3000);

        try {
            circuit.calculateWitness(input, {logTrigger:false, logOutput: false, logSet: false});
            assert(false);
        } catch (error) {
            assert.include(error.message, "doesn't match main");
        }
    });

    it("Should create 1 deposit on-chain and should check error deposit on top on-chain with invalid amount", async () => {
        // Start a new state
        const db = new SMTMemDB();
        const rollupDB = await RollupDB(db);
        const bb = await rollupDB.buildBatch(NTX, NLEVELS);

        const account1 = new RollupAccount(1);

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
            fromAx: account1.ax,
            fromAy: account1.ay,
            fromEthAddr: account1.ethAddress,
            toAx: 0,
            toAy: 0,
            toEthAddr: 0,
            onChain: true
        });

        await bb.build();
        await rollupDB.consolidate(bb);
        const input = bb.getInput();

        // manipulate input
        input.amount1[1] = bigInt(3000);

        try {
            circuit.calculateWitness(input, {logTrigger:false, logOutput: false, logSet: false});
            assert(false);
        } catch (error) {
            assert.include(error.message, "match main.Tx[1].processor1.checkOldInput");
        }
    });

    it("Should create 1 deposit on-chain and should check error deposit on top on-chain with invalid fromAx & fromAy", async () => {
        // Start a new state
        const db = new SMTMemDB();
        const rollupDB = await RollupDB(db);
        const bb = await rollupDB.buildBatch(NTX, NLEVELS);

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
            fromAx: account1.ax,
            fromAy: account1.ay,
            fromEthAddr: account1.ethAddress,
            toAx: 0,
            toAy: 0,
            toEthAddr: 0,
            onChain: true
        });

        await bb.build();
        await rollupDB.consolidate(bb);
        const input = bb.getInput();

        // manipulate input
        input.fromAx[1] = bigInt("0x" + account2.ax);
        input.fromAy[1] = bigInt("0x" + account2.ay);

        try {
            circuit.calculateWitness(input, {logTrigger:false, logOutput: false, logSet: false});
            assert(false);
        } catch (error) {
            assert.include(error.message, "doesn't match main");
        }
    });

    it("Should create 1 deposit on-chain and should check error deposit on top on-chain with invalid fromEthAddr", async () => {
        // Start a new state
        const db = new SMTMemDB();
        const rollupDB = await RollupDB(db);
        const bb = await rollupDB.buildBatch(NTX, NLEVELS);

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
            fromAx: account1.ax,
            fromAy: account1.ay,
            fromEthAddr: account1.ethAddress,
            toAx: 0,
            toAy: 0,
            toEthAddr: 0,
            onChain: true
        });

        await bb.build();
        await rollupDB.consolidate(bb);
        const input = bb.getInput();

        // manipulate input
        input.fromEthAddr[1] = bigInt(account2.ethAddress);

        try {
            circuit.calculateWitness(input, {logTrigger:false, logOutput: false, logSet: false});
            assert(false);
        } catch (error) {
            assert.include(error.message, "doesn't match main");
        }
    });

    it("Should create 2 deposit on-chain and then should check error 1 transfer on-chain with invalid amount", async () => {
        // Start a new state
        const db = new SMTMemDB();
        const rollupDB = await RollupDB(db);
        const bb = await rollupDB.buildBatch(NTX, NLEVELS);

        const account1 = new RollupAccount(1);
        const account2 = new RollupAccount(2);

        bb.addTx({
            loadAmount: 3000,
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

        const bb2 = await rollupDB.buildBatch(NTX, NLEVELS);

        bb2.addTx({
            fromAx: account1.ax,
            fromAy: account1.ay,
            fromEthAddr: account1.ethAddress,
            toAx: account2.ax,
            toAy: account2.ay,
            toEthAddr: account2.ethAddress,
            coin: 0,
            amount: 500,
            nonce: 0,
            onChain: true
        });

        await bb2.build();
        await rollupDB.consolidate(bb2);
        const input = bb2.getInput();

        // manipulate input
        const tx = {
            fromAx: account1.ax,
            fromAy: account1.ay,
            fromEthAddr: account1.ethAddress,
            toAx: account2.ax,
            toAy: account2.ay,
            toEthAddr: account2.ethAddress,
            coin: 0,
            amount: 1000,
            nonce: 0,
            onChain: true
        };
        let newAccount = 0;
        const txData = utils.buildTxData(Object.assign({newAccount: newAccount}, tx));
        input.txData[0] = txData;

        try {
            circuit.calculateWitness(input, {logTrigger:false, logOutput: false, logSet: false});
            assert(false);
        } catch (error) {
            assert.include(error.message, "doesn't match main");
        }
    });

    it("Should create 2 deposit on-chain and then should check error 1 transfer on-chain with invalid nonce", async () => {
        // Start a new state
        const db = new SMTMemDB();
        const rollupDB = await RollupDB(db);
        const bb = await rollupDB.buildBatch(NTX, NLEVELS);

        const account1 = new RollupAccount(1);
        const account2 = new RollupAccount(2);

        bb.addTx({
            loadAmount: 3000,
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

        const bb2 = await rollupDB.buildBatch(NTX, NLEVELS);

        bb2.addTx({
            fromAx: account1.ax,
            fromAy: account1.ay,
            fromEthAddr: account1.ethAddress,
            toAx: account2.ax,
            toAy: account2.ay,
            toEthAddr: account2.ethAddress,
            coin: 0,
            amount: 500,
            nonce: 0,
            onChain: true
        });

        await bb2.build();
        await rollupDB.consolidate(bb2);
        const input = bb2.getInput();

        // manipulate input
        const tx = {
            fromAx: account1.ax,
            fromAy: account1.ay,
            fromEthAddr: account1.ethAddress,
            toAx: account2.ax,
            toAy: account2.ay,
            toEthAddr: account2.ethAddress,
            coin: 0,
            amount: 500,
            nonce: 1,
            onChain: true
        };
        let newAccount = 0;
        const txData = utils.buildTxData(Object.assign({newAccount: newAccount}, tx));
        input.txData[0] = txData;

        try {
            circuit.calculateWitness(input, {logTrigger:false, logOutput: false, logSet: false});
            assert(false);
        } catch (error) {
            assert.include(error.message, "doesn't match main");
        }
    });

    it("Should create 2 deposit on-chain and then should check error 1 transfer on-chain with invalid to", async () => {
        // Start a new state
        const db = new SMTMemDB();
        const rollupDB = await RollupDB(db);
        const bb = await rollupDB.buildBatch(NTX, NLEVELS);

        const account1 = new RollupAccount(1);
        const account2 = new RollupAccount(2);

        bb.addTx({
            loadAmount: 3000,
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

        const bb2 = await rollupDB.buildBatch(NTX, NLEVELS);

        bb2.addTx({
            fromAx: account1.ax,
            fromAy: account1.ay,
            fromEthAddr: account1.ethAddress,
            toAx: account2.ax,
            toAy: account2.ay,
            toEthAddr: account2.ethAddress,
            coin: 0,
            amount: 500,
            nonce: 0,
            onChain: true
        });

        await bb2.build();
        await rollupDB.consolidate(bb2);
        const input = bb2.getInput();

        // manipulate input
        input.toAx[0] = bigInt("0x" + account1.ax);
        input.toAy[0] = bigInt("0x" + account1.ay);
        input.toEthAddr[0] = bigInt(account1.ethAddress);

        try {
            circuit.calculateWitness(input, {logTrigger:false, logOutput: false, logSet: false});
            assert(false);
        } catch (error) {
            assert.include(error.message, "doesn't match main");
        }
    });

    it("Should create 2 deposit on-chain and then should check error 1 transfer on-chain with invalid state", async () => {
        // Start a new state
        const db = new SMTMemDB();
        const rollupDB = await RollupDB(db);
        const bb = await rollupDB.buildBatch(NTX, NLEVELS);

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

        const bb2 = await rollupDB.buildBatch(NTX, NLEVELS);

        bb2.addTx({
            fromAx: account1.ax,
            fromAy: account1.ay,
            fromEthAddr: account1.ethAddress,
            toAx: account2.ax,
            toAy: account2.ay,
            toEthAddr: account2.ethAddress,
            coin: 0,
            amount: 500,
            nonce: 0,
            onChain: true
        });

        await bb2.build();
        await rollupDB.consolidate(bb2);
        const input = bb2.getInput();

        // manipulate input
        input.amount1[0] = bigInt(3000);

        try {
            circuit.calculateWitness(input, {logTrigger:false, logOutput: false, logSet: false});
            assert(false);
        } catch (error) {
            assert.include(error.message, "main.Tx[0].processor1.checkOldInput:");
        }
    });

    it("Should create 1 deposit on-chain and then should check error 1 force-withdraw on-chain with invalid txData", async () => {
        // Start a new state
        const db = new SMTMemDB();
        const rollupDB = await RollupDB(db);
        const bb = await rollupDB.buildBatch(NTX, NLEVELS);

        const account1 = new RollupAccount(1);

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

        await bb.build();
        await rollupDB.consolidate(bb);

        const bb2 = await rollupDB.buildBatch(NTX, NLEVELS);

        bb2.addTx({
            fromAx: account1.ax,
            fromAy: account1.ay,
            fromEthAddr: account1.ethAddress,
            toAx: 0,
            toAy: 0,
            toEthAddr: 0,
            coin: 0,
            amount: 500,
            nonce: 0,
            onChain: true
        });

        await bb2.build();
        await rollupDB.consolidate(bb2);
        const input = bb2.getInput();

        // manipulate input
        const tx = {
            fromAx: account1.ax,
            fromAy: account1.ay,
            fromEthAddr: account1.ethAddress,
            toAx: 0,
            toAy: 0,
            toEthAddr: 0,
            coin: 0,
            amount: 1000,
            nonce: 0,
            onChain: true
        };
        let newAccount = 0;
        const txData = utils.buildTxData(Object.assign({newAccount: newAccount}, tx));
        input.txData[0] = txData;

        try {
            circuit.calculateWitness(input, {logTrigger:false, logOutput: false, logSet: false});
            assert(false);
        } catch (error) {
            assert.include(error.message, "doesn't match main");
        }
    });

    it("Should create 1 deposit on-chain and then should check error 1 force-withdraw on-chain with invalid from", async () => {
        // Start a new state
        const db = new SMTMemDB();
        const rollupDB = await RollupDB(db);
        const bb = await rollupDB.buildBatch(NTX, NLEVELS);

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

        await bb.build();
        await rollupDB.consolidate(bb);

        const bb2 = await rollupDB.buildBatch(NTX, NLEVELS);

        bb2.addTx({
            fromAx: account1.ax,
            fromAy: account1.ay,
            fromEthAddr: account1.ethAddress,
            toAx: 0,
            toAy: 0,
            toEthAddr: 0,
            coin: 0,
            amount: 500,
            nonce: 0,
            onChain: true
        });

        await bb2.build();
        await rollupDB.consolidate(bb2);
        const input = bb2.getInput();

        // manipulate input
        input.fromAx[0] = bigInt("0x" + account2.ax);
        input.fromAy[0] = bigInt("0x" + account2.ay);
        input.fromEthAddr[0] = bigInt(account2.ethAddress);

        try {
            circuit.calculateWitness(input, {logTrigger:false, logOutput: false, logSet: false});
            assert(false);
        } catch (error) {
            assert.include(error.message, "main.Tx[0].fromEthAddrChecker");
        }

    });

    it("Should create 2 deposits on-chain and then 1 off-chain transfer with invalid order", async () => {
        // Start a new state
        const db = new SMTMemDB();
        const rollupDB = await RollupDB(db);
        const bb = await rollupDB.buildBatch(NTX, NLEVELS);

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

        const bb2 = await rollupDB.buildBatch(NTX, NLEVELS);

        bb2.addTx({
            loadAmount: 3000,
            coin: 0,
            fromAx: account3.ax,
            fromAy: account3.ay,
            fromEthAddr: account3.ethAddress,
            toAx: 0,
            toAy: 0,
            toEthAddr: 0,
            onChain: true
        });

        const tx = {
            toAx: account2.ax,
            toAy: account2.ay,
            toEthAddr: account2.ethAddress,
            coin: 0,
            amount: 500,
            nonce: 0,
            userFee: 100
        };
        account1.signTx(tx);
        bb2.addTx(tx);

        bb2.addCoin(0, 100);

        await bb2.build();
        await rollupDB.consolidate(bb2);
        const input = bb2.getInput();
    
        // manipulate input
        const auxInput = {};

        auxInput.txData = Object.assign([], input.txData);
        input.txData[0] = auxInput.txData[4];
        input.txData[4] = auxInput.txData[0];

        auxInput.fromIdx = Object.assign([], input.fromIdx);
        input.fromIdx[0] = auxInput.fromIdx[4];
        input.fromIdx[4] = auxInput.fromIdx[0];

        auxInput.toIdx = Object.assign([], input.toIdx);
        input.toIdx[0] = auxInput.toIdx[4];
        input.toIdx[4] = auxInput.toIdx[0];

        auxInput.toAx = Object.assign([], input.toAx);
        input.toAx[0] = auxInput.toAx[4];
        input.toAx[4] = auxInput.toAx[0];

        auxInput.toAy = Object.assign([], input.toAy);
        input.toAy[0] = auxInput.toAy[4];
        input.toAy[4] = auxInput.toAy[0];

        auxInput.toEthAddr = Object.assign([], input.toEthAddr);
        input.toEthAddr[0] = auxInput.toEthAddr[4];
        input.toEthAddr[4] = auxInput.toEthAddr[0];

        auxInput.s = Object.assign([], input.s);
        input.s[0] = auxInput.s[4];
        input.s[4] = auxInput.s[0];

        auxInput.r8x = Object.assign([], input.r8x);
        input.r8x[0] = auxInput.r8x[4];
        input.r8x[4] = auxInput.r8x[0];

        auxInput.r8y = Object.assign([], input.r8y);
        input.r8y[0] = auxInput.r8y[4];
        input.r8y[4] = auxInput.r8y[0];

        auxInput.loadAmount = Object.assign([], input.loadAmount);
        input.loadAmount[0] = auxInput.loadAmount[4];
        input.loadAmount[4] = auxInput.loadAmount[0];

        auxInput.fromEthAddr = Object.assign([], input.fromEthAddr);
        input.fromEthAddr[0] = auxInput.fromEthAddr[4];
        input.fromEthAddr[4] = auxInput.fromEthAddr[0];

        auxInput.fromAx = Object.assign([], input.fromAx);
        input.fromAx[0] = auxInput.fromAx[4];
        input.fromAx[4] = auxInput.fromAx[0];

        auxInput.fromAy = Object.assign([], input.fromAy);
        input.fromAy[0] = auxInput.fromAy[4];
        input.fromAy[4] = auxInput.fromAy[0];

        auxInput.ax1 = Object.assign([], input.ax1);
        input.ax1[0] = auxInput.ax1[4];
        input.ax1[4] = auxInput.ax1[0];

        auxInput.ay1 = Object.assign([], input.ay1);
        input.ay1[0] = auxInput.ay1[4];
        input.ay1[4] = auxInput.ay1[0];

        auxInput.amount1 = Object.assign([], input.amount1);
        input.amount1[0] = auxInput.amount1[4];
        input.amount1[4] = auxInput.amount1[0];

        auxInput.nonce1 = Object.assign([], input.nonce1);
        input.nonce1[0] = auxInput.nonce1[4];
        input.nonce1[4] = auxInput.nonce1[0];

        auxInput.ethAddr1 = Object.assign([], input.ethAddr1);
        input.ethAddr1[0] = auxInput.ethAddr1[4];
        input.ethAddr1[4] = auxInput.ethAddr1[0];

        auxInput.siblings1 = Object.assign([], input.siblings1);
        input.siblings1[0] = auxInput.siblings1[4];
        input.siblings1[4] = auxInput.siblings1[0];

        auxInput.oldKey1 = Object.assign([], input.oldKey1);
        input.oldKey1[0] = auxInput.oldKey1[4];
        input.oldKey1[4] = auxInput.oldKey1[0];

        auxInput.oldValue1 = Object.assign([], input.oldValue1);
        input.oldValue1[0] = auxInput.oldValue1[4];
        input.oldValue1[4] = auxInput.oldValue1[0];

        auxInput.ax2 = Object.assign([], input.ax2);
        input.ax2[0] = auxInput.ax2[4];
        input.ax2[4] = auxInput.ax2[0];

        auxInput.ay2 = Object.assign([], input.ay2);
        input.ay2[0] = auxInput.ay2[4];
        input.ay2[4] = auxInput.ay2[0];

        auxInput.amount2 = Object.assign([], input.amount2);
        input.amount2[0] = auxInput.amount2[4];
        input.amount2[4] = auxInput.amount2[0];

        auxInput.nonce2 = Object.assign([], input.nonce2);
        input.nonce2[0] = auxInput.nonce2[4];
        input.nonce2[4] = auxInput.nonce2[0];

        auxInput.ethAddr2 = Object.assign([], input.ethAddr2);
        input.ethAddr2[0] = auxInput.ethAddr2[4];
        input.ethAddr2[4] = auxInput.ethAddr2[0];

        auxInput.siblings2 = Object.assign([], input.siblings2);
        input.siblings2[0] = auxInput.siblings2[4];
        input.siblings2[4] = auxInput.siblings2[0];

        auxInput.oldKey2 = Object.assign([], input.oldKey2);
        input.oldKey2[0] = auxInput.oldKey2[4];
        input.oldKey2[4] = auxInput.oldKey2[0];

        auxInput.oldValue2 = Object.assign([], input.oldValue2);
        input.oldValue2[0] = auxInput.oldValue2[4];
        input.oldValue2[4] = auxInput.oldValue2[0];

        try {
            circuit.calculateWitness(input, {logTrigger:false, logOutput: false, logSet: false});
            assert(false);
        } catch (error) {
            assert.include(error.message, "main.decodeTx[4]");
        }
    });

    it("Should create 1 deposit on-chain and then 2 force-withdraw on-chain, one of them invalid", async () => {
        // Start a new state
        const db = new SMTMemDB();
        const rollupDB = await RollupDB(db);
        const bb = await rollupDB.buildBatch(NTX, NLEVELS);

        const account1 = new RollupAccount(1);

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

        await bb.build();
        await rollupDB.consolidate(bb);

        const bb2 = await rollupDB.buildBatch(NTX, NLEVELS);

        bb2.addTx({
            fromAx: account1.ax,
            fromAy: account1.ay,
            fromEthAddr: account1.ethAddress,
            toAx: 0,
            toAy: 0,
            toEthAddr: 0,
            coin: 0,
            amount: 800,
            nonce: 0,
            onChain: true
        });

        bb2.addTx({
            fromAx: account1.ax,
            fromAy: account1.ay,
            fromEthAddr: account1.ethAddress,
            toAx: 0,
            toAy: 0,
            toEthAddr: 0,
            coin: 0,
            amount: 400,
            nonce: 0,
            onChain: true
        });

        await bb2.build();
        await rollupDB.consolidate(bb2);
        const input = bb2.getInput();

        const w2 = circuit.calculateWitness(input, {logTrigger:false, logOutput: false, logSet: false});
        checkBatch(circuit, w2, bb2);
        
        const state = await rollupDB.getStateByIdx(1);
        assert.equal(state.amount.toString(), 200);
    });

});
