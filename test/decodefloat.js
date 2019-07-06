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
        const cirDef = await compiler(path.join(__dirname, "circuits", "decodefloat_test.circom"));
        circuit = new snarkjs.Circuit(cirDef);
        console.log("NConstrains Decode float: " + circuit.nConstraints);
    });

    it("Should test various test vectors", async () => {
        const testVector = [
            [0x30F6, "123000000"],
            [0x1B8D, "454500"],
            [0xFFFF, "10235000000000000000000000000000000"],
            [0x0000, "0"],
            [0x0001, "0"],
            [0x0002, "1"],
            [0x0003, "1"],
            [0x0800, "0"],
            [0x0801, "5"],
            [0x0802, "10"],
            [0x0803, "15"],
        ];

        for (let i=0; i<testVector.length; i++) {

            const w = circuit.calculateWitness({in: testVector[i][0]});

            const out = w[circuit.getSignalIdx("main.out")];

            console.log(out);
            assert(out.equals(bigInt(testVector[i][1])));
        }
    });

});
