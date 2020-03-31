const path = require("path");
const compiler = require("circom");
const snarkjs = require("snarkjs");
const babyJub = require("circomlib").babyJub;

describe("Unpack Babyjubjub Ax point", function () {
    let circuit;

    this.timeout(1000000);

    before( async() => {
        const cirDef = await compiler(path.join(__dirname, "circuits", "unpackax_test.circom"), {reduceConstraints:false});
        // const cirDef = JSON.parse(fs.readFileSync(path.join(__dirname, "circuits", "circuit.json"), "utf8"));
        // circuit = new snarkjs.Circuit(cirDef);
        circuit = new snarkjs.Circuit(cirDef);
        console.log("NConstrains unpack point: " + circuit.nConstraints);
    });

    it("Should unpack babyjubjub point", async () => {
        // const privKey = Buffer.alloc(32, 1);

        // const pubKey = eddsa.prv2pub(privKey);
        // console.log("pubKey: ", pubKey);

        console.log("BabyJubJub base point Ax: ", babyJub.Base8[0]);
        console.log("BabyJubJub base point Ay: ", babyJub.Base8[1]);

        const babyAx = babyJub.Base8[0].toString();

        const w = await circuit.calculateWitness({ Ax: babyAx }, {logTrigger:false, logOutput: false, logSet: false});

        const Ay = w[circuit.getSignalIdx("main.Ay")];

        console.log(Ay);
    });
});