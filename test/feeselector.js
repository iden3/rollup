const chai = require("chai");
const path = require("path");
const bigInt = require("big-integer");
const tester = require("circom").tester;

const assert = chai.assert;

describe("FeeSelectorTest test", function () {
    let circuit;

    this.timeout(100000);

    before( async() => {
        circuit = await tester(path.join(__dirname, "circuits", "feeselector_test.circom"));
    });

    it("Should test various test vectors", async () => {
        const testVectors = [
            // Normal situation
            {
                input: {
                    step: 0,
                    coin: 103,
                    feePlanCoin: [101,102,103,104,105,106,107,108,109,110,111,112,113,114,115,116],
                    feePlanFee: [1001,1002,1003,1004,1005,1006,1007,1008,1009,1010,1011,1012,1013,1014,1015,1016]
                },
                out: {
                    operatorFee: 1003
                }
            },
            // repeated situation
            {
                input: {
                    step: 0,
                    coin: 103,
                    feePlanCoin: [101,102,103,103,105,106,107,108,109,110,111,112,113,114,115,103],
                    feePlanFee: [1001,1002,1003,1004,1005,1006,1007,1008,1009,1010,1011,1012,1013,1014,1015,1016]
                },
                out: {
                    operatorFee: 1003
                }
            },
            // Not in list situation
            {
                input: {
                    step: 0,
                    coin: 11,
                    feePlanCoin: [101,102,103,103,105,106,107,108,109,110,111,112,113,114,115,103],
                    feePlanFee: [1001,1002,1003,1004,1005,1006,1007,1008,1009,1010,1011,1012,1013,1014,1015,1016]
                },
                out: {
                    operatorFee: 0
                }
            },
            // Not step1
            {
                input: {
                    step: 1,
                    coin: 103,
                    feePlanCoin: [101,102,103,103,105,106,107,108,109,110,111,112,113,114,115,103],
                    feePlanFee: [1001,1002,1003,1004,1005,1006,1007,1008,1009,1010,1011,1012,1013,1014,1015,1016]
                },
                out: {
                    operatorFee: 1004
                }
            },
            {
                input: {
                    step: 1,
                    coin: 115,
                    feePlanCoin: [101,102,103,103,105,106,107,108,109,110,111,112,113,114,115,103],
                    feePlanFee: [1001,1002,1003,1004,1005,1006,1007,1008,1009,1010,1011,1012,1013,1014,1015,1016]
                },
                out: {
                    operatorFee: 0
                }
            },
            {
                input: {
                    step: 2,
                    coin: 103,
                    feePlanCoin: [101,102,103,103,105,106,107,108,109,110,111,112,113,114,115,103],
                    feePlanFee: [1001,1002,1003,1004,1005,1006,1007,1008,1009,1010,1011,1012,1013,1014,1015,1016]
                },
                out: {
                    operatorFee: 1016
                }
            },
            {
                input: {
                    step: 3,
                    coin: 103,
                    feePlanCoin: [101,102,103,103,105,106,107,108,109,110,111,112,113,114,115,103],
                    feePlanFee: [1001,1002,1003,1004,1005,1006,1007,1008,1009,1010,1011,1012,1013,1014,1015,1016]
                },
                out: {
                    operatorFee: 0
                }
            },
            {
                input: {
                    step: 4,
                    coin: 103,
                    feePlanCoin: [101,102,103,103,105,106,107,108,109,110,111,112,113,114,115,103],
                    feePlanFee: [1001,1002,1003,1004,1005,1006,1007,1008,1009,1010,1011,1012,1013,1014,1015,1016]
                },
                out: {
                    operatorFee: 0
                }
            }


        ];

        for (let i=0; i<testVectors.length; i++) {

            const w = await circuit.calculateWitness(testVectors[i].input);

            await circuit.assertOut(w, testVectors[i].out);
        }
    });
});
