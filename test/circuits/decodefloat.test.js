const { assert } = require("chai");
const path = require("path");
const tester = require("circom").tester;
const Scalar = require("ffjavascript").Scalar;

const utils = require("../../js/utils");

describe("Decode float test", function () {
    let circuit;

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
        circuit = await tester(path.join(__dirname, "circuits-test", "decodefloat_test.circom"));
        await circuit.loadConstraints();
        console.log("Constraints `decodefloat.circom` circuit: " + circuit.constraints.length + "\n");
    });

    it("Should test utils", async () => {
        for (let i=0; i<testVector.length; i++) {
            // console.log(testVector[i][0]);
            const fx = utils.float2fix(testVector[i][0]);
            assert.equal(fx.toString() , testVector[i][1]);

            const fl = utils.fix2float(Scalar.e(testVector[i][1]));
            const fx2 = utils.float2fix(fl);
            assert.equal(fx2.toString() , testVector[i][1]);
        }
    });

    it("Should test various test vectors", async () => {
        for (let i=0; i<testVector.length; i++) {
            const w = await circuit.calculateWitness({in: testVector[i][0]});
            
            await circuit.assertOut(w, {out: testVector[i][1]});
        }
    });
});
