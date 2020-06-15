const path = require("path");
const tester = require("circom").tester;
const Scalar = require("ffjavascript").Scalar;

const { fix2float } = require("../../js/utils");

describe("Check fess circuit test", function () {
    this.timeout(5000);
    let circuit;
    let accFees;
    let feeTotal;
    let feeTotalInput;
    
    before( async() => {
        circuit = await tester(path.join(__dirname, "circuits-test", "checkfees_test.circom"));
        await circuit.loadConstraints();
        console.log("Constraints `checkfees.circom` circuit: " + circuit.constraints.length + "\n");
    });

    it("Should test check fee values ok ", async () => {
        accFees = new Array(16).fill(0);
        feeTotal = new Array(16).fill(0);

        for (let i = 0; i < feeTotal.length - 1; i++){
            accFees[i] = Scalar.e(i);
            feeTotal[i] = Scalar.e(fix2float(i));
        }

        // feeTotalInpiut
        feeTotalInput = Scalar.e(0);
        for (let i = 0; i < accFees.length; i++) {
            feeTotalInput = Scalar.add(feeTotalInput, Scalar.shl(Scalar.e(feeTotal[i]), 16*i));
        }

        const input = {
            accFee: accFees,
            feeTotals: feeTotalInput,
        };

        const w = await circuit.calculateWitness(input);

        await circuit.assertOut(w, {feeTotalOk: 1});
    });

    it("Should test check fee values ko", async () => {
        // Modify input to try to get more fees than accumulated
        feeTotal[7] = Scalar.add(feeTotal[7], 1);

        // Re-calculate feeTotals
        // feeTotalInpiut
        feeTotalInput = Scalar.e(0);
        for (let i = 0; i < accFees.length; i++) {
            feeTotalInput = Scalar.add(feeTotalInput, Scalar.shl(Scalar.e(feeTotal[i]), 16*i));
        }

        const input = {
            accFee: accFees,
            feeTotals: feeTotalInput,
        };

        const w = await circuit.calculateWitness(input);

        await circuit.assertOut(w, {feeTotalOk: 0});
    });
});
