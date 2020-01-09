const chai = require("chai");
const path = require("path");
const snarkjs = require("snarkjs");
const compiler = require("circom");
const utils = require("../js/utils");

const assert = chai.assert;

const bigInt = require("snarkjs").bigInt;

describe("Decode float test", function () {
    let circuit;

    this.timeout(100000);

    const testVector = [
        [0x307B, "123000000"],
        [0x1DC6, "454500"],
        [0xFFFF, "10235000000000000000000000000000000"],
        [0x0000, "0"],
        [0x0400, "0"],
        [0x0001, "1"],
        [0x0401, "1"],
        [0x0800, "0"],
        [0x0c00, "5"],
        [0x0801, "10"],
        [0x0c01, "15"],
    ];

    before( async() => {
        const cirDef = await compiler(path.join(__dirname, "circuits", "decodefloat_test.circom"));
        circuit = new snarkjs.Circuit(cirDef);
        console.log("NConstrains Decode float: " + circuit.nConstraints);
    });

    it("Should test utils", async () => {
        for (let i=0; i<testVector.length; i++) {
            // console.log(testVector[i][0]);
            const fx = utils.float2fix(testVector[i][0]);
            assert.equal(fx.toString() , testVector[i][1]);

            const fl = utils.fix2float(bigInt(testVector[i][1]));
            const fx2 = utils.float2fix(fl);
            assert.equal(fx2.toString() , testVector[i][1]);
        }
    });

    it("Should test various test vectors", async () => {

        for (let i=0; i<testVector.length; i++) {

            const w = circuit.calculateWitness({in: testVector[i][0]});
            const out = w[circuit.getSignalIdx("main.out")];
            // console.log(out);
            assert(out.equals(bigInt(testVector[i][1])));
        }
    });
});
