const chai = require("chai");
const path = require("path");
const snarkjs = require("snarkjs");
const compiler = require("circom");
const bigInt = require("snarkjs").bigInt;
const SMT = require("circomlib").SMT;
const SMTMemDB = require("circomlib").SMTMemDB;
const fs = require("fs");
const RollupAccount = require("../js/rollupaccount");
const RollupDB = require("../js/rollupdb");

const assert = chai.assert;

function checkBatch(circuit, w, bb) {
    const newStateRoot = w[circuit.getSignalIdx("main.newStRoot")];
/*    console.log(newStateRoot.toString());
    const v=bb.getNewStateRoot();
    console.log(v);
*/    assert(newStateRoot.equals(bb.getNewStateRoot()));


    const newExitRoot = w[circuit.getSignalIdx("main.newExitRoot")];
/*    console.log(newExitRoot.toString());
    const v2=bb.getNewExitRoot();
    console.log(v2);
*/    assert(newExitRoot.equals(bb.getNewExitRoot()));

    const onChainHash = w[circuit.getSignalIdx("main.onChainHash")];
    assert(onChainHash.equals(bb.getOnChainHash()));

    const offChainHash = w[circuit.getSignalIdx("main.offChainHash")];
    assert(offChainHash.equals(bb.getOffChainHash()));

    const countersOut = w[circuit.getSignalIdx("main.countersOut")];
    assert(countersOut.equals(bb.getCountersOut()));
}

describe("Rollup run 4 null TX", function () {
    let circuit;

    this.timeout(100000);

    before( async() => {
        const cirDef = await compiler(path.join(__dirname, "circuits", "rollup_test.circom"), {reduceConstraints:false});
        // const cirDef = JSON.parse(fs.readFileSync(path.join(__dirname, "circuits", "circuit.json"), "utf8"));
        circuit = new snarkjs.Circuit(cirDef);
        console.log("NConstrains Rollup: " + circuit.nConstraints);
    });
    it("Should create 4 empty TXs", async () => {

        // Start a new state
        const db = new SMTMemDB();
        const rollupDB = await RollupDB(db);
        const bb = await rollupDB.buildBatch(4, 8);

        await bb.build();
        const input = bb.getInput();

        const w = circuit.calculateWitness(input, {logTrigger:false, logOutput: false, logSet: false});

        checkBatch(circuit, w, bb);
    });
    it("Should create 1 deposit onchain TXs", async () => {

        // Start a new state
        const db = new SMTMemDB();
        const rollupDB = await RollupDB(db);
        const bb = await rollupDB.buildBatch(4, 8);

        const account1 = new RollupAccount(1);

        bb.addTx({
            fromIdx: 1,
            loadAmount: 1000,
            coin: 0,
            ax: account1.ax,
            ay: account1.ay,
            ethAddress: account1.ethAddress,
            onChain: true
        });

        await bb.build();
        const input = bb.getInput();

        const w = circuit.calculateWitness(input, {logTrigger:false, logOutput: false, logSet: false});

        checkBatch(circuit, w, bb);
    });
    it("Should create 1 deposit onchain TXs and 1 exit onchain TX", async () => {

        // Start a new state
        const db = new SMTMemDB();
        const rollupDB = await RollupDB(db);
        const bb = await rollupDB.buildBatch(4, 8);

        const account1 = new RollupAccount(1);

        bb.addTx({
            fromIdx: 1,
            loadAmount: 1000,
            coin: 0,
            ax: account1.ax,
            ay: account1.ay,
            ethAddress: account1.ethAddress,
            onChain: true
        });

        bb.addTx({
            fromIdx: 1,
            toIdx: 0,
            loadAmount: 0,
            coin: 0,
            ax: account1.ax,
            ay: account1.ay,
            ethAddress: account1.ethAddress,
            amount: 1000,
            onChain: true
        });

        await bb.build();
        const input = bb.getInput();

//        console.log(JSON.stringify(snarkjs.stringifyBigInts(input), null, 1));

        const w = circuit.calculateWitness(input, {logTrigger:false, logOutput: false, logSet: false});

        checkBatch(circuit, w, bb);
    });
    it("Should create 2 deposits and then a normal offchain transfer", async () => {

        // Start a new state
        const db = new SMTMemDB();
        const rollupDB = await RollupDB(db);
        const bb = await rollupDB.buildBatch(4, 8);

        const account1 = new RollupAccount(1);
        const account2 = new RollupAccount(2);

        bb.addTx({
            fromIdx: 1,
            loadAmount: 1000,
            coin: 0,
            ax: account1.ax,
            ay: account1.ay,
            ethAddress: account1.ethAddress,
            onChain: true
        });

        bb.addTx({
            fromIdx: 2,
            loadAmount: 2000,
            coin: 0,
            ax: account2.ax,
            ay: account2.ay,
            ethAddress: account2.ethAddress,
            onChain: true
        });

        await bb.build();
        const input = bb.getInput();

        const w = circuit.calculateWitness(input, {logTrigger:false, logOutput: false, logSet: false});
        checkBatch(circuit, w, bb);

        await rollupDB.consolidate(bb);

        const bb2 = await rollupDB.buildBatch(4, 8);

        const tx = {
            fromIdx: 1,
            toIdx: 2,
            coin: 0,
            amount: 50,
            nonce: 0,
            userFee: 10
        };
        account1.signTx(tx);
        bb2.addTx(tx);

        bb2.addCoin(0, 5);

        await bb2.build();
        const input2 = bb2.getInput();

        const w2 = circuit.calculateWitness(input2, {logTrigger:false, logOutput: false, logSet: false});
        checkBatch(circuit, w2, bb2);
    });
    it("Should check big amounts", async () => {

        // Start a new state
        const db = new SMTMemDB();
        const rollupDB = await RollupDB(db);
        const bb = await rollupDB.buildBatch(4, 8);

        const account1 = new RollupAccount(1);
        const account2 = new RollupAccount(2);

        bb.addTx({
            fromIdx: 1,
            loadAmount: bigInt("1000000000000000000000"),
            coin: 0,
            ax: account1.ax,
            ay: account1.ay,
            ethAddress: account1.ethAddress,
            onChain: true
        });

        bb.addTx({
            fromIdx: 2,
            loadAmount: bigInt("2000000000000000000000"),
            coin: 0,
            ax: account2.ax,
            ay: account2.ay,
            ethAddress: account2.ethAddress,
            onChain: true
        });

        await bb.build();
        const input = bb.getInput();

        const w = circuit.calculateWitness(input, {logTrigger:false, logOutput: false, logSet: false});
        checkBatch(circuit, w, bb);

        await rollupDB.consolidate(bb);

        const bb2 = await rollupDB.buildBatch(4, 8);

        const tx = {
            fromIdx: 1,
            toIdx: 2,
            coin: 0,
            amount: bigInt("1000000000000000000"),
            nonce: 0,
            userFee: bigInt("2000000000000")
        };
        account1.signTx(tx);
        bb2.addTx(tx);

        bb2.addCoin(0, 5);

        await bb2.build();
        const input2 = bb2.getInput();

        const w2 = circuit.calculateWitness(input2, {logTrigger:false, logOutput: false, logSet: false});
        checkBatch(circuit, w2, bb2);
    });
    it("Should bet states correctly", async () => {
        // Start a new state
        const db = new SMTMemDB();
        const rollupDB = await RollupDB(db);
        const bb = await rollupDB.buildBatch(4, 8);

        const account1 = new RollupAccount(1);
        const account2 = new RollupAccount(2);

        bb.addTx({
            fromIdx: 1,
            loadAmount: 1000,
            coin: 1,
            ax: account1.ax,
            ay: account1.ay,
            ethAddress: account1.ethAddress,
            onChain: true
        });

        bb.addTx({
            fromIdx: 2,
            loadAmount: 2000,
            coin: 1,
            ax: account2.ax,
            ay: account2.ay,
            ethAddress: account2.ethAddress,
            onChain: true
        });

        bb.addTx({
            fromIdx: 3,
            loadAmount: 3000,
            coin: 2,
            ax: account1.ax,
            ay: account1.ay,
            ethAddress: account1.ethAddress,
            onChain: true
        });

        await bb.build();
        const input = bb.getInput();

        const w = circuit.calculateWitness(input, {logTrigger:false, logOutput: false, logSet: false});
        checkBatch(circuit, w, bb);

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
            fromIdx: 1,
            toIdx: 2,
            coin: 1,
            amount: bigInt("50"),
            nonce: 0,
            userFee: bigInt("6")
        };
        account1.signTx(tx);
        bb2.addTx(tx);

        bb2.addCoin(1, 5);

        await bb2.build();
        const input2 = bb2.getInput();

        const w2 = circuit.calculateWitness(input2, {logTrigger:false, logOutput: false, logSet: false});
        checkBatch(circuit, w2, bb2);

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
    it("Should create 2 deposits and then a normal offchain transfer", async () => {

    });
    it("Should check underflow onchain", async () => {
    });
    it("Should check underflow offchain", async () => {
    });
    it("Should check offchain with loadAmount", async () => {
    });
    it("Should check onchain transfer", async () => {
    });
    it("Should check onchain deposit existing", async () => {
    });
    it("Should check combined deposit transfer", async () => {
    });
    it("Should check combined deposit exit", async () => {
    });
    it("Should check offchain with invalid fee", async () => {
    });
    it("Should check offchain with invalid nonce", async () => {
    });
    it("Should check offchain with invalid signature", async () => {
    });
    it("Should check offchain with not defined coin", async () => {
    });
    it("Should check offchain with double defined coin", async () => {
    });
    it("Should check batch with invalid order", async () => {
    });

});


