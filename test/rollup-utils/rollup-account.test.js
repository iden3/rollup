const chai = require("chai");

const assert = chai.assert;

const RollupAccount = require("../../js/rollupaccount");

describe("Rollup Account", function () {

    it("Check a normal TX works ok", async () => {
        const account = new RollupAccount("c87509a1c067bbde78beb793e6fa76530b6382a4c0241e5e4a9ec0a0f44dc0d3");

        assert.equal(account.ethAddress, "0x627306090abab3a6e1400e9345bc60c78a8bef57");
    });

    it("Should create a new account", async () => {
        const account = new RollupAccount();

        assert.equal(account.ethAddress.length, 42);
    });
});
