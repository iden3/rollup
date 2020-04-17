/* global BigInt */
const chai = require("chai");
const utils = require("../../js/utils");

const { expect } = chai;

describe("js utils", () => {

    it("Encode/Decode deposit off-chain", async () => {
        // empty deposits
        const emptydata = utils.encodeDepositOffchain([]);
        const decodeEmpty = utils.decodeDepositOffChain(emptydata);
        expect(decodeEmpty.length).to.be.equal(0);

        // 1 deposit off-chain
        const depositOffchain = {
            fromAx: BigInt(30890499764467592830739030727222305800976141688008169211302).toString(16),
            fromAy: BigInt(19826930437678088398923647454327426275321075228766562806246).toString(16),
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
            fromAx: BigInt(30890499764467592830739030727222305800976141688008169211302).toString(16),
            fromAy: BigInt(19826930437678088398923647454327426275321075228766562806246).toString(16),
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
});