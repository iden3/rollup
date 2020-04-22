const { assert, expect } = require("chai");
const Scalar = require("ffjavascript").Scalar;

const utils = require("../../js/utils");
const { exitAx, exitAy, exitEthAddr} = require("../../js/constants");

describe("Utils", function () {

    it("Half precision floating point number", async () => {
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

        for (let i=0; i<testVector.length; i++) {
            // console.log(testVector[i][0]);
            const fx = utils.float2fix(testVector[i][0]);
            assert.equal(fx.toString() , testVector[i][1]);

            const fl = utils.fix2float(Scalar.e(testVector[i][1]));
            const fx2 = utils.float2fix(fl);
            assert.equal(fx2.toString() , testVector[i][1]);
        }
    });

    it("Transaction data", async () => {
        const tx = {
            amount: 24,
            coin: 4,
            nonce: 24,
            userFee: 12,
            rqOffset: 3,
            onChain: true,
            newAccount: true,
        };

        const txData = `0x${utils.buildTxData(tx).toString(16)}`;
        const txDataDecoded = utils.decodeTxData(txData);

        expect(Scalar.eq(tx.amount, txDataDecoded.amount)).to.be.equal(true);
        expect(Scalar.eq(tx.coin, txDataDecoded.coin)).to.be.equal(true);
        expect(Scalar.eq(tx.nonce, txDataDecoded.nonce)).to.be.equal(true);
        expect(Scalar.eq(tx.userFee, txDataDecoded.userFee)).to.be.equal(true);
        expect(Scalar.eq(tx.rqOffset, txDataDecoded.rqOffset)).to.be.equal(true);
        expect(Scalar.eq(tx.onChain, txDataDecoded.onChain)).to.be.equal(true);
        expect(Scalar.eq(tx.newAccount, txDataDecoded.newAccount)).to.be.equal(true);
    });

    it("Transaction round values", async () => {
        const testVector = [
            [0x307B, "123000000"],
            [0x1DC6, "454500"],
        ];
        
        const tx = {
            amount: testVector[0][1],
            userFee: testVector[1][1],
        };

        utils.txRoundValues(tx);

        expect(Scalar.eq(testVector[0][0], tx.amountF)).to.be.equal(true);
        expect(Scalar.eq(testVector[1][0], tx.userFeeF)).to.be.equal(true);

        expect(Scalar.eq(testVector[0][1], tx.amount)).to.be.equal(true);
        expect(Scalar.eq(testVector[1][1], tx.userFee)).to.be.equal(true);
    });

    it("Leaf state from / to array", async () => {
        const state = {
            coin: 1,
            nonce: 49,
            amount: Scalar.e(12343256),
            ax: "1676a120dec6e3d678a947bc34003456ed46077efe7314d38a7db9b5c03a9446",
            ay: "144e7e10fd47e0c67a733643b760e80ed399f70e78ae97620dbb719579cd645d",
            ethAddress: "0x7e5f4552091a69125d5dfcb7b8c2659029395bdf",
        };

        const stateArray = utils.state2array(state);
        const stateDecoded = utils.array2state(stateArray);

        expect(Scalar.eq(state.coin, stateDecoded.coin)).to.be.equal(true);
        expect(Scalar.eq(state.nonce, stateDecoded.nonce)).to.be.equal(true);
        expect(Scalar.eq(state.amount, stateDecoded.amount)).to.be.equal(true);
        expect(state.ax).to.be.equal(stateDecoded.ax);
        expect(state.ay).to.be.equal(stateDecoded.ay);
        expect(state.ethAddress).to.be.equal(stateDecoded.ethAddress);
    });

    it("Hash state", async () => {
        const hashState = "16942412014074308762410930645277865393313803681499377774858238218242528949847";
        
        const state = {
            coin: 1,
            nonce: 49,
            amount: Scalar.e(12343256),
            ax: "1676a120dec6e3d678a947bc34003456ed46077efe7314d38a7db9b5c03a9446",
            ay: "144e7e10fd47e0c67a733643b760e80ed399f70e78ae97620dbb719579cd645d",
            ethAddress: "0x7e5f4552091a69125d5dfcb7b8c2659029395bdf",
        };

        const hash = utils.hashState(state);
        
        expect(Scalar.eq(hash, hashState)).to.be.equal(true);
    });

    it("Verify transaction signed", async () => { 
        
        const tx = { 
            toAx: "1bfe0e9f372206b8b826a05fe8727d3fefdd5150d5b4379c5660dd04923338c4",
            toAy: "14902884d8d2fa42b287721d9ddc2d891bad72475c7aaf7ea41206161a127752",
            toEthAddr: "0x2b5ad5c4795c026514f8317c7a215e218dccd6cf",
            coin: 0,
            amount: 500,
            nonce: 0,
            userFee: 100,
            r8x: "770591572776893072560329255187340888258936546349417314856384396374667363890",
            r8y: "962686632833179341069561379306513064401103432079312175650332281958115485290",
            s: "356195177343820326086198566657583616848421081213756974140987858209661398985",
            fromAx: "144e7e10fd47e0c67a733643b760e80ed399f70e78ae97620dbb719579cd645d",
            fromAy: "1676a120dec6e3d678a947bc34003456ed46077efe7314d38a7db9b5c03a9446",
            fromEthAddr: "0x7e5f4552091a69125d5dfcb7b8c2659029395bdf" 
        };

        const res = utils.verifyTxSig(tx);

        expect(res).to.be.equal(true);
    });

    it("Hash Idx", async () => { 
        
        const hashIdxRes = "20820825084977233222284801912251772945505687930282524287625637692429191024649";

        const tx = {
            coin: 1,
            fromAx: "144e7e10fd47e0c67a733643b760e80ed399f70e78ae97620dbb719579cd645d",
            fromAy: "1676a120dec6e3d678a947bc34003456ed46077efe7314d38a7db9b5c03a9446",
        };

        const hashIdx = utils.hashIdx(tx.coin, tx.fromAx, tx.fromAy);
        
        expect(Scalar.eq(hashIdx, hashIdxRes)).to.be.equal(true);
    });

    it("Is string hexadecimal", async () => { 
        const num = 4;
        const strNoHex = "4";
        const strHex = "0x4";

        expect(utils.isStrHex(num)).to.be.equal(false);
        expect(utils.isStrHex(strNoHex)).to.be.equal(false);
        expect(utils.isStrHex(strHex)).to.be.equal(true);
    });

    it("Encode Deposi tOffchain", async () => { 

        const fromAx = Scalar.e(30890499764467592830739030727222305800976141688008169211302).toString();
        const fromAy = Scalar.e(19826930437678088398923647454327426275321075228766562806246).toString();
        const fromEthAddr = "0xe0fbce58cfaa72812103f003adce3f284fe5fc7c";

        const txDepositOffchain = {
            fromAx,
            fromAy,
            fromEthAddr,
            toAx: exitAx,
            toAy: exitAy,
            toEthAddr: exitEthAddr,
            coin: 0,
            onChain: true
        };
        const encodedDeposit = utils.encodeDepositOffchain([txDepositOffchain]);
        expect(encodedDeposit).not.to.be.equal(undefined);
    });
});