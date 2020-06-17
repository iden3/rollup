const { assert, expect } = require("chai");
const Scalar = require("ffjavascript").Scalar;
const lodash = require("lodash");

const utils = require("../../js/utils");

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

    it("Floor fix to float", async () => {
        const testVector = [
            [0x776f, "87999990000000000"],
            [0x776f, "87950000000000001"],
            [0x776f, "87950000000000000"],
            [0x736f, "87949999999999999"],
        ];

        for (let i = 0; i < testVector.length; i++) {
            const testFloat = utils.floorFix2Float(testVector[i][1]);
            assert.equal(testFloat , testVector[i][0]);
        }
    });

    it("Transaction data", async () => {
        const tx = {
            amount: 24,
            coin: 4,
            nonce: 24,
            fee: 2,
            rqOffset: 3,
            onChain: true,
            newAccount: true,
        };

        const txData = `0x${utils.buildTxData(tx).toString(16)}`;
        const txDataDecoded = utils.decodeTxData(txData);

        expect(Scalar.eq(tx.amount, txDataDecoded.amount)).to.be.equal(true);
        expect(Scalar.eq(tx.coin, txDataDecoded.coin)).to.be.equal(true);
        expect(Scalar.eq(tx.nonce, txDataDecoded.nonce)).to.be.equal(true);
        expect(Scalar.eq(tx.fee, txDataDecoded.fee)).to.be.equal(true);
        expect(Scalar.eq(tx.rqOffset, txDataDecoded.rqOffset)).to.be.equal(true);
        expect(Scalar.eq(tx.onChain, txDataDecoded.onChain)).to.be.equal(true);
        expect(Scalar.eq(tx.newAccount, txDataDecoded.newAccount)).to.be.equal(true);
    });

    it("Transaction round values", async () => {
        const testVector = [
            [0x307B, "123000000"],
        ];
        
        const tx = {
            amount: testVector[0][1],
        };

        utils.txRoundValues(tx);

        expect(Scalar.eq(testVector[0][0], tx.amountF)).to.be.equal(true);
        expect(Scalar.eq(testVector[0][1], tx.amount)).to.be.equal(true);
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
            fee: 8,
            r8x: "14249628178193921968052075824427973879041165504798930571118394126803297737140",
            r8y: "11396494273403695736175326645477283963162576957994786575723116890527943119537",
            s: "2683750428557681416738177479124652233073327883450793607092072663389997444813",
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

    it("Encode/decode deposit off-chain", async () => { 
        // empty deposits
        const emptydata = utils.encodeDepositOffchain([]);
        const decodeEmpty = utils.decodeDepositOffChain(emptydata);
        expect(decodeEmpty.length).to.be.equal(0);

        // 1 deposit off-chain
        const depositOffchain = {
            fromAx: utils.padding256(30890499764467592830739030727222305800976141688008169211302),
            fromAy: utils.padding256(19826930437678088398923647454327426275321075228766562806246),
            fromEthAddr: "0xe0fbce58cfaa72812103f003adce3f284fe5fc7c",
            coin: 3,
        };

        const encodedData = utils.encodeDepositOffchain([depositOffchain]);
        const decodedData = utils.decodeDepositOffChain(encodedData);
        
        expect(decodedData.length).to.be.equal(1);
        
        const decodedTx = decodedData[0];
        
        expect(depositOffchain.fromAx).to.be.equal(decodedTx.fromAx);
        expect(depositOffchain.fromAy).to.be.equal(decodedTx.fromAy);
        expect(depositOffchain.fromEthAddr).to.be.equal(decodedTx.fromEthAddr);
        expect(depositOffchain.coin).to.be.equal(decodedTx.coin);

        // 2 deposits off-chain
        const depositOffchain2 = {
            fromAx: utils.padding256(30890499764467592830739030727222305800976141688008169211302),
            fromAy: utils.padding256(19826930437678088398923647454327426275321075228766562806246),
            fromEthAddr: "0xe0fbce58cfaa72812103f003adce3f284fe5fc7c",
            coin: 3,
        };

        const encodedData2 = utils.encodeDepositOffchain([depositOffchain, depositOffchain2]);
        const decodedData2 = utils.decodeDepositOffChain(encodedData2);

        expect(decodedData2.length).to.be.equal(2);

        const decodedTx1 = decodedData2[0];
        const decodedTx2 = decodedData2[1];

        expect(depositOffchain.fromAx).to.be.equal(decodedTx1.fromAx);
        expect(depositOffchain.fromAy).to.be.equal(decodedTx1.fromAy);
        expect(depositOffchain.fromEthAddr).to.be.equal(decodedTx1.fromEthAddr);
        expect(depositOffchain.coin).to.be.equal(decodedTx1.coin);

        expect(depositOffchain2.fromAx).to.be.equal(decodedTx2.fromAx);
        expect(depositOffchain2.fromAy).to.be.equal(decodedTx2.fromAy);
        expect(depositOffchain2.fromEthAddr).to.be.equal(decodedTx2.fromEthAddr);
        expect(depositOffchain2.coin).to.be.equal(decodedTx2.coin);
    });

    it("Decode data availability", async () => { 
        const nLevels = 8;
        const testVectors = [
            {
                txs:[],
                data: null
            },
            {
                txs:[],
                data: "0x"
            },
            {
                txs:[{fromIdx: 1, toIdx: 3, amount: Scalar.e(3), fee: 0}],
                data: "0x0010300030"
            },
            {
                txs:[{fromIdx: 1, toIdx: 2, amount: Scalar.e(50), fee: 13}],
                data: "0x001020032d"
            },
            {
                txs:[
                    {fromIdx: 3, toIdx: 4, amount: Scalar.e(50), fee: 13},
                    {fromIdx: 3, toIdx: 4, amount: Scalar.e(50), fee: 15}
                ],
                data: "0x03040032d03040032f"
            },
            {
                txs:[
                    {fromIdx: 3, toIdx: 4, amount: Scalar.e(40000000), fee: 1},
                    {fromIdx: 4, toIdx: 3, amount: Scalar.e(500000), fee: 3},
                    {fromIdx: 1, toIdx: 2, amount: Scalar.e(50), fee: 13},
                    {fromIdx: 2, toIdx: 1, amount: Scalar.e(50), fee: 15},
                ],
                data: "0x030429901040319f4301020032d02010032f"
            },
        ];
        
        for (let i = 0; i < testVectors.length; i++){
            const data = testVectors[i].data;
            const testTxs = testVectors[i].txs;

            const decodeTxs = utils.decodeDataAvailability(nLevels, data);
            
            expect(decodeTxs.length).to.be.equal(testTxs.length);
            for (let j = 0; j < decodeTxs.length; j++){
                expect(lodash.isEqual(decodeTxs[j], testTxs[j])).to.be.equal(true);
            }
        }
    });

});