const path = require("path");
const tester = require("circom").tester;
const babyJub = require("circomlib").babyJub;
const eddsa = require("circomlib").eddsa;
const crypto = require("crypto");
const { Scalar, utils } = require("ffjavascript");

describe("Test", function () {
    let circuit;

    this.timeout(10000);

    before( async() => {
        circuit = await tester(path.join(__dirname, "circuits-test", "test_test.circom"), {reduceConstraints:false});
        await circuit.loadConstraints();
        console.log("Constraints `unpackax.circom` circuit: " + circuit.constraints.length + "\n");
    });

    it("Should unpack babyjubjub base point", async () => {

        const babyAx = babyJub.Base8[0].toString();
        const babyAy = babyJub.Base8[1].toString();

        console.log(babyAx);
        console.log(babyAy);

        const ethAddress = "0x1234567891234567891234567891234567891234";

        // build element 2
        const compressedBuff = babyJub.packPoint([Scalar.fromString(babyAx), Scalar.fromString(babyAy)]);
        const sign = (compressedBuff[31] & 0x80) ? true : false;
        compressedBuff[31] = compressedBuff[31] & 0x7F;

        let element2 = Scalar.e(0);
        element2 = Scalar.add(element2, ethAddress);
        element2 = Scalar.add(element2, Scalar.shl(sign, 160));

        let element1 = utils.leBuff2int(compressedBuff);

        const input = {
            compressedPoint: element1,
            element2
        }
        
        const w = await circuit.calculateWitness(input, {logTrigger:false, logOutput: false, logSet: false});

        const ax = await circuit.getSignal(w, "main.ax");
        const ay = await circuit.getSignal(w, "main.ay");

        console.log(ax);
        console.log(ay);
        // const checkOut = {
        //     Ay: babyJub.Base8[1],
        // };

        // await circuit.assertOut(w, checkOut);
    });

    // it("Should unpack babyjubjub random points", async () => {
        
    //     const rounds = 25;

    //     for (let i = 0; i < rounds; i++){
    //         const privKey = crypto.randomBytes(32);
    //         const pubKey = eddsa.prv2pub(privKey);

    //         const Ax = pubKey[0];
    //         const Ay = pubKey[1];

    //         const w = await circuit.calculateWitness({ Ax: Ax }, {logTrigger:false, logOutput: false, logSet: false});

    //         const checkOut = {
    //             Ay: Ay,
    //         };

    //         await circuit.assertOut(w, checkOut);
    //     }
    // });
});