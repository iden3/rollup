const path = require("path");
const tester = require("circom").tester;
const babyJub = require("circomlib").babyJub;

describe("Unpack Babyjubjub Ax point", function () {
    let circuit;

    this.timeout(1000000);

    before( async() => {
        circuit = await tester(path.join(__dirname, "circuits", "unpackax_test.circom"), {reduceConstraints:false});
        await circuit.loadConstraints();
        console.log("Constraints `unpackax.circom` circuit: " + circuit.constraints.length + "\n");
    });

    it("Should unpack babyjubjub point", async () => {
        // const privKey = Buffer.alloc(32, 1);
        // const pubKey = eddsa.prv2pub(privKey);
        // console.log("pubKey: ", pubKey);

        console.log("BabyJubJub base point Ax: ", babyJub.Base8[0]);
        console.log("BabyJubJub base point Ay: ", babyJub.Base8[1]);

        const babyAx = babyJub.Base8[0].toString();

        const w = await circuit.calculateWitness({ Ax: babyAx }, {logTrigger:false, logOutput: false, logSet: false});

        // const res = await circuit.getDecoratedOutput(w);
        // console.log(res);

        const checkOut = {
            Ay: babyJub.Base8[1],
        };

        await circuit.assertOut(w, checkOut);
    });
});