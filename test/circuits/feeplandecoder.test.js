const path = require("path");
const tester = require("circom").tester;
const Scalar = require("ffjavascript").Scalar;

describe("Fee plan decdoer circuit", function () {
    let circuit;

    before( async() => {
        circuit = await tester(path.join(__dirname, "circuits-test", "feeplandecoder_test.circom"));
        await circuit.loadConstraints();
        console.log("Constraints `feeplandecoder.circom` circuit: " + circuit.constraints.length + "\n");
    });

    it("Should test fee plan decoder circuit", async () => {
        const feePlanCoins = new Array(16).fill(0);

        for (let i = 0; i < feePlanCoins.length - 1; i++){
            feePlanCoins[i] = Scalar.e(i);
        }

        let coinsInput = Scalar.e(0);
        for (let i = 0; i < feePlanCoins.length; i++) {
            coinsInput = Scalar.add(coinsInput, Scalar.shl(Scalar.e(feePlanCoins[i]), 16*i));
        }

        const input = {
            feePlanCoins: coinsInput,
        };

        const w = await circuit.calculateWitness(input);

        const output = {
            feePlanCoin: feePlanCoins,
        };

        await circuit.assertOut(w, output);
    });
});