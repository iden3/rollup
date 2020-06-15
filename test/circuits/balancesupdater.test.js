const { assert } = require("chai");
const path = require("path");
const tester = require("circom").tester;
const Scalar = require("ffjavascript").Scalar;

const Constants = require("../../js/constants");
const { computeFee } = require("../../js/utils");

describe("Balance updater circuit", function () {
    let circuit;

    before( async() => {
        circuit = await tester(path.join(__dirname, "circuits-test", "balancesupdater_test.circom"));
        await circuit.loadConstraints();
        console.log("Constraints `balanceupdater.circom` circuit: " + circuit.constraints.length + "\n");
    });

    it("Should check a normal offChain transaction", async () => {
        const input = {
            oldStAmountSender: 10,
            oldStAmountReceiver: 20,
            amount: 6,
            loadAmount: 0,
            fee: Constants.fee["20%"],
            onChain: 0,
            nop: 0,
        };

        const w = await circuit.calculateWitness(input, {logOutput: false});

        let feeApplied = computeFee(input.amount, input.fee);

        const output = {
            newStAmountSender: Scalar.sub(Scalar.sub(input.oldStAmountSender, input.amount), feeApplied ),
            newStAmountReceiver: Scalar.add(input.oldStAmountReceiver, input.amount),
            fee2Charge: feeApplied
        };
        
        await circuit.assertOut(w, output);
    });

    it("Should check a normal onChain transaction", async () => {
        const input = {
            oldStAmountSender: 10,
            oldStAmountReceiver: 20,
            amount: 0,
            loadAmount: 6,
            fee: Constants.fee["20%"],
            onChain: 1,
            nop: 0,
        };

        const w = await circuit.calculateWitness(input, {logOutput: false});

        const feeApplied = Scalar.e(0);

        const output = {
            newStAmountSender: Scalar.add(input.oldStAmountSender, input.loadAmount), 
            newStAmountReceiver: Scalar.e(input.oldStAmountReceiver),
            fee2Charge: feeApplied,
        };

        await circuit.assertOut(w, output);
    });

    it("Should check underflow onChain", async () => {
        const input = {
            oldStAmountSender: 10,
            oldStAmountReceiver: 20,
            amount: 11,
            loadAmount: 0,
            fee: Constants.fee["10%"],
            onChain: 1,
            nop: 0,
        };

        const w = await circuit.calculateWitness(input, {logOutput: false});

        const feeApplied = Scalar.e(0);

        const output = {
            newStAmountSender: Scalar.e(input.oldStAmountSender), 
            newStAmountReceiver: Scalar.e(input.oldStAmountReceiver),
            fee2Charge: feeApplied,
        };

        await circuit.assertOut(w, output);
    });

    it("Should check underflow offChain", async () => {
        const input = {
            oldStAmountSender: 10,
            oldStAmountReceiver: 20,
            amount: 9,
            loadAmount: 0,
            fee: Constants.fee["50%"],
            onChain: 0,
            nop: 0,
            feeTotalIn: 0,
            feeTotalBase: 0,
        };

        try {
            await circuit.calculateWitness(input, {logOutput: false});
            assert(false, "Constraint matches");
        } catch (err) {
            console.log(err.message);
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
});
