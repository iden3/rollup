const chai = require("chai");
const path = require("path");
const snarkjs = require("snarkjs");
const compiler = require("circom");
const { bigInt } = snarkjs;

const assert = chai.assert;

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
            userFee: 2,
            operatorFee: 2,
            onChain: 0,
            nop: 0,
            loadAmount: 0,
            countersIn: 0,
            countersBase: 0
        };

        const w = circuit.calculateWitness(input, {logOutput: false});

        const newStAmountSender = w[circuit.getSignalIdx("main.newStAmountSender")];
        const newStAmountReceiver = w[circuit.getSignalIdx("main.newStAmountReceiver")];

        assert(newStAmountSender.equals(3));
        assert(newStAmountReceiver.equals(25));

    });

    it("Check underflow onChain", async () => {
        const input = {
            oldStAmountSender: 10,
            oldStAmountRecieiver: 20,
            amount: 11,
            loadAmount: 0,
            userFee: 0,
            operatorFee: 0,
            onChain: 1,
            nop: 0,
            countersIn: 0,
            countersBase: 0
        };

        const w = circuit.calculateWitness(input, {logOutput: false});

        const newStAmountSender = w[circuit.getSignalIdx("main.newStAmountSender")];
        const newStAmountReceiver = w[circuit.getSignalIdx("main.newStAmountReceiver")];

        assert(newStAmountSender.equals(10));       // Should not variate
        assert(newStAmountReceiver.equals(20));
    });

    it("Check overflow onChain", async () => {
        const input = {
            oldStAmountSender: bigInt.one.shl(192).sub(bigInt(1)),
            oldStAmountRecieiver: 20,
            amount: 0,
            loadAmount: 1,
            userFee: 1,
            operatorFee: 0,
            onChain: 1,
            nop: 0,
            countersIn: 0,
            countersBase: 0
        };

        try {
            circuit.calculateWitness(input, {logOutput: false});
            assert(false, "Constraint matches");
        } catch (err) {
            assert.equal(err.message.includes("Constraint doesn't match"), true);
            assert.equal(err.message.includes("main.n2bSender"), true);
        }
    });

    it("Check underflow offchain", async () => {
        const input = {
            oldStAmountSender: 10,
            oldStAmountRecieiver: 20,
            amount: 9,
            loadAmount: 0,
            userFee: 2,
            operatorFee: 2,
            onChain: 0,
            nop: 0,
            countersIn: 0,
            countersBase: 0
        };

        try {
            circuit.calculateWitness(input, {logOutput: false});
            assert(false, "Constraint matches");
        } catch (err) {
            assert.equal(err.message.includes("Constraint doesn't match main:"), true);
            assert.equal(err.message.includes("1 != 0"), true);
        }
    });

    it("Check fee operator > fee user ", async () => {
        const input = {
            oldStAmountSender: 10,
            oldStAmountRecieiver: bigInt.one.shl(200).sub(bigInt(1)),
            amount: 1,
            loadAmount: 0,
            userFee: 0,
            operatorFee: 4,
            onChain: 0,
            nop: 0,
            countersIn: 0,
            countersBase: 0
        };

        try {
            circuit.calculateWitness(input, {logOutput: false});
            assert(false, "Constraint matches");
        } catch (err) {
            assert.equal(err.message.includes("Constraint doesn't match main:"), true);
            assert.equal(err.message.includes("1 != 0"), true);
        }
    });

    it("Check fee offChain", async () => {

        const input = {
            oldStAmountSender: 10,
            oldStAmountRecieiver: 20,
            amount: 1,
            loadAmount: 0,
            userFee: 3,
            operatorFee: 4,
            onChain: 0,
            nop: 0,
            countersIn: 0,
            countersBase: 0
        };

        try {
            circuit.calculateWitness(input, {logOutput: false});
            assert(false, "Constraint matches");
        } catch (err) {
            assert.equal(err.message.includes("Constraint doesn't match main:"), true);
            assert.equal(err.message.includes("1 != 0"), true);
        }
    });
});
