const chai = require("chai");
const rollupTreeUtils = require("../../rollup-utils/rollup-tree-utils");
const Scalar = require("ffjavascript").Scalar;

const { expect } = chai;

describe("Rollup tree utils", () => {
    const amountDeposit = Scalar.e(2);
    const tokenId = Scalar.e(3);
    const Ax = Scalar.e(30890499764467592830739030727222305800976141688008169211302);
    const Ay = Scalar.e(19826930437678088398923647454327426275321075228766562806246);
    const ethAddress = Scalar.fromString("0xe0fbce58cfaa72812103f003adce3f284fe5fc7c", 16);
    const nonce = Scalar.e(4);

    it("hash leaf rollup tree", async () => {
    // Result retrieved from 'RollupHelpersV2.sol'
        const hash = "14422829883928914365932440251151072538283151652611338902014520044711612747360";
        const res = rollupTreeUtils.hashStateTree(amountDeposit, tokenId, Ax, Ay, ethAddress, nonce);
    
        expect(res.hash.toString()).to.be.equal(hash);
    });
});