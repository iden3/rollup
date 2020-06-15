const path = require("path");
const tester = require("circom").tester;
const babyJub = require("circomlib").babyJub;
const eddsa = require("circomlib").eddsa;
const crypto = require("crypto");

describe("Unpack Babyjubjub Ax point", function () {
    let circuit;

    this.timeout(10000);

    before( async() => {
        circuit = await tester(path.join(__dirname, "circuits-test", "unpackax_test.circom"), {reduceConstraints:false});
        await circuit.loadConstraints();
        console.log("Constraints `unpackax.circom` circuit: " + circuit.constraints.length + "\n");
    });

    it("Should unpack babyjubjub base point", async () => {
        
        const babyAx = babyJub.Base8[0].toString();

        const w = await circuit.calculateWitness({ Ax: babyAx }, {logTrigger:false, logOutput: false, logSet: false});

        const checkOut = {
            Ay: babyJub.Base8[1],
        };

        await circuit.assertOut(w, checkOut);
    });

    it("Should unpack babyjubjub random points", async () => {
        
        const rounds = 25;

        for (let i = 0; i < rounds; i++){
            const privKey = crypto.randomBytes(32);
            const pubKey = eddsa.prv2pub(privKey);

            const Ax = pubKey[0];
            const Ay = pubKey[1];

            const w = await circuit.calculateWitness({ Ax: Ax }, {logTrigger:false, logOutput: false, logSet: false});

            const checkOut = {
                Ay: Ay,
            };

            await circuit.assertOut(w, checkOut);
        }
    });
});