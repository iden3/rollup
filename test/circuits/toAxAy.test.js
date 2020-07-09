const path = require("path");
const tester = require("circom").tester;
const babyJub = require("circomlib").babyJub;
const eddsa = require("circomlib").eddsa;
const crypto = require("crypto");
const { Scalar, utils } = require("ffjavascript");

describe("Test", function () {
    let circuit;

    this.timeout(10000);

    function buildInputs(ax, ay){
        const ethAddress = "0x1234567891234567891234567891234567891234";

        // build element 2
        const compressedBuff = babyJub.packPoint([Scalar.fromString(ax), Scalar.fromString(ay)]);
        const sign = (compressedBuff[31] & 0x80) ? true : false;
        compressedBuff[31] = compressedBuff[31] & 0x7F;

        let element2 = Scalar.e(0);
        element2 = Scalar.add(element2, ethAddress);
        element2 = Scalar.add(element2, Scalar.shl(sign, 160));

        let element1 = utils.leBuff2int(compressedBuff);

        return {compressedPoint: element1, element2};
    }


    before( async() => {
        circuit = await tester(path.join(__dirname, "circuits-test", "toAxAy_test.circom"), {reduceConstraints:false});
        await circuit.loadConstraints();
        console.log("Constraints `unpackax.circom` circuit: " + circuit.constraints.length + "\n");
    });

    it("Should unpack babyjubjub base point", async () => {

        const babyAx = babyJub.Base8[0].toString();
        const babyAy = babyJub.Base8[1].toString();

        const input = buildInputs(babyAx, babyAy);
        
        const w = await circuit.calculateWitness(input, {logTrigger:false, logOutput: false, logSet: false});

        const checkOut = {
            ax: babyAx,
            ay: babyAy,
        };

        await circuit.assertOut(w, checkOut);
    });

    it("Should unpack babyjubjub random points", async () => {

        const rounds = 25;

        for (let i = 0; i < rounds; i++){
            const privKey = crypto.randomBytes(32);
            const pubKey = eddsa.prv2pub(privKey);

            const ax = pubKey[0];
            const ay = pubKey[1];

            const input = buildInputs(ax, ay);
            
            const w = await circuit.calculateWitness(input, {logTrigger:false, logOutput: false, logSet: false});
    
            const checkOut = {
                ax,
                ay,
            };
    
            await circuit.assertOut(w, checkOut);
        }
    });
});