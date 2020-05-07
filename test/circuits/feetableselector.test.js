const path = require("path");
const tester = require("circom").tester;

const Constants = require("../../js/constants");

describe("Fee table selector circuit", function () {
    let circuit;

    before( async() => {
        circuit = await tester(path.join(__dirname, "circuits-test", "feetableselector_test.circom"));
        await circuit.loadConstraints();
        console.log("Constraints `feetableselector.circom` circuit: " + circuit.constraints.length + "\n");
    });

    it("Should test fee table", async () => {
        const { tableFeeInv } = Constants;
        const input = {};
        const output = {};

        for (let i = 0; i < tableFeeInv.length; i ++){
            input.feeSel = i;

            output.feeOut = tableFeeInv[i];

            const w = await circuit.calculateWitness(input);
            await circuit.assertOut(w, output);
        }
    });
});
