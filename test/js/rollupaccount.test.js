const { expect } = require("chai");

const Account = require("../../js/rollupaccount");
const utils = require("../../js/utils");
const Constants = require("../../js/constants");

describe("Rollup account", () => {
    let account;
    
    it("Create rollup account", async () => {
        account = new Account(1);

        expect(account.ax).to.be.not.equal(undefined);
        expect(account.ay).to.be.not.equal(undefined);
        expect(account.ethAddress).to.be.not.equal(undefined);
    });

    it("Sign transaction", async () => {
        const account2 = new Account(2);
        
        const tx = {
            toAx: account2.ax,
            toAy: account2.ay,
            toEthAddr: account2.ethAddress,
            coin: 0,
            amount: 500,
            nonce: 0,
            fee: Constants.fee["1%"]
        };

        account.signTx(tx);

        expect(tx.fromAx).to.be.equal(account.ax);
        expect(tx.fromAy).to.be.equal(account.ay);
        expect(tx.fromEthAddr).to.be.equal(account.ethAddress);

        expect(tx.r8x).to.be.not.equal(undefined);
        expect(tx.r8y).to.be.not.equal(undefined);
        expect(tx.s).to.be.not.equal(undefined);

        // Verify transaction
        const res = utils.verifyTxSig(tx);
        expect(res).to.be.equal(true);
    });
});
