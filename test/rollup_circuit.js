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

function checkBlock(circuit, w, bb) {
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
        const bb = await rollupDB.buildBlock(4, 8);

        await bb.build();
        const input = bb.getInput();

        const w = circuit.calculateWitness(input, {logTrigger:false, logOutput: false, logSet: false});

        checkBlock(circuit, w, bb);
    });
    it("Should create 1 deposit onchain TXs", async () => {

        // Start a new state
        const db = new SMTMemDB();
        const rollupDB = await RollupDB(db);
        const bb = await rollupDB.buildBlock(4, 8);

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

        checkBlock(circuit, w, bb);
    });
    it("Should create 1 deposit onchain TXs and 1 exit onchain TX", async () => {

        // Start a new state
        const db = new SMTMemDB();
        const rollupDB = await RollupDB(db);
        const bb = await rollupDB.buildBlock(4, 8);

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

        checkBlock(circuit, w, bb);
    });
    it("Should create 2 deposits and then a normal offchain transfer", async () => {

        // Start a new state
        const db = new SMTMemDB();
        const rollupDB = await RollupDB(db);
        const bb = await rollupDB.buildBlock(4, 8);

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
        checkBlock(circuit, w, bb);

        await rollupDB.consolidate(bb);

        const bb2 = await rollupDB.buildBlock(4, 8);

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
        checkBlock(circuit, w2, bb2);
    });
    it("Should check big amounts", async () => {

        // Start a new state
        const db = new SMTMemDB();
        const rollupDB = await RollupDB(db);
        const bb = await rollupDB.buildBlock(4, 8);

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
        checkBlock(circuit, w, bb);

        await rollupDB.consolidate(bb);

        const bb2 = await rollupDB.buildBlock(4, 8);

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
        checkBlock(circuit, w2, bb2);
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
    it("Should check block with invalid order", async () => {
    });

});
