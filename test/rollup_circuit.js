const chai = require("chai");
const path = require("path");
const snarkjs = require("snarkjs");
const compiler = require("circom");
const utils = require("../js/utils");
const bigInt = require("snarkjs").bigInt;

const assert = chai.assert;



describe("Rollup run 4 null TX", function () {
    let circuit;

    this.timeout(100000);

    before( async() => {
        const cirDef = await compiler(path.join(__dirname, "circuits", "rollup_test.circom"), {reduceConstraints:false});
        circuit = new snarkjs.Circuit(cirDef);
        console.log("NConstrains Rollup: " + circuit.nConstraints);
    });

    it("Should create 4 empty TXs", async () => {
        const input = {

            oldStRoot: 0,
            onChainHash: 0,
            offChainHash: 0,
            feePlanCoins: 0,
            feePlanFees: 0,
            txData: [],
            rqTxHash: [],
            s: [],
            r8x: [],
            r8y: [],
            loadAmount: [],
            ethAddr: [],
            ax: [],
            ay: [],

            ax1: [],
            ay1: [],
            amount1: [],
            nonce1: [],
            ethAddr1: [],
            siblings1: [],
            isOld0_1: [],
            oldKey1: [],
            oldValue1: [],

            ax2: [],
            ay2: [],
            amount2: [],
            nonce2: [],
            ethAddr2: [],
            siblings2: [],
            isOld0_2: [],
            oldKey2: [],
            oldValue2: [],
        };

        for (let i=0; i<4; i++) {
            input.txData[i] = utils.buildTxData({
                fromIdx: 0,
                toIdx: 0,
                amount: 0,
                coin: 0,
                nonce: 0,
                maxFee: 0,
                rqOffset: 0,
                inChain: 0,
                newAccount: 0
            });
            input.rqTxHash[i]= 0;
            input.s[i]= 0;
            input.r8x[i]= 0;
            input.r8y[i]= 0;
            input.loadAmount[i]= 0;
            input.ethAddr[i]= 0;
            input.ax[i]= 0;
            input.ay[i]= 0;

            // State 1
            input.ax1[i]= 0;
            input.ay1[i]= 0;
            input.amount1[i]= 0;
            input.nonce1[i]= 0;
            input.ethAddr1[i]= 0;
            input.siblings1[i] = [];
            for (let j=0; j<8; j++) {
                input.siblings1[i][j]= 0;
            }
            input.isOld0_1[i]= 0;
            input.oldKey1[i]= 0;
            input.oldValue1[i]= 0;

            // State 1
            input.ax2[i]= 0;
            input.ay2[i]= 0;
            input.amount2[i]= 0;
            input.nonce2[i]= 0;
            input.ethAddr2[i]= 0;
            input.siblings2[i] = [];
            for (let j=0; j<8; j++) {
                input.siblings2[i][j]= 0;
            }
            input.isOld0_2[i]= 0;
            input.oldKey2[i]= 0;
            input.oldValue2[i]= 0;
        }

        const w = circuit.calculateWitness(input, {logTrigger:false, logOutput: false, logSet: false});

        const v = w[circuit.getSignalIdx("main.newStRoot")];

        assert(v.isZero());
    });
});
