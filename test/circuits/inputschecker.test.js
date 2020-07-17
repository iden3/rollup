const { expect } = require("chai");
const path = require("path");
const tester = require("circom").tester;
const crypto = require("crypto");
const Scalar = require("ffjavascript").Scalar;
const utils = require("../../js/utils");

describe("Test inputs checker", function () {
    let circuit;

    this.timeout(0);

    function computeHashInput(arrayInputs){
        const nInputs = arrayInputs.length;

        let finalStr = "";

        for (let i = 0; i < nInputs; i++){
            let tmp = Scalar.e(arrayInputs[i]);

            finalStr = finalStr +  utils.padZeros(tmp.toString("16"), 256 / 4);
        }

        const r = Scalar.e("21888242871839275222246405745257275088548364400416034343698204186575808495617");
        const hash = crypto.createHash("sha256")
            .update(finalStr, "hex")
            .digest("hex");
        const h = Scalar.mod(Scalar.fromString(hash, 16), r);

        return h;
    }

    before( async() => {
        circuit = await tester(path.join(__dirname, "circuits-test", "inputschecker_test.circom"), {reduceConstraints:false});
        await circuit.loadConstraints();
        console.log("Constraints `inputschecker.circom` circuit: " + circuit.constraints.length + "\n");

        // const testerAux = require("circom").testerAux;
        // const pathTmp = "/tmp/circom_23224tUX0uESB5UO2";
        // circuit = await testerAux(pathTmp, path.join(__dirname, "circuits", "inputschecker_test.circom"));
    });

    it("Should chack input hash", async () => {
        const inputs = [];

        inputs.push(Scalar.e(1));
        inputs.push(Scalar.shl(1, 253));
        inputs.push(Scalar.e("21888242871839275222246405745257275088548364400416034343698204186575808495617"));
        inputs.push(Scalar.shl(2349873587435698, 32));
        inputs.push(Scalar.e(0));

        const hash = computeHashInput(inputs);

        const inputCircuit = { 
            inputs,
            hash
        };

        try {
            await circuit.calculateWitness(inputCircuit, {logTrigger: false, logOutput: false, logSet: false});
            expect(true).to.be.equal(true);
        } catch (error) {
            expect(true).to.be.equal(false);
        }
    });
});