const chai = require("chai");
const path = require("path");
const snarkjs = require("snarkjs");
const compiler = require("circom");
const utils = require("../js/utils");
const bigInt = require("snarkjs").bigInt;
const SMT = require("circomlib").SMT;
const BlockBuilder = require("../js/blockbuilder");
const fs = require("fs");
const RollupAccount = require("../js/rollupaccount");

const assert = chai.assert;

function checkBlock(circuit, w, bb) {
    const newStateRoot = w[circuit.getSignalIdx("main.newStRoot")];
    assert(newStateRoot.equals(bb.getNewStateRoot()));

    const newExitRoot = w[circuit.getSignalIdx("main.newExitRoot")];
    assert(newExitRoot.equals(bb.getNewExitRoot()));

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
        // const cirDef = await compiler(path.join(__dirname, "circuits", "rollup_test.circom"), {reduceConstraints:false});
        const cirDef = JSON.parse(fs.readFileSync(path.join(__dirname, "circuits", "circuit.json"), "utf8"));
        circuit = new snarkjs.Circuit(cirDef);
        console.log("NConstrains Rollup: " + circuit.nConstraints);
    });

    it("Should create 4 empty TXs", async () => {

        // Start a new state
        const state = await SMT.newMemEmptyTrie();
        const bb = new BlockBuilder(state, 4, 8);

        await bb.build();
        const input = bb.getInput();

        const w = circuit.calculateWitness(input, {logTrigger:false, logOutput: false, logSet: false});

        checkBlock(circuit, w, bb);
    });
    it("Should create 1 onChain TXs", async () => {

        // Start a new state
        const state = await SMT.newMemEmptyTrie();
        const bb = new BlockBuilder(state, 4, 8);

        const account1 = new RollupAccount();

        bb.createAccount({
            fromIdx: 1,
            loadAmount: 1000,
            coin: 0,
            ax: account1.ax,
            ay: account1.ay,
            ethAddress: account1.ethAddress
        });

        await bb.build();
        const input = bb.getInput();

        const w = circuit.calculateWitness(input, {logTrigger:false, logOutput: false, logSet: false});

        checkBlock(circuit, w, bb);
    });
});
