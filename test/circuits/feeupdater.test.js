const path = require("path");
const tester = require("circom").tester;

describe("Fee updater circuit", function () {
    let circuit;

    before( async() => {
        circuit = await tester(path.join(__dirname, "circuits-test", "feeupdater_test.circom"));
        await circuit.loadConstraints();
        console.log("Constraints `feeupdater.circom` circuit: " + circuit.constraints.length + "\n");
    });

    it("Should update fees", async () => {
        const testVectors = [
            // Normal situation
            {
                input: {
                    coin: 110,
                    fee2Charge: 1000,
                    feePlanCoin: [101,102,103,104,105,106,107,108,109,110,111,112,113,114,115,116],
                    accFeeIn: [1001,1002,1003,1004,1005,1006,1007,1008,1009,1010,1011,1012,1013,1014,1015,1016]
                },
                out: {
                    accFeeOut: [1001,1002,1003,1004,1005,1006,1007,1008,1009,2010,1011,1012,1013,1014,1015,1016]
                }
            },
            // repeated situation
            {
                input: {
                    coin: 103,
                    fee2Charge: 1000,
                    feePlanCoin: [101,102,103,103,105,106,107,108,109,110,111,112,113,114,115,103],
                    accFeeIn: [1001,1002,1003,1004,1005,1006,1007,1008,1009,1010,1011,1012,1013,1014,1015,1016]
                },
                out: {
                    accFeeOut: [1001,1002,2003,1004,1005,1006,1007,1008,1009,1010,1011,1012,1013,1014,1015,1016]
                }
            },
            // Not in list situation
            {
                input: {
                    coin: 0,
                    fee2Charge: 1000,
                    feePlanCoin: [101,102,103,103,105,106,107,108,109,110,111,112,113,114,115,103],
                    accFeeIn: [1001,1002,1003,1004,1005,1006,1007,1008,1009,1010,1011,1012,1013,1014,1015,1016]
                },
                out: {
                    accFeeOut: [1001,1002,1003,1004,1005,1006,1007,1008,1009,1010,1011,1012,1013,1014,1015,1016]
                }
            },
            // No fee to update
            {
                input: {
                    coin: 111,
                    fee2Charge: 0,
                    feePlanCoin: [101,102,103,103,105,106,107,108,109,110,111,112,113,114,115,103],
                    accFeeIn: [1001,1002,1003,1004,1005,1006,1007,1008,1009,1010,1011,1012,1013,1014,1015,1016]
                },
                out: {
                    accFeeIn: [1001,1002,1003,1004,1005,1006,1007,1008,1009,1010,1011,1012,1013,1014,1015,1016]
                }
            },
            // Empty fee plan coin
            {
                input: {
                    coin: 0,
                    fee2Charge: 0,
                    feePlanCoin: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
                    accFeeIn: [1001,1002,1003,1004,1005,1006,1007,1008,1009,1010,1011,1012,1013,1014,1015,1016]
                },
                out: {
                    accFeeOut: [1001,1002,1003,1004,1005,1006,1007,1008,1009,1010,1011,1012,1013,1014,1015,1016]
                }
            },
            // Update coin 0 in a half empty fee plan coin
            {
                input: {
                    coin: 0,
                    fee2Charge: 3000,
                    feePlanCoin: [5,4,3,2,1,0,6,7,8,0,0,0,0,0,0,0],
                    accFeeIn: [1001,1002,1003,1004,1005,1006,1007,1008,1009,1010,1011,1012,1013,1014,1015,1016]
                },
                out: {
                    accFeeOut: [1001,1002,1003,1004,1005,4006,1007,1008,1009,1010,1011,1012,1013,1014,1015,1016]
                }
            },
            // Update coin 0, being the only coin defined in the fee plan coin
            {
                input: {
                    coin: 0,
                    fee2Charge: 1000,
                    feePlanCoin: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
                    accFeeIn: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
                },
                out: {
                    accFeeOut: [1000,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
                }
            }           
        ];

        for (let i = 0; i < testVectors.length; i++) {
            const w = await circuit.calculateWitness(testVectors[i].input);
            await circuit.assertOut(w, testVectors[i].out);
        }

    });
});