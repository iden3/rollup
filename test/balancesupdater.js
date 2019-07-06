const chai = require("chai");
const path = require("path");
const snarkjs = require("snarkjs");
const compiler = require("circom");

const assert = chai.assert;

const bigInt = require("snarkjs").bigInt;

describe("Decode float test", function () {
    let circuit;

    this.timeout(100000);

    before( async() => {
        const cirDef = await compiler(path.join(__dirname, "circuits", "balancesupdater_test.circom"));
        circuit = new snarkjs.Circuit(cirDef);
        console.log("NConstraints BalancesUpdater: " + circuit.nConstraints);
    });

    it("Check a normal TX works ok", async () => {
        const input = {
            oldStAmountSender: 10,
            oldStAmountRecieiver: 20,
            amount: 5,
            fee: 2,
            minFee: 2,
            inChain: 0
        };

        const w = circuit.calculateWitness(input, {logOutput: false});

        const newStAmountSender = w[circuit.getSignalIdx("main.newStAmountSender")];
        const newStAmountReceiver = w[circuit.getSignalIdx("main.newStAmountReceiver")];

        assert(newStAmountSender.equals(3));
        assert(newStAmountReceiver.equals(25));

    });
    it("Check underflow inChain", async () => {
        const input = {
            oldStAmountSender: 10,
            oldStAmountRecieiver: 20,
            amount: 9,
            fee: 2,
            minFee: 2,
            inChain: 1
        };

        const w = circuit.calculateWitness(input, {logOutput: false});

        const newStAmountSender = w[circuit.getSignalIdx("main.newStAmountSender")];
        const newStAmountReceiver = w[circuit.getSignalIdx("main.newStAmountReceiver")];

        assert(newStAmountSender.equals(10));       // Should not variate
        assert(newStAmountReceiver.equals(20));
    });
    it("Check overflow inChain", async () => {
        const input = {
            oldStAmountSender: 10,
            oldStAmountRecieiver: bigInt.one.shl(126).sub(bigInt(1)),
            amount: 1,
            fee: 2,
            minFee: 2,
            inChain: 1
        };

        const w = circuit.calculateWitness(input, {logOutput: false});

        const newStAmountSender = w[circuit.getSignalIdx("main.newStAmountSender")];
        const newStAmountReceiver = w[circuit.getSignalIdx("main.newStAmountReceiver")];

        assert(newStAmountSender.equals(10));       // Should not variate
        assert(newStAmountReceiver.equals(bigInt.one.shl(126).sub(bigInt(1))));
    });
    it("Check fee inChain", async () => {
        const input = {
            oldStAmountSender: 10,
            oldStAmountRecieiver: 20,
            amount: 1,
            fee: 2,
            minFee: 3,
            inChain: 1
        };

        const w = circuit.calculateWitness(input, {logOutput: false});

        const newStAmountSender = w[circuit.getSignalIdx("main.newStAmountSender")];
        const newStAmountReceiver = w[circuit.getSignalIdx("main.newStAmountReceiver")];

        assert(newStAmountSender.equals(10));       // Should not variate
        assert(newStAmountReceiver.equals(20));
    });
    it("Check underflow offchain", async () => {
        const input = {
            oldStAmountSender: 10,
            oldStAmountRecieiver: 20,
            amount: 9,
            fee: 2,
            minFee: 2,
            inChain: 0
        };

        try {
            circuit.calculateWitness(input, {logOutput: false});
            assert(false, "Constraint matches");
        } catch (err) {
            assert.equal(err.message, "Constraint doesn't match: 1 != 0");
        }
    });
    it("Check overflow offChain", async () => {
        const input = {
            oldStAmountSender: 10,
            oldStAmountRecieiver: bigInt.one.shl(126).sub(bigInt(1)),
            amount: 1,
            fee: 2,
            minFee: 2,
            inChain: 0
        };

        try {
            circuit.calculateWitness(input, {logOutput: false});
            assert(false, "Constraint matches");
        } catch (err) {
            assert.equal(err.message, "Constraint doesn't match: 1 != 0");
        }
    });
    it("Check fee offChain", async () => {
        const input = {
            oldStAmountSender: 10,
            oldStAmountRecieiver: 20,
            amount: 1,
            fee: 2,
            minFee: 3,
            inChain: 0
        };

        try {
            circuit.calculateWitness(input, {logOutput: false});
            assert(false, "Constraint matches");
        } catch (err) {
            assert.equal(err.message, "Constraint doesn't match: 1 != 0");
        }
    });

});
