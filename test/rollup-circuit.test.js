const chai = require("chai");
const path = require("path");
const snarkjs = require("snarkjs");
const compiler = require("circom");
const bigInt = require("snarkjs").bigInt;
const SMTMemDB = require("circomlib").SMTMemDB;
const RollupAccount = require("../js/rollupaccount");
const RollupDB = require("../js/rollupdb");
const checkBatch = require("./helpers/checkbatch");
const utils = require("./helpers/utils-circuit");
const assert = chai.assert;

const NTX = 4;
const NLEVELS = 8;

const fs = require("fs");

describe("Rollup Basic circuit TXs", function () {
    let circuit;

    this.timeout(100000);

    // before( async() => {
    //     const cirDef = await compiler(path.join(__dirname, "circuits", "rollup_test.circom"), {reduceConstraints:false});
    //     fs.writeFileSync(path.join(`${__dirname}`, "circuit-example.json"), JSON.stringify(cirDef));
    //     circuit = new snarkjs.Circuit(cirDef);
    //     console.log("NConstrains Rollup: " + circuit.nConstraints);
    // });

    before( async() => {
        const cirDef = JSON.parse(fs.readFileSync(path.join(`${__dirname}`, "circuit-example.json")));
        circuit = new snarkjs.Circuit(cirDef);
        console.log("NConstrains Rollup: " + circuit.nConstraints);
    });

    // it("Should create empty TXs", async () => {
    //     // Start a new state
    //     const db = new SMTMemDB();
    //     const rollupDB = await RollupDB(db);
    //     const bb = await rollupDB.buildBatch(NTX, NLEVELS);

    //     await bb.build();
    //     const input = bb.getInput();

    //     const w = circuit.calculateWitness(input, {logTrigger: false, logOutput: false, logSet: false});

    //     checkBatch(circuit, w, bb);
    // });

    // it("Should create 1 deposit onchain TXs", async () => {

    //     // Start a new state
    //     const db = new SMTMemDB();
    //     const rollupDB = await RollupDB(db);
    //     const bb = await rollupDB.buildBatch(NTX, NLEVELS);

    //     const account1 = new RollupAccount(1);

    //     bb.addTx({
    //         loadAmount: 1000,
    //         coin: 0,
    //         fromAx: account1.ax,
    //         fromAy: account1.ay,
    //         fromEthAddr: account1.ethAddress,
    //         onChain: true
    //     });

    //     await bb.build();
    //     const input = bb.getInput();

    //     const w = circuit.calculateWitness(input, {logTrigger:false, logOutput: false, logSet: false});

    //     checkBatch(circuit, w, bb);
    // });

    // it("Should create 1 deposit on-chain and 1 deposit on top on-chain", async () => {

    //     // Start a new state
    //     const db = new SMTMemDB();
    //     const rollupDB = await RollupDB(db);
    //     const bb = await rollupDB.buildBatch(NTX, NLEVELS);

    //     const account1 = new RollupAccount(1);

    //     bb.addTx({
    //         loadAmount: 1000,
    //         coin: 0,
    //         fromAx: account1.ax,
    //         fromAy: account1.ay,
    //         fromEthAddr: account1.ethAddress,
    //         onChain: true
    //     });

    //     bb.addTx({
    //         loadAmount: 2000,
    //         coin: 0,
    //         fromAx: account1.ax,
    //         fromAy: account1.ay,
    //         fromEthAddr: account1.ethAddress,
    //         onChain: true
    //     });

    //     await bb.build();
    //     const input = bb.getInput();

    //     const w = circuit.calculateWitness(input, {logTrigger:false, logOutput: false, logSet: false});

    //     checkBatch(circuit, w, bb);
    // });

    // it("Should create 2 deposit on-chain and then 1 transfer on-chain", async () => {

    //     // Start a new state
    //     const db = new SMTMemDB();
    //     const rollupDB = await RollupDB(db);
    //     const bb = await rollupDB.buildBatch(NTX, NLEVELS);

    //     const account1 = new RollupAccount(1);
    //     const account2 = new RollupAccount(2);

    //     bb.addTx({
    //         loadAmount: 1000,
    //         coin: 0,
    //         fromAx: account1.ax,
    //         fromAy: account1.ay,
    //         fromEthAddr: account1.ethAddress,
    //         onChain: true
    //     });

    //     bb.addTx({
    //         loadAmount: 2000,
    //         coin: 0,
    //         fromAx: account2.ax,
    //         fromAy: account2.ay,
    //         fromEthAddr: account2.ethAddress,
    //         onChain: true
    //     });

    //     await bb.build();
    //     await rollupDB.consolidate(bb);

    //     const bb2 = await rollupDB.buildBatch(NTX, NLEVELS);

    //     bb2.addTx({
    //         fromAx: account1.ax,
    //         fromAy: account1.ay,
    //         fromEthAddr: account1.ethAddress,
    //         toAx: account2.ax,
    //         toAy: account2.ay,
    //         toEthAddress: account2.ethAddress,
    //         coin: 0,
    //         amount: 500,
    //         nonce: 0,
    //         onChain: true
    //     });

    //     await bb2.build();
    //     const input = bb2.getInput();
    //     const w = circuit.calculateWitness(input, {logTrigger:false, logOutput: false, logSet: false});

    //     checkBatch(circuit, w, bb2);
    // });

    // it("Should create 1 deposit on-chain and then 1 deposit & transfer on-chain", async () => {

    //     // Start a new state
    //     const db = new SMTMemDB();
    //     const rollupDB = await RollupDB(db);
    //     const bb = await rollupDB.buildBatch(NTX, NLEVELS);

    //     const account1 = new RollupAccount(1);
    //     const account2 = new RollupAccount(2);

    //     bb.addTx({
    //         loadAmount: 1000,
    //         coin: 0,
    //         fromAx: account1.ax,
    //         fromAy: account1.ay,
    //         fromEthAddr: account1.ethAddress,
    //         onChain: true
    //     });

    //     await bb.build();
    //     await rollupDB.consolidate(bb);

    //     const bb2 = await rollupDB.buildBatch(NTX, NLEVELS);

    //     bb2.addTx({
    //         fromAx: account2.ax,
    //         fromAy: account2.ay,
    //         fromEthAddr: account2.ethAddress,
    //         toAx: account1.ax,
    //         toAy: account1.ay,
    //         toEthAddress: account1.ethAddress,
    //         coin: 0,
    //         loadAmount: 2000,
    //         amount: 500,
    //         nonce: 0,
    //         onChain: true
    //     });

    //     await bb2.build();
    //     const input = bb2.getInput();
    //     const w = circuit.calculateWitness(input, {logTrigger:false, logOutput: false, logSet: false});

    //     checkBatch(circuit, w, bb2);
    // });

    // it("Should create 1 deposit on-chain and then 1 force withdraw on-chain", async () => {

    //     // Start a new state
    //     const db = new SMTMemDB();
    //     const rollupDB = await RollupDB(db);
    //     const bb = await rollupDB.buildBatch(NTX, NLEVELS);

    //     const account1 = new RollupAccount(1);

    //     bb.addTx({
    //         loadAmount: 1000,
    //         coin: 0,
    //         fromAx: account1.ax,
    //         fromAy: account1.ay,
    //         fromEthAddr: account1.ethAddress,
    //         onChain: true
    //     });

    //     await bb.build();
    //     await rollupDB.consolidate(bb);

    //     const bb2 = await rollupDB.buildBatch(NTX, NLEVELS);

    //     bb2.addTx({
    //         fromAx: account1.ax,
    //         fromAy: account1.ay,
    //         fromEthAddr: account1.ethAddress,
    //         coin: 0,
    //         amount: 500,
    //         nonce: 0,
    //         onChain: true
    //     });

    //     await bb2.build();
    //     const input = bb2.getInput();
    //     const w = circuit.calculateWitness(input, {logTrigger:false, logOutput: false, logSet: false});

    //     checkBatch(circuit, w, bb2);
    // });

    // it("Should check deposit & transfer on-chain. Transfer is an exit", async () => {
    //     // Start a new state
    //     const db = new SMTMemDB();
    //     const rollupDB = await RollupDB(db);
    //     const bb = await rollupDB.buildBatch(NTX, NLEVELS);

    //     const account1 = new RollupAccount(1);

    //     bb.addTx({
    //         fromAx: account1.ax,
    //         fromAy: account1.ay,
    //         fromEthAddr: account1.ethAddress,
    //         coin: 0,
    //         loadAmount: 2000,
    //         amount: 500,
    //         nonce: 0,
    //         onChain: true
    //     });

    //     await bb.build();
    //     const input = bb.getInput();
    //     const w = circuit.calculateWitness(input, {logTrigger:false, logOutput: false, logSet: false});
        
    //     checkBatch(circuit, w, bb);
    // });

    it("Should create 2 deposits and then offchain transfer", async () => {

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
            onChain: true
        });

        bb.addTx({
            loadAmount: 2000,
            coin: 0,
            fromAx: account2.ax,
            fromAy: account2.ay,
            fromEthAddr: account2.ethAddress,
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
        const input2 = bb2.getInput();

        const w2 = circuit.calculateWitness(input2, {logTrigger:false, logOutput: false, logSet: false});
        checkBatch(circuit, w2, bb2);
    });

    // it("Should create 2 deposits and then offchain self transfer", async () => {

    //     // Start a new state
    //     const db = new SMTMemDB();
    //     const rollupDB = await RollupDB(db);
    //     const bb = await rollupDB.buildBatch(NTX, NLEVELS);

    //     const account1 = new RollupAccount(1);
    //     const account2 = new RollupAccount(2);

    //     bb.addTx({
    //         fromIdx: 1,
    //         loadAmount: 1000,
    //         coin: 0,
    //         ax: account1.ax,
    //         ay: account1.ay,
    //         ethAddress: account1.ethAddress,
    //         onChain: true
    //     });

    //     bb.addTx({
    //         fromIdx: 2,
    //         loadAmount: 2000,
    //         coin: 0,
    //         ax: account2.ax,
    //         ay: account2.ay,
    //         ethAddress: account2.ethAddress,
    //         onChain: true
    //     });

    //     await bb.build();
    //     const input = bb.getInput();

    //     const w = circuit.calculateWitness(input, {logTrigger:false, logOutput: false, logSet: false});
    //     checkBatch(circuit, w, bb);

    //     await rollupDB.consolidate(bb);

    //     const bb2 = await rollupDB.buildBatch(NTX, NLEVELS);

    //     const tx = {
    //         fromIdx: 2,
    //         toIdx: 2,
    //         coin: 0,
    //         amount: 50,
    //         nonce: 0,
    //         userFee: 10
    //     };
    //     account2.signTx(tx);
    //     bb2.addTx(tx);

    //     bb2.addCoin(0, 10);
       
    //     await bb2.build();
    //     const input2 = bb2.getInput();
        
    //     const w2 = circuit.calculateWitness(input2, {logTrigger:false, logOutput: false, logSet: false});
    //     checkBatch(circuit, w2, bb2);

    //     await rollupDB.consolidate(bb2);
    // });

    // it("Should create 2 deposits and then 3 offchain transfer", async () => {

    //     // Start a new state
    //     const db = new SMTMemDB();
    //     const rollupDB = await RollupDB(db);
    //     const bb = await rollupDB.buildBatch(NTX, NLEVELS);

    //     const account1 = new RollupAccount(1);
    //     const account2 = new RollupAccount(2);

    //     bb.addTx({
    //         fromIdx: 1,
    //         loadAmount: 1000,
    //         coin: 0,
    //         ax: account1.ax,
    //         ay: account1.ay,
    //         ethAddress: account1.ethAddress,
    //         onChain: true
    //     });

    //     bb.addTx({
    //         fromIdx: 2,
    //         loadAmount: 2000,
    //         coin: 0,
    //         ax: account2.ax,
    //         ay: account2.ay,
    //         ethAddress: account2.ethAddress,
    //         onChain: true
    //     });

    //     await bb.build();
    //     const input = bb.getInput();

    //     const w = circuit.calculateWitness(input, {logTrigger:false, logOutput: false, logSet: false});
    //     checkBatch(circuit, w, bb);

    //     await rollupDB.consolidate(bb);

    //     const bb2 = await rollupDB.buildBatch(NTX, NLEVELS);

    //     const tx = {
    //         fromIdx: 1,
    //         toIdx: 2,
    //         coin: 0,
    //         amount: 50,
    //         nonce: 0,
    //         userFee: 10
    //     };
    //     const tx2 = {
    //         fromIdx: 2,
    //         toIdx: 1,
    //         coin: 0,
    //         amount: 100,
    //         nonce: 0,
    //         userFee: 10
    //     };
    //     const tx3 = {
    //         fromIdx: 1,
    //         toIdx: 2,
    //         coin: 0,
    //         amount: 50,
    //         nonce: 1,
    //         userFee: 10
    //     };
    //     account1.signTx(tx);
    //     account2.signTx(tx2);
    //     account1.signTx(tx3);
    //     bb2.addTx(tx);
    //     bb2.addTx(tx2);
    //     bb2.addTx(tx3);

    //     bb2.addCoin(0, 5);
       
    //     await bb2.build();
    //     const input2 = bb2.getInput();
        
    //     const w2 = circuit.calculateWitness(input2, {logTrigger:false, logOutput: false, logSet: false});
    //     checkBatch(circuit, w2, bb2);
    // });

    // it("Should create 4 deposits and then 3 offchain transfer", async () => {

    //     // Start a new state
    //     const db = new SMTMemDB();
    //     const rollupDB = await RollupDB(db);
    //     const bb = await rollupDB.buildBatch(NTX, NLEVELS);

    //     const account1 = new RollupAccount(1);

    //     bb.addTx({
    //         fromIdx: 1,
    //         loadAmount: 1000,
    //         coin: 0,
    //         ax: account1.ax,
    //         ay: account1.ay,
    //         ethAddress: account1.ethAddress,
    //         onChain: true
    //     });

    //     bb.addTx({
    //         fromIdx: 2,
    //         loadAmount: 1000,
    //         coin: 0,
    //         ax: account1.ax,
    //         ay: account1.ay,
    //         ethAddress: account1.ethAddress,
    //         onChain: true
    //     });

    //     bb.addTx({
    //         fromIdx: 3,
    //         loadAmount: 1000,
    //         coin: 0,
    //         ax: account1.ax,
    //         ay: account1.ay,
    //         ethAddress: account1.ethAddress,
    //         onChain: true
    //     });

    //     bb.addTx({
    //         fromIdx: 4,
    //         loadAmount: 1000,
    //         coin: 0,
    //         ax: account1.ax,
    //         ay: account1.ay,
    //         ethAddress: account1.ethAddress,
    //         onChain: true
    //     });

    //     await bb.build();
    //     const input = bb.getInput();

    //     const w = circuit.calculateWitness(input, {logTrigger:false, logOutput: false, logSet: false});
    //     checkBatch(circuit, w, bb);

    //     await rollupDB.consolidate(bb);

    //     const bb2 = await rollupDB.buildBatch(NTX, NLEVELS);

    //     const tx = {
    //         fromIdx: 1,
    //         toIdx: 3,
    //         coin: 0,
    //         amount: 50,
    //         nonce: 0,
    //         userFee: 10
    //     };
    //     const tx2 = {
    //         fromIdx: 2,
    //         toIdx: 1,
    //         coin: 0,
    //         amount: 100,
    //         nonce: 0,
    //         userFee: 10
    //     };
    //     const tx3 = {
    //         fromIdx: 1,
    //         toIdx: 4,
    //         coin: 0,
    //         amount: 50,
    //         nonce: 1,
    //         userFee: 10
    //     };
    //     account1.signTx(tx);
    //     account1.signTx(tx2);
    //     account1.signTx(tx3);
    //     bb2.addTx(tx);
    //     bb2.addTx(tx2);
    //     bb2.addTx(tx3);

    //     bb2.addCoin(0, 5);
       
    //     await bb2.build();
    //     const input2 = bb2.getInput();
        
    //     const w2 = circuit.calculateWitness(input2, {logTrigger:false, logOutput: false, logSet: false});
    //     checkBatch(circuit, w2, bb2);
    // });

    // it("Should get states correctly", async () => {
    //     // Start a new state
    //     const db = new SMTMemDB();
    //     const rollupDB = await RollupDB(db);
    //     const bb = await rollupDB.buildBatch(NTX, NLEVELS);

    //     const account1 = new RollupAccount(1);
    //     const account2 = new RollupAccount(2);

    //     bb.addTx({
    //         fromIdx: 1,
    //         loadAmount: 1000,
    //         coin: 1,
    //         ax: account1.ax,
    //         ay: account1.ay,
    //         ethAddress: account1.ethAddress,
    //         onChain: true
    //     });

    //     bb.addTx({
    //         fromIdx: 2,
    //         loadAmount: 2000,
    //         coin: 1,
    //         ax: account2.ax,
    //         ay: account2.ay,
    //         ethAddress: account2.ethAddress,
    //         onChain: true
    //     });

    //     bb.addTx({
    //         fromIdx: 3,
    //         loadAmount: 3000,
    //         coin: 2,
    //         ax: account1.ax,
    //         ay: account1.ay,
    //         ethAddress: account1.ethAddress,
    //         onChain: true
    //     });

    //     await bb.build();
    //     const input = bb.getInput();

    //     const w = circuit.calculateWitness(input, {logTrigger:false, logOutput: false, logSet: false});
    //     checkBatch(circuit, w, bb);

    //     await rollupDB.consolidate(bb);

    //     const s1 = await rollupDB.getStateByIdx(1);
    //     assert.equal(s1.ax, account1.ax);
    //     assert.equal(s1.ay, account1.ay);
    //     assert.equal(s1.ethAddress, account1.ethAddress);
    //     assert.equal(s1.amount, 1000);
    //     assert.equal(s1.coin, 1);
    //     assert.equal(s1.nonce, 0);

    //     const s2 = await rollupDB.getStateByIdx(2);
    //     assert.equal(s2.ax, account2.ax);
    //     assert.equal(s2.ay, account2.ay);
    //     assert.equal(s2.ethAddress, account2.ethAddress);
    //     assert.equal(s2.amount, 2000);
    //     assert.equal(s2.coin, 1);
    //     assert.equal(s2.nonce, 0);

    //     const bb2 = await rollupDB.buildBatch(NTX, NLEVELS);

    //     const tx = {
    //         fromIdx: 1,
    //         toIdx: 2,
    //         coin: 1,
    //         amount: bigInt("50"),
    //         nonce: 0,
    //         userFee: bigInt("6")
    //     };
    //     account1.signTx(tx);
    //     bb2.addTx(tx);

    //     bb2.addCoin(1, 5);

    //     await bb2.build();
    //     const input2 = bb2.getInput();

    //     const w2 = circuit.calculateWitness(input2, {logTrigger:false, logOutput: false, logSet: false});
    //     checkBatch(circuit, w2, bb2);

    //     await rollupDB.consolidate(bb2);

    //     const s2_1 = await rollupDB.getStateByIdx(1);
    //     assert.equal(s2_1.ax, account1.ax);
    //     assert.equal(s2_1.ay, account1.ay);
    //     assert.equal(s2_1.ethAddress, account1.ethAddress);
    //     assert.equal(s2_1.amount, 945);
    //     assert.equal(s2_1.coin, 1);
    //     assert.equal(s2_1.nonce, 1);

    //     const s2_2 = await rollupDB.getStateByIdx(2);
    //     assert.equal(s2_2.ax, account2.ax);
    //     assert.equal(s2_2.ay, account2.ay);
    //     assert.equal(s2_2.ethAddress, account2.ethAddress);
    //     assert.equal(s2_2.amount, 2050);
    //     assert.equal(s2_2.coin, 1);
    //     assert.equal(s2_2.nonce, 0);

    //     const s2_3 = await rollupDB.getStateByIdx(3);
    //     assert.equal(s2_3.ax, account1.ax);
    //     assert.equal(s2_3.ay, account1.ay);
    //     assert.equal(s2_3.ethAddress, account1.ethAddress);
    //     assert.equal(s2_3.amount, 3000);
    //     assert.equal(s2_3.coin, 2);
    //     assert.equal(s2_3.nonce, 0);

    //     const s3 = await rollupDB.getStateByAxAy(account1.ax, account1.ay);
    //     assert.deepEqual(s3[0], s2_1);
    //     assert.deepEqual(s3[1], s2_3);

    //     const s4 = await rollupDB.getStateByEthAddr(account1.ethAddress);
    //     assert.deepEqual(s4[0], s2_1);
    //     assert.deepEqual(s4[1], s2_3);

    //     const s5 = await rollupDB.getStateByEthAddr(account2.ethAddress);
    //     assert.deepEqual(s5[0], s2_2);
    // });

    // it("Should create 1 deposit of 0 amount", async () => {

    //     // Start a new state
    //     const db = new SMTMemDB();
    //     const rollupDB = await RollupDB(db);
    //     const bb = await rollupDB.buildBatch(NTX, NLEVELS);

    //     const account1 = new RollupAccount(1);

    //     bb.addTx({
    //         fromIdx: 1,
    //         loadAmount: 0,
    //         coin: 0,
    //         ax: account1.ax,
    //         ay: account1.ay,
    //         ethAddress: account1.ethAddress,
    //         onChain: true
    //     });

    //     await bb.build();
    //     const input = bb.getInput();

    //     const w = circuit.calculateWitness(input, {logTrigger:false, logOutput: false, logSet: false});

    //     checkBatch(circuit, w, bb);
    // });

    // it("Should create a deposit and then offchain transfer to 0", async () => {

    //     // Start a new state
    //     const db = new SMTMemDB();
    //     const rollupDB = await RollupDB(db);
    //     const bb = await rollupDB.buildBatch(NTX, NLEVELS);

    //     const account1 = new RollupAccount(1);

    //     bb.addTx({
    //         fromIdx: 1,
    //         loadAmount: 1000,
    //         coin: 0,
    //         ax: account1.ax,
    //         ay: account1.ay,
    //         ethAddress: account1.ethAddress,
    //         onChain: true
    //     });
    //     await bb.build();
    //     const input = bb.getInput();

    //     const w = circuit.calculateWitness(input, {logTrigger:false, logOutput: false, logSet: false});
    //     checkBatch(circuit, w, bb);

    //     await rollupDB.consolidate(bb);

    //     const bb2 = await rollupDB.buildBatch(NTX, NLEVELS);

    //     const tx = {
    //         fromIdx: 1,
    //         toIdx: 0,
    //         coin: 0,
    //         amount: 50,
    //         nonce: 0,
    //         userFee: 10
    //     };
    //     account1.signTx(tx);
    //     bb2.addTx(tx);
    //     bb2.addCoin(0, 5);
       
    //     await bb2.build();
    //     const input2 = bb2.getInput();
    //     const w2 = circuit.calculateWitness(input2, {logTrigger:false, logOutput: false, logSet: false});
    //     checkBatch(circuit, w2, bb2);
    // });
    // it("Should create 2 deposits and then 4 offchain transfer, 3 of them to 0", async () => {

    //     // Start a new state
    //     const db = new SMTMemDB();
    //     const rollupDB = await RollupDB(db);
    //     const bb = await rollupDB.buildBatch(NTX, NLEVELS);

    //     const account1 = new RollupAccount(1);

    //     bb.addTx({
    //         fromIdx: 1,
    //         loadAmount: 1000,
    //         coin: 0,
    //         ax: account1.ax,
    //         ay: account1.ay,
    //         ethAddress: account1.ethAddress,
    //         onChain: true
    //     });

    //     bb.addTx({
    //         fromIdx: 2,
    //         loadAmount: 1000,
    //         coin: 0,
    //         ax: account1.ax,
    //         ay: account1.ay,
    //         ethAddress: account1.ethAddress,
    //         onChain: true
    //     });
    //     await bb.build();
    //     const input = bb.getInput();

    //     const w = circuit.calculateWitness(input, {logTrigger:false, logOutput: false, logSet: false});
    //     checkBatch(circuit, w, bb);

    //     await rollupDB.consolidate(bb);

    //     const bb2 = await rollupDB.buildBatch(NTX, NLEVELS);

    //     const tx = {
    //         fromIdx: 1,
    //         toIdx: 2,
    //         coin: 0,
    //         amount: 50,
    //         nonce: 0,
    //         userFee: 10
    //     };
    //     account1.signTx(tx);

    //     const tx2 = {
    //         fromIdx: 1,
    //         toIdx: 0,
    //         coin: 0,
    //         amount: 10,
    //         nonce: 1,
    //         userFee: 10
    //     };
    //     account1.signTx(tx2);


    //     const tx3 = {
    //         fromIdx: 1,
    //         toIdx: 0,
    //         coin: 0,
    //         amount: 200,
    //         nonce: 2,
    //         userFee: 10
    //     };
    //     account1.signTx(tx3);
    //     const tx4 = {
    //         fromIdx: 1,
    //         toIdx: 0,
    //         coin: 0,
    //         amount: 100,
    //         nonce: 3,
    //         userFee: 10
    //     };
    //     account1.signTx(tx4);
    //     bb2.addTx(tx);
    //     bb2.addTx(tx2);
    //     bb2.addTx(tx3);
    //     bb2.addTx(tx4);
    //     bb2.addCoin(0, 5);
       
    //     await bb2.build();
    //     const input2 = bb2.getInput();
    //     const w2 = circuit.calculateWitness(input2, {logTrigger:false, logOutput: false, logSet: false});
    //     checkBatch(circuit, w2, bb2);
    //     await rollupDB.consolidate(bb2);
    //     const s2_1 = await rollupDB.getStateByIdx(1);
    //     assert.equal(s2_1.amount.toString(), 620);
    // });
   
    // it("Should create a deposit and then an onchain forceWithdraw and 2 offchain send to 0", async () => {

    //     // Start a new state
    //     const db = new SMTMemDB();
    //     const rollupDB = await RollupDB(db);
    //     const bb = await rollupDB.buildBatch(NTX, NLEVELS);

    //     const account1 = new RollupAccount(1);

    //     bb.addTx({
    //         fromIdx: 1,
    //         loadAmount: 100,
    //         coin: 0,
    //         ax: account1.ax,
    //         ay: account1.ay,
    //         ethAddress: account1.ethAddress,
    //         onChain: true
    //     });

    //     await bb.build();
    //     const input = bb.getInput();

    //     const w = circuit.calculateWitness(input, {logTrigger:false, logOutput: false, logSet: false});
    //     checkBatch(circuit, w, bb);

    //     await rollupDB.consolidate(bb);

    //     const bb2 = await rollupDB.buildBatch(NTX, NLEVELS);

    //     //10
    //     const tx1 = {
    //         fromIdx: 1,
    //         toIdx: 0,
    //         coin: 0,
    //         amount: 40,
    //         nonce: 0,
    //         userFee: 5
    //     };
    //     account1.signTx(tx1);

    //     const tx2 = {
    //         fromIdx: 1,
    //         toIdx: 0,
    //         coin: 0,
    //         amount: 40,
    //         nonce: 1,
    //         userFee: 5
    //     };
    //     account1.signTx(tx2);

    //     const tx3 = {
    //         fromIdx: 1,
    //         toIdx: 0,
    //         coin: 0,
    //         amount: 30,
    //         nonce: 2,
    //         ax: account1.ax,
    //         ay: account1.ay,
    //         ethAddress: account1.ethAddress,
    //         onChain: true
    //     };

    //     bb2.addTx(tx1);
    //     bb2.addTx(tx2);
    //     bb2.addTx(tx3);
    //     bb2.addCoin(0, 5);
       
    //     await bb2.build();
    //     const input2 = bb2.getInput();
    //     const w2 = circuit.calculateWitness(input2, {logTrigger:false, logOutput: false, logSet: false});
    //     checkBatch(circuit, w2, bb2);
    //     await rollupDB.consolidate(bb2);
    //     const s2_1 = await rollupDB.getStateByIdx(1);
    //     assert.equal(s2_1.amount.toString(), 10);
    // });

    // it("Should check underflow onchain", async () => { 
    //     // Start a new state
    //     const db = new SMTMemDB();
    //     const rollupDB = await RollupDB(db);
    //     const bb = await rollupDB.buildBatch(NTX, NLEVELS);
  
    //     const account1 = new RollupAccount(1);
    //     const account2 = new RollupAccount(2);
  
    //     bb.addTx({
    //         fromIdx: 1,
    //         loadAmount: 1000,
    //         coin: 0,
    //         ax: account1.ax,
    //         ay: account1.ay,
    //         ethAddress: account1.ethAddress,
    //         onChain: true
    //     });
  
    //     bb.addTx({
    //         fromIdx: 2,
    //         loadAmount: 2000,
    //         coin: 0,
    //         ax: account2.ax,
    //         ay: account2.ay,
    //         ethAddress: account2.ethAddress,
    //         onChain: true
    //     });
  
    //     await bb.build();
    //     const input = bb.getInput();
  
    //     const w = circuit.calculateWitness(input, {logTrigger:false, logOutput: false, logSet: false});
    //     checkBatch(circuit, w, bb);
  
    //     await rollupDB.consolidate(bb);
  
    //     const bb2 = await rollupDB.buildBatch(NTX, NLEVELS);
  
    //     const tx = {
    //         fromIdx: 1,
    //         toIdx: 2,
    //         coin: 0,
    //         amount: 5000,
    //         nonce: 0,
    //         ax: account1.ax,
    //         ay: account1.ay,
    //         ethAddress: account1.ethAddress,
    //         onChain: true
    //     };
    //     bb2.addTx(tx);

    //     await bb2.build();
    //     const input2 = bb2.getInput();
            
    //     const w2 = circuit.calculateWitness(input2, {logTrigger:false, logOutput: false, logSet: false});
    //     checkBatch(circuit, w2, bb2);
    //     await rollupDB.consolidate(bb2);
    //     const s2_1 = await rollupDB.getStateByIdx(1);
    //     const s2_2 = await rollupDB.getStateByIdx(2);
    //     assert.equal(s2_1.amount.toString(), 1000);
    //     assert.equal(s2_2.amount.toString(), 2000);
        
    // });
    
    // it("Should check 2 onchain transfer to 0 in the same batch", async () => {
    //     // Start a new state
    //     const db = new SMTMemDB();
    //     const rollupDB = await RollupDB(db);
    //     const bb = await rollupDB.buildBatch(NTX, NLEVELS);
                
    //     const account1 = new RollupAccount(1);
    //     const account2 = new RollupAccount(2);
                
    //     bb.addTx({
    //         fromIdx: 1,
    //         loadAmount: 1000,
    //         coin: 0,
    //         ax: account1.ax,
    //         ay: account1.ay,
    //         ethAddress: account1.ethAddress,
    //         onChain: true
    //     });
                
    //     bb.addTx({
    //         fromIdx: 2,
    //         loadAmount: 2000,
    //         coin: 0,
    //         ax: account2.ax,
    //         ay: account2.ay,
    //         ethAddress: account2.ethAddress,
    //         onChain: true
    //     });
                
    //     await bb.build();
    //     const input = bb.getInput();

    //     const w = circuit.calculateWitness(input, {logTrigger:false, logOutput: false, logSet: false});
    //     checkBatch(circuit, w, bb);
                
    //     await rollupDB.consolidate(bb);
                
    //     const bb2 = await rollupDB.buildBatch(NTX, NLEVELS);
                
    //     const tx = {
    //         fromIdx: 1,
    //         toIdx: 0,
    //         coin: 0,
    //         amount: 50,
    //         nonce: 0,
    //         ax: account1.ax,
    //         ay: account1.ay,
    //         ethAddress: account1.ethAddress,
    //         onChain: true
    //     };
    //     const tx2 = {
    //         fromIdx: 1,
    //         toIdx: 0,
    //         coin: 0,
    //         amount: 100,
    //         nonce: 0,
    //         ax: account1.ax,
    //         ay: account1.ay,
    //         ethAddress: account1.ethAddress,
    //         onChain: true
    //     };
    //     bb2.addTx(tx);
    //     bb2.addTx(tx2);
    //     await bb2.build();
    //     const input2 = bb2.getInput();
    //     const w2 = circuit.calculateWitness(input2, {logTrigger:false, logOutput: false, logSet: false});
    //     checkBatch(circuit, w2, bb2);
    //     await rollupDB.consolidate(bb2);
    //     const s2_1 = await rollupDB.getStateByIdx(1);
    //     const s2_2 = await rollupDB.getStateByIdx(2);
    //     assert.equal(s2_1.amount.toString(), 850);
    //     assert.equal(s2_2.amount.toString(), 2000);
    // });
    

    // it("Should check 2 onchain transfer to 0 and a transfer in the same batch", async () => {
    //     // Start a new state
    //     const db = new SMTMemDB();
    //     const rollupDB = await RollupDB(db);
    //     const bb = await rollupDB.buildBatch(NTX, NLEVELS);
                
    //     const account1 = new RollupAccount(1);
    //     const account2 = new RollupAccount(2);
                
    //     bb.addTx({
    //         fromIdx: 1,
    //         loadAmount: 1000,
    //         coin: 0,
    //         ax: account1.ax,
    //         ay: account1.ay,
    //         ethAddress: account1.ethAddress,
    //         onChain: true
    //     });
                
    //     bb.addTx({
    //         fromIdx: 2,
    //         loadAmount: 2000,
    //         coin: 0,
    //         ax: account2.ax,
    //         ay: account2.ay,
    //         ethAddress: account2.ethAddress,
    //         onChain: true
    //     });
                
    //     await bb.build();
    //     const input = bb.getInput();

    //     const w = circuit.calculateWitness(input, {logTrigger:false, logOutput: false, logSet: false});
    //     checkBatch(circuit, w, bb);
                
    //     await rollupDB.consolidate(bb);
                
    //     const bb2 = await rollupDB.buildBatch(NTX, NLEVELS);
                
    //     const tx = {
    //         fromIdx: 1,
    //         toIdx: 0,
    //         coin: 0,
    //         amount: 50,
    //         nonce: 0,
    //         ax: account1.ax,
    //         ay: account1.ay,
    //         ethAddress: account1.ethAddress,
    //         onChain: true
    //     };
    //     const tx2 = {
    //         fromIdx: 1,
    //         toIdx: 0,
    //         coin: 0,
    //         amount: 100,
    //         nonce: 0,
    //         ax: account1.ax,
    //         ay: account1.ay,
    //         ethAddress: account1.ethAddress,
    //         onChain: true
    //     };
    //     const tx3 = {
    //         fromIdx: 2,
    //         toIdx: 1,
    //         coin: 0,
    //         amount: 100,
    //         nonce: 0,
    //         ax: account2.ax,
    //         ay: account2.ay,
    //         ethAddress: account2.ethAddress,
    //         onChain: true
    //     };
    //     bb2.addTx(tx);
    //     bb2.addTx(tx2);
    //     bb2.addTx(tx3);
    //     await bb2.build();
    //     const input2 = bb2.getInput();
    //     const w2 = circuit.calculateWitness(input2, {logTrigger:false, logOutput: false, logSet: false});
    //     checkBatch(circuit, w2, bb2);
    //     await rollupDB.consolidate(bb2);
    //     const s2_1 = await rollupDB.getStateByIdx(1);
    //     const s2_2 = await rollupDB.getStateByIdx(2);
    //     assert.equal(s2_1.amount.toString(), 950);
    //     assert.equal(s2_2.amount.toString(), 1900);
    // });

    // it("Should check error underflow offchain", async () => { 
    //     // Start a new state
    //     const db = new SMTMemDB();
    //     const rollupDB = await RollupDB(db);
    //     const bb = await rollupDB.buildBatch(NTX, NLEVELS);
  
    //     const account1 = new RollupAccount(1);
    //     const account2 = new RollupAccount(2);
  
    //     bb.addTx({
    //         fromIdx: 1,
    //         loadAmount: 1000,
    //         coin: 0,
    //         ax: account1.ax,
    //         ay: account1.ay,
    //         ethAddress: account1.ethAddress,
    //         onChain: true
    //     });
  
    //     bb.addTx({
    //         fromIdx: 2,
    //         loadAmount: 2000,
    //         coin: 0,
    //         ax: account2.ax,
    //         ay: account2.ay,
    //         ethAddress: account2.ethAddress,
    //         onChain: true
    //     });
  
    //     await bb.build();
    //     const input = bb.getInput();
  
    //     const w = circuit.calculateWitness(input, {logTrigger:false, logOutput: false, logSet: false});
    //     checkBatch(circuit, w, bb);
  
    //     await rollupDB.consolidate(bb);
  
    //     const bb2 = await rollupDB.buildBatch(NTX, NLEVELS);
  
    //     const tx = {
    //         fromIdx: 1,
    //         toIdx: 2,
    //         coin: 0,
    //         amount: 5000,
    //         nonce: 0,
    //         userFee: 10
    //     };
    //     account1.signTx(tx);
    //     bb2.addTx(tx);
    //     bb2.addCoin(0, 5);

    //     try {
    //         await bb2.build();
    //         const input2 = bb2.getInput();
              
    //         const w2 = circuit.calculateWitness(input2, {logTrigger:false, logOutput: false, logSet: false});
    //         checkBatch(circuit, w2, bb2);
    //         assert(false);
    //     } catch(error){
    //         assert.include(error.message, "underflow");
    //     }
    // });

    
    // it("Should check error offchain with loadAmount", async () => {
    //     // Start a new state
    //     const db = new SMTMemDB();
    //     const rollupDB = await RollupDB(db);
    //     const bb = await rollupDB.buildBatch(NTX, NLEVELS);
        
    //     const account1 = new RollupAccount(1);
    //     const account2 = new RollupAccount(2);
        
    //     bb.addTx({
    //         fromIdx: 1,
    //         loadAmount: 1000,
    //         coin: 0,
    //         ax: account1.ax,
    //         ay: account1.ay,
    //         ethAddress: account1.ethAddress,
    //         onChain: true
    //     });
        
    //     bb.addTx({
    //         fromIdx: 2,
    //         loadAmount: 2000,
    //         coin: 0,
    //         ax: account2.ax,
    //         ay: account2.ay,
    //         ethAddress: account2.ethAddress,
    //         onChain: true
    //     });
        
    //     await bb.build();
    //     const input = bb.getInput();
        
    //     const w = circuit.calculateWitness(input, {logTrigger:false, logOutput: false, logSet: false});
    //     checkBatch(circuit, w, bb);
        
    //     await rollupDB.consolidate(bb);
        
    //     const bb2 = await rollupDB.buildBatch(NTX, NLEVELS);
        
    //     const tx = {
    //         fromIdx: 1,
    //         toIdx: 2,
    //         loadAmount: 100,
    //         coin: 0,
    //         amount: 50,
    //         nonce: 0,
    //         userFee: 10
    //     };
    //     account1.signTx(tx);
    //     bb2.addTx(tx);
    //     bb2.addCoin(0, 5);
    //     try {
    //         await bb2.build();
    //         const input2 = bb2.getInput();
    //         const w2 = circuit.calculateWitness(input2, {logTrigger:false, logOutput: false, logSet: false});
    //         checkBatch(circuit, w2, bb2);
    //         assert(false);
    //     } catch (error) {
    //         assert.include(error.message, "Load ammount must be 0 for offChainTxs");
    //     }

    // });

    // it("Should check error offchain with invalid fee", async () => { 
    //     // Start a new state
    //     const db = new SMTMemDB();
    //     const rollupDB = await RollupDB(db);
    //     const bb = await rollupDB.buildBatch(NTX, NLEVELS);

    //     const account1 = new RollupAccount(1);
    //     const account2 = new RollupAccount(2);

    //     bb.addTx({
    //         fromIdx: 1,
    //         loadAmount: 1000,
    //         coin: 0,
    //         ax: account1.ax,
    //         ay: account1.ay,
    //         ethAddress: account1.ethAddress,
    //         onChain: true
    //     });

    //     bb.addTx({
    //         fromIdx: 2,
    //         loadAmount: 2000,
    //         coin: 0,
    //         ax: account2.ax,
    //         ay: account2.ay,
    //         ethAddress: account2.ethAddress,
    //         onChain: true
    //     });

    //     await bb.build();
    //     const input = bb.getInput();

    //     const w = circuit.calculateWitness(input, {logTrigger:false, logOutput: false, logSet: false});
    //     checkBatch(circuit, w, bb);

    //     await rollupDB.consolidate(bb);

    //     const bb2 = await rollupDB.buildBatch(NTX, NLEVELS);

    //     const tx = {
    //         fromIdx: 1,
    //         toIdx: 2,
    //         coin: 0,
    //         amount: 50,
    //         nonce: 0,
    //         userFee: 0
    //     };
    //     account1.signTx(tx);
    //     bb2.addTx(tx);

    //     bb2.addCoin(0, 5);
    //     try {
    //         await bb2.build();
    //         const input2 = bb2.getInput();
    //         const w2 = circuit.calculateWitness(input2, {logTrigger:false, logOutput: false, logSet: false});
    //         checkBatch(circuit, w2, bb2);
    //         assert(false);
    //     } catch (error) {
    //         assert.include(error.message, "Constraint doesn't match main.Tx[0].balancesUpdater");
    //     }
    // });
    // it("Should check error offchain with invalid nonce", async () => {
    //     // Start a new state
    //     const db = new SMTMemDB();
    //     const rollupDB = await RollupDB(db);
    //     const bb = await rollupDB.buildBatch(NTX, NLEVELS);

    //     const account1 = new RollupAccount(1);
    //     const account2 = new RollupAccount(2);

    //     bb.addTx({
    //         fromIdx: 1,
    //         loadAmount: 1000,
    //         coin: 0,
    //         ax: account1.ax,
    //         ay: account1.ay,
    //         ethAddress: account1.ethAddress,
    //         onChain: true
    //     });

    //     bb.addTx({
    //         fromIdx: 2,
    //         loadAmount: 2000,
    //         coin: 0,
    //         ax: account2.ax,
    //         ay: account2.ay,
    //         ethAddress: account2.ethAddress,
    //         onChain: true
    //     });

    //     await bb.build();
    //     const input = bb.getInput();

    //     const w = circuit.calculateWitness(input, {logTrigger:false, logOutput: false, logSet: false});
    //     checkBatch(circuit, w, bb);

    //     await rollupDB.consolidate(bb);

    //     const bb2 = await rollupDB.buildBatch(NTX, NLEVELS);

    //     const tx = {
    //         fromIdx: 1,
    //         toIdx: 2,
    //         coin: 0,
    //         amount: 50,
    //         nonce: 0,
    //         userFee: 10
    //     };
    //     const tx2 = {
    //         fromIdx: 1,
    //         toIdx: 2,
    //         coin: 0,
    //         amount: 50,
    //         nonce: 0,
    //         userFee: 10
    //     };
    //     account1.signTx(tx);
    //     account1.signTx(tx2);
    //     bb2.addTx(tx);
    //     bb2.addTx(tx2);

    //     bb2.addCoin(0, 5);
    //     try {
    //         await bb2.build();
    //         const input2 = bb2.getInput();
    //         const w2 = circuit.calculateWitness(input2, {logTrigger:false, logOutput: false, logSet: false});
    //         checkBatch(circuit, w2, bb2);
    //         assert(false);
    //     } catch (error) {
    //         assert.include(error.message, "Constraint doesn't match main.Tx[1].nonceChecker");
    //     }
    // });
    // it("Should check error offchain with invalid signature", async () => {
    //     // Start a new state
    //     const db = new SMTMemDB();
    //     const rollupDB = await RollupDB(db);
    //     const bb = await rollupDB.buildBatch(NTX, NLEVELS);
        
    //     const account1 = new RollupAccount(1);
    //     const account2 = new RollupAccount(2);
        
    //     bb.addTx({
    //         fromIdx: 1,
    //         loadAmount: 1000,
    //         coin: 0,
    //         ax: account1.ax,
    //         ay: account1.ay,
    //         ethAddress: account1.ethAddress,
    //         onChain: true
    //     });
        
    //     bb.addTx({
    //         fromIdx: 2,
    //         loadAmount: 2000,
    //         coin: 0,
    //         ax: account2.ax,
    //         ay: account2.ay,
    //         ethAddress: account2.ethAddress,
    //         onChain: true
    //     });
        
    //     await bb.build();
    //     const input = bb.getInput();
        
    //     const w = circuit.calculateWitness(input, {logTrigger:false, logOutput: false, logSet: false});
    //     checkBatch(circuit, w, bb);
        
    //     await rollupDB.consolidate(bb);
        
    //     const bb2 = await rollupDB.buildBatch(NTX, NLEVELS);
        
    //     const tx = {
    //         fromIdx: 1,
    //         toIdx: 2,
    //         coin: 0,
    //         amount: 50,
    //         nonce: 0,
    //         userFee: 10
    //     };
    //     account2.signTx(tx);
    //     bb2.addTx(tx);
        
    //     bb2.addCoin(0, 5);
    //     try {
    //         await bb2.build();
    //         const input2 = bb2.getInput();
    //         const w2 = circuit.calculateWitness(input2, {logTrigger:false, logOutput: false, logSet: false});
    //         checkBatch(circuit, w2, bb2);
    //         assert(false);
    //     } catch (error) {
    //         assert.include(error.message, "Constraint doesn't match main.Tx[0].sigVerifier.eqCheckX");
    //     }
    // });
    // it("Should check error offchain with not defined coin", async () => {
    //     // Start a new state
    //     const db = new SMTMemDB();
    //     const rollupDB = await RollupDB(db);
    //     const bb = await rollupDB.buildBatch(NTX, NLEVELS);
        
    //     const account1 = new RollupAccount(1);
    //     const account2 = new RollupAccount(2);
        
    //     bb.addTx({
    //         fromIdx: 1,
    //         loadAmount: 1000,
    //         coin: 0,
    //         ax: account1.ax,
    //         ay: account1.ay,
    //         ethAddress: account1.ethAddress,
    //         onChain: true
    //     });
        
    //     bb.addTx({
    //         fromIdx: 2,
    //         loadAmount: 2000,
    //         coin: 0,
    //         ax: account2.ax,
    //         ay: account2.ay,
    //         ethAddress: account2.ethAddress,
    //         onChain: true
    //     });
        
    //     await bb.build();
    //     const input = bb.getInput();
        
    //     const w = circuit.calculateWitness(input, {logTrigger:false, logOutput: false, logSet: false});
    //     checkBatch(circuit, w, bb);
        
    //     await rollupDB.consolidate(bb);
        
    //     const bb2 = await rollupDB.buildBatch(NTX, NLEVELS);
        
    //     const tx = {
    //         fromIdx: 1,
    //         toIdx: 2,
    //         coin: 2,
    //         amount: 50,
    //         nonce: 0,
    //         userFee: 10
    //     };
    //     account1.signTx(tx);
    //     bb2.addTx(tx);
        
    //     bb2.addCoin(1, 5);
    //     try {
    //         await bb2.build();
    //         const input2 = bb2.getInput();
    //         const w2 = circuit.calculateWitness(input2, {logTrigger:false, logOutput: false, logSet: false});
    //         checkBatch(circuit, w2, bb2);
    //         assert(false);
    //     } catch (error) {
    //         assert.include(error.message, "Constraint doesn't match main.Tx[0].processor1.checkOldInput");
    //     }
    // });
    // it("Should check error offchain with double defined coin", async () => {
    //     // Start a new state
    //     const db = new SMTMemDB();
    //     const rollupDB = await RollupDB(db);
    //     const bb = await rollupDB.buildBatch(NTX, NLEVELS);
        
    //     const account1 = new RollupAccount(1);
    //     const account2 = new RollupAccount(2);
        
    //     bb.addTx({
    //         fromIdx: 1,
    //         loadAmount: 1000,
    //         coin: 0,
    //         ax: account1.ax,
    //         ay: account1.ay,
    //         ethAddress: account1.ethAddress,
    //         onChain: true
    //     });
        
    //     bb.addTx({
    //         fromIdx: 2,
    //         loadAmount: 2000,
    //         coin: 1,
    //         ax: account2.ax,
    //         ay: account2.ay,
    //         ethAddress: account2.ethAddress,
    //         onChain: true
    //     });
        
    //     await bb.build();
    //     const input = bb.getInput();
        
    //     const w = circuit.calculateWitness(input, {logTrigger:false, logOutput: false, logSet: false});
    //     checkBatch(circuit, w, bb);
        
    //     await rollupDB.consolidate(bb);
        
    //     const bb2 = await rollupDB.buildBatch(NTX, NLEVELS);
        
    //     const tx = {
    //         fromIdx: 1,
    //         toIdx: 2,
    //         coin: 0,
    //         amount: 50,
    //         nonce: 0,
    //         userFee: 10
    //     };
    //     account1.signTx(tx);
    //     bb2.addTx(tx);
        
    //     bb2.addCoin(0, 5);
    //     try { 
    //         await bb2.build();
    //         const input2 = bb2.getInput();
                
    //         const w2 = circuit.calculateWitness(input2, {logTrigger:false, logOutput: false, logSet: false});
    //         checkBatch(circuit, w2, bb2);
    //         assert(false);
    //     } catch (error) {
    //         assert.include(error.message, "Constraint doesn't match main.Tx[0].processor2.checkOldInput");
    //     }
    // });

    // it("Should check error offchain send to unexisting leaf", async () => {
    //     // Start a new state
    //     const db = new SMTMemDB();
    //     const rollupDB = await RollupDB(db);
    //     const bb = await rollupDB.buildBatch(NTX, NLEVELS);
        
    //     const account1 = new RollupAccount(1);
    //     const account2 = new RollupAccount(2);
        
    //     bb.addTx({
    //         fromIdx: 1,
    //         loadAmount: 1000,
    //         coin: 0,
    //         ax: account1.ax,
    //         ay: account1.ay,
    //         ethAddress: account1.ethAddress,
    //         onChain: true
    //     });
        
    //     bb.addTx({
    //         fromIdx: 2,
    //         loadAmount: 2000,
    //         coin: 1,
    //         ax: account2.ax,
    //         ay: account2.ay,
    //         ethAddress: account2.ethAddress,
    //         onChain: true
    //     });
        
    //     await bb.build();
    //     const input = bb.getInput();
        
    //     const w = circuit.calculateWitness(input, {logTrigger:false, logOutput: false, logSet: false});
    //     checkBatch(circuit, w, bb);
        
    //     await rollupDB.consolidate(bb);
        
    //     const bb2 = await rollupDB.buildBatch(NTX, NLEVELS);
        
    //     const tx = {
    //         fromIdx: 1,
    //         toIdx: 3,
    //         coin: 0,
    //         amount: 50,
    //         nonce: 0,
    //         userFee: 10
    //     };
    //     account1.signTx(tx);
    //     bb2.addTx(tx);
        
    //     bb2.addCoin(0, 5);
    //     try { 
    //         await bb2.build();
    //         const input2 = bb2.getInput();
                
    //         const w2 = circuit.calculateWitness(input2, {logTrigger:false, logOutput: false, logSet: false});
    //         checkBatch(circuit, w2, bb2);
    //         assert(false);
    //     } catch (error) {
    //         assert.include(error.message, "trying to send to a wrong address");
    //     }
    // });

    // it("Should check error deposit offchain", async () => {
    //     //if there's fee will be an underflow error from batchbuilder, if there's no fee defined for that coin, the circuit send the error
    //     // Start a new state
    //     const db = new SMTMemDB();
    //     const rollupDB = await RollupDB(db);
    //     const bb = await rollupDB.buildBatch(NTX, NLEVELS);
        
    //     const account1 = new RollupAccount(1);
    //     const account2 = new RollupAccount(2);
        
    //     bb.addTx({
    //         fromIdx: 1,
    //         loadAmount: 1000,
    //         coin: 0,
    //         ax: account1.ax,
    //         ay: account1.ay,
    //         ethAddress: account1.ethAddress,
    //         onChain: true
    //     });
        
    //     bb.addTx({
    //         fromIdx: 2,
    //         loadAmount: 2000,
    //         coin: 1,
    //         ax: account2.ax,
    //         ay: account2.ay,
    //         ethAddress: account2.ethAddress,
    //         onChain: true
    //     });
        
    //     await bb.build();
    //     const input = bb.getInput();
        
    //     const w = circuit.calculateWitness(input, {logTrigger:false, logOutput: false, logSet: false});
    //     checkBatch(circuit, w, bb);
        
    //     await rollupDB.consolidate(bb);
        
    //     const bb2 = await rollupDB.buildBatch(NTX, NLEVELS);
        
    //     const tx = {
    //         fromIdx: 3,
    //         coin: 0,
    //         amount: 0,
    //         nonce: 0,
    //         userFee: 0,
    //         ax: account2.ax,
    //         ay: account2.ay,
    //         ethAddress: account2.ethAddress
    //     };
    //     account1.signTx(tx);
    //     bb2.addTx(tx);

    //     try { 
    //         await bb2.build();
    //         const input2 = bb2.getInput();
                
    //         const w2 = circuit.calculateWitness(input2, {logTrigger:false, logOutput: false, logSet: false});
    //         checkBatch(circuit, w2, bb2);
    //         assert(false);
    //     } catch (error) {
    //         assert.include(error.message, "Constraint doesn't match main.Tx[0].states");
    //     }
    // });

    // it("Should check error batch with invalid order", async () => {
    //     // Start a new state
    //     const db = new SMTMemDB();
    //     const rollupDB = await RollupDB(db);
    //     const bb = await rollupDB.buildBatch(NTX, NLEVELS);
 
    //     const account1 = new RollupAccount(1);
    //     const account2 = new RollupAccount(2);
 
    //     bb.addTx({
    //         fromIdx: 1,
    //         loadAmount: 1000,
    //         coin: 0,
    //         ax: account1.ax,
    //         ay: account1.ay,
    //         ethAddress: account1.ethAddress,
    //         onChain: true
    //     });
 
    //     bb.addTx({
    //         fromIdx: 2,
    //         loadAmount: 2000,
    //         coin: 0,
    //         ax: account2.ax,
    //         ay: account2.ay,
    //         ethAddress: account2.ethAddress,
    //         onChain: true
    //     });
 
    //     await bb.build();
    //     const input = bb.getInput();
 
    //     const w = circuit.calculateWitness(input, {logTrigger:false, logOutput: false, logSet: false});
    //     checkBatch(circuit, w, bb);
 
    //     await rollupDB.consolidate(bb);
 
    //     const bb2 = await rollupDB.buildBatch(NTX, NLEVELS);
 
    //     const tx = {
    //         fromIdx: 1,
    //         toIdx: 2,
    //         coin: 0,
    //         amount: 50,
    //         nonce: 0,
    //         userFee: 10
    //     };
    //     account1.signTx(tx);
    //     bb2.addTx(tx);
 
    //     bb2.addCoin(0, 5);
        
    //     try {
    //         await bb2.build();
    //         const input2 = bb2.getInput();
    //         const w2 = circuit.calculateWitness(input2, {logTrigger:false, logOutput: false, logSet: false});
    //         checkBatch(circuit, w2, bb);
    //         assert(false);
    //     }
    //     catch(error){
    //         assert.include(error.message, "AssertionError");
    //     }
    // });
});
