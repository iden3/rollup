const chai = require("chai");
const path = require("path");
const tester = require("circom").tester;

const assert = chai.assert;

describe("Balance updater test", function () {
    let circuit;

    this.timeout(100000);

    before( async() => {
        circuit = await tester(path.join(__dirname, "circuits", "balancesupdater_test.circom"));
        await circuit.loadConstraints();
        console.log("Constraints `balanceupdater.circom` circuit: " + circuit.constraints.length + "\n");
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

        const w = await circuit.calculateWitness(input, {logOutput: false});

        await circuit.assertOut(w, {newStAmountSender: 3, newStAmountReceiver: 25});
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

        const w = await circuit.calculateWitness(input, {logOutput: false});

        await circuit.assertOut(w, {newStAmountSender: 15, newStAmountReceiver: 20});
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

        const w = await circuit.calculateWitness(input, {logOutput: false});

        await circuit.assertOut(w, {newStAmountSender: 10, newStAmountReceiver: 20});
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
            await circuit.calculateWitness(input, {logOutput: false});
            assert(false, "Constraint matches");
        } catch (err) {
            assert.equal(err.message.includes("Constraint doesn't match"), true);
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
            await circuit.calculateWitness(input, {logOutput: false});
            assert(false, "Constraint matches");
        } catch (err) {
            assert.equal(err.message.includes("Constraint doesn't match"), true);
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

        const w = await circuit.calculateWitness(input, {logOutput: false});

        await circuit.assertOut(w, {countersOut: 2});
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

        const w = await circuit.calculateWitness(input, {logOutput: false});

        await circuit.assertOut(w, {countersOut: 1});
    });
});
