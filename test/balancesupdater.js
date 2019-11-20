const chai = require("chai");
const path = require("path");
const snarkjs = require("snarkjs");
const compiler = require("circom");

const assert = chai.assert;

describe("Decode float test", function () {
    let circuit;

    this.timeout(100000);

    before( async() => {
        const cirDef = await compiler(path.join(__dirname, "circuits", "balancesupdater_test.circom"));
        circuit = new snarkjs.Circuit(cirDef);
        console.log("NConstraints BalancesUpdater: " + circuit.nConstraints);
    });

    it("Should check a normal offChain transaction", async () => {
        const input = {
            oldStAmountSender: 10,
            oldStAmountRecieiver: 20,
            amount: 5,
            loadAmount: 0,
            userFee: 2,
            operatorFee: 2,
            onChain: 0,
            nop: 0,
            countersIn: 0,
            countersBase: 0
        };

        const w = circuit.calculateWitness(input, {logOutput: false});

        const newStAmountSender = w[circuit.getSignalIdx("main.newStAmountSender")];
        const newStAmountReceiver = w[circuit.getSignalIdx("main.newStAmountReceiver")];

        assert(newStAmountSender.equals(3));
        assert(newStAmountReceiver.equals(25));

    });

    it("Should check a normal onChain transaction", async () => {
        const input = {
            oldStAmountSender: 10,
            oldStAmountRecieiver: 20,
            amount: 0,
            loadAmount: 5,
            userFee: 2,
            operatorFee: 2,
            onChain: 1,
            nop: 0,
            countersIn: 0,
            countersBase: 0
        };

        const w = circuit.calculateWitness(input, {logOutput: false});

        const newStAmountSender = w[circuit.getSignalIdx("main.newStAmountSender")];
        const newStAmountReceiver = w[circuit.getSignalIdx("main.newStAmountReceiver")];

        assert(newStAmountSender.equals(15));
        assert(newStAmountReceiver.equals(20));

    });

    it("Should check underflow onChain", async () => {
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

    it("Should check underflow offChain", async () => {
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

    it("Should check overflow onChain - offChain", async () => {
        // Note:
        // - Smart contract filters deposits above 2^128 bits
        // - Circuit reserves 192 bits length for accounts balance
        // - Therefore, 192 - 128 = 64 --> meaning that 2^64 transactions has to be done to get overflow
        // - Economic incentives to not reach 2^64 tx since each deposit has a fee of 0.1 eth
        // - We assume overflow is not feasible
    });

    it("Should check fee operator > fee user ", async () => {
        const input = {
            oldStAmountSender: 10,
            oldStAmountRecieiver: 20,
            amount: 1,
            loadAmount: 0,
            userFee: 2,
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

    it("Should check increment counters offChain", async () => {
        const input = {
            oldStAmountSender: 10,
            oldStAmountRecieiver: 10,
            amount: 1,
            loadAmount: 0,
            userFee: 2,
            operatorFee: 2,
            onChain: 0,
            nop: 0,
            countersIn: 1,
            countersBase: 1
        };

        const w = circuit.calculateWitness(input, {logOutput: false});

        const countersOut = w[circuit.getSignalIdx("main.countersOut")];

        assert(countersOut.equals(2));
    });

    it("Should check increment counters onChain", async () => {
        const input = {
            oldStAmountSender: 10,
            oldStAmountRecieiver: 10,
            amount: 0,
            loadAmount: 3,
            userFee: 2,
            operatorFee: 2,
            onChain: 1,
            nop: 0,
            countersIn: 1,
            countersBase: 1
        };

        const w = circuit.calculateWitness(input, {logOutput: false});

        const countersOut = w[circuit.getSignalIdx("main.countersOut")];

        assert(countersOut.equals(1)); // Should not variate
    });
});
