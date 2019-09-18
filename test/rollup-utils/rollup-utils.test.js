/* global BigInt */
const chai = require("chai");
const rollupUtils = require("../../rollup-utils/rollup-utils");

const { expect } = chai;

describe("Rollup helpers js", () => {
    const id = BigInt(1);
    const amountDeposit = BigInt(2);
    const tokenId = BigInt(3);
    const Ax = BigInt(30890499764467592830739030727222305800976141688008169211302);
    const Ay = BigInt(19826930437678088398923647454327426275321075228766562806246);
    const withdrawAddress = BigInt("0xe0fbce58cfaa72812103f003adce3f284fe5fc7c");
    const nonce = BigInt(4);

    it("hash deposit", async () => {
        // Result retrieved from 'RollupHelpers.sol'
        const hexRollupHelpers = "5802a85619c58a1826c079f172016d1df4bdd9544f5a237ef0fac0b5cc551b5";
        const res = rollupUtils.hashDeposit(id, amountDeposit, tokenId, Ax, Ay, withdrawAddress, nonce);

        expect(res.toString("16")).to.be.equal(hexRollupHelpers);
    });

    it("hash off chain transactions", async () => {
        // Result retrieved from Rollup-offChain.test.js
        const rollupHelpers = "d58a0c54a4464b5d6027dc5f8f14c60b812ffe178d37e2f973566b7c8bea98a";
        const offTx = "0x0000010000020005";
        const res = rollupUtils.hashOffChainTx(offTx);

        expect(res.toString("16")).to.be.equal(rollupHelpers.toString());
    });

    it("hash on chain", async () => {
        // Result retrieved from "RollupHelpersV2.sol"
        const rollupHelpersV2 = "14511883762678221842394551253481284404451690454850560861360289615696112506700";
        const oldOnChainHash = 1;
        const txData = BigInt("0x001c000600000000000500000004000300000000000000020000000000000001");
        const loadAmount = 2;
        const Ax = BigInt(30890499764467592830739030727222305800976141688008169211302);
        const Ay = BigInt(19826930437678088398923647454327426275321075228766562806246);
        const ethAddress = "0xe0fbce58cfaa72812103f003adce3f284fe5fc7c";

        const res = rollupUtils.hashOnChain(oldOnChainHash, txData, loadAmount,
            BigInt(ethAddress), Ax, Ay);
        expect(res.hash.toString()).to.be.equal(rollupHelpersV2);
    });

    it("Code and decode Tx data", async () => {
        const fromId = 1;
        const toId = 2;
        const amount = 3;
        const tokenId = 4;
        const nonce = 5;
        const maxFee = 6;
        const rqOffset = 7;
        const onChain = true;
        const newAccount = true;

        const res = rollupUtils.buildTxData(fromId, toId, amount, tokenId, nonce,
            maxFee, rqOffset, onChain, newAccount);
        
        const txData = rollupUtils.decodeTxData(res);
        expect(txData.fromId.toString()).to.be.equal(fromId.toString());
        expect(txData.toId.toString()).to.be.equal(toId.toString());
        expect(txData.amount.toString()).to.be.equal(amount.toString());
        expect(txData.tokenId.toString()).to.be.equal(tokenId.toString());
        expect(txData.nonce.toString()).to.be.equal(nonce.toString());
        expect(txData.maxFee.toString()).to.be.equal(maxFee.toString());
        expect(txData.rqOffset.toString()).to.be.equal(rqOffset.toString());
        expect(txData.onChain).to.be.equal(onChain);
        expect(txData.newAccount).to.be.equal(newAccount);
    });
});
