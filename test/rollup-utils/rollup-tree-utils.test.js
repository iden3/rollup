/* global BigInt */
const chai = require("chai");
const rollupTreeUtils = require("../../rollup-utils/rollup-tree-utils");

const { expect } = chai;

describe("Rollup tree utils", () => {
    const amountDeposit = BigInt(2);
    const tokenId = BigInt(3);
    const Ax = BigInt(30890499764467592830739030727222305800976141688008169211302);
    const Ay = BigInt(19826930437678088398923647454327426275321075228766562806246);
    const withdrawAddress = BigInt("0xe0fbce58cfaa72812103f003adce3f284fe5fc7c");
    const nonce = BigInt(4);

    it("hash leaf rollup tree", async () => {
    // Result retrieved from 'RollupHelpers.sol'
        const hash = "11642199753522708922542907447656316648265577382104794691235957329497111122738";
        const res = rollupTreeUtils.hashLeafValueV2(amountDeposit, tokenId, Ax, Ay, BigInt(withdrawAddress), nonce);
    
        expect(res.hash.toString()).to.be.equal(hash);
    });
});