const chai = require("chai");
const path = require("path");
const snarkjs = require("snarkjs");
const compiler = require("circom");

const assert = chai.assert;

const bigInt = require("snarkjs").bigInt;

describe("FeeSelectorTest test", function () {
    let circuit;

    this.timeout(100000);

    before( async() => {
        const cirDef = await compiler(path.join(__dirname, "circuits", "feeselector_test.circom"));
        circuit = new snarkjs.Circuit(cirDef);
        console.log("NConstrains Decode float: " + circuit.nConstraints);
    });

    it("Should test various test vectors", async () => {
        const testVectors = [
            // Normal situation
            {
                input: {
                    coin: 103,
                    feePlanCoin: [101,102,103,104,105,106,107,108,109,110,111,112,113,114,115,116],
                    feePlanFee: [1001,1002,1003,1004,1005,1006,1007,1008,1009,1010,1011,1012,1013,1014,1015,1016]
                },
                out: {
                    fee: 1003
                }
            },
            // repeated situation
            {
                input: {
                    coin: 103,
                    feePlanCoin: [101,102,103,103,105,106,107,108,109,110,111,112,113,114,115,103],
                    feePlanFee: [1001,1002,1003,1004,1005,1006,1007,1008,1009,1010,1011,1012,1013,1014,1015,1016]
                },
                out: {
                    fee: 1003
                }
            },
            // Not in list situation
            {
                input: {
                    coin: 11,
                    feePlanCoin: [101,102,103,103,105,106,107,108,109,110,111,112,113,114,115,103],
                    feePlanFee: [1001,1002,1003,1004,1005,1006,1007,1008,1009,1010,1011,1012,1013,1014,1015,1016]
                },
                out: {
                    fee: 0
                }
            }
        ];

        for (let i=0; i<testVectors.length; i++) {

            const w = circuit.calculateWitness(testVectors[i].input);

            for (outk in testVectors[i].out) {
                const v = w[circuit.getSignalIdx("main."+outk)];
                assert(v.equals(bigInt(testVectors[i].out[outk])));
            }
        }
    });
});
