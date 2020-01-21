const { expect } = require("chai");
const ApiBitfinex = require("../../src/synch-pool-service/api-bitfinex");

describe("Api Bitfinex", function () {

    let cliBitfinex;

    it("Should initialize client api bitfinex", async () => {
        cliBitfinex = new ApiBitfinex(); 
    });

    it("Should get base price", async () => {
        const base = "USD";

        const tagBTC = "BTC";
        const tagETH = "ETH";
        
        const resBTC = await cliBitfinex.getTokenLastPrice(tagBTC, base);
        const resETH = await cliBitfinex.getTokenLastPrice(tagETH, base);

        expect(resBTC).to.be.not.equal(undefined);
        expect(resETH).to.be.not.equal(undefined);
    });

    it("Should get list of tradding pairs", async () => {
        const resList = await cliBitfinex.getTraddingPairs();

        expect(resList.length).to.be.above(0);
    });

    it("Should get list of tradding pairs", async () => {
        const token = "DAI";

        const base0 = "USD";
        const base1 = "ETH";
        const base2 = "BTC";

        const lastPriceBase0 = await cliBitfinex.getTokenLastPrice(token, base0);
        const lastPriceBase1 = await cliBitfinex.getTokenLastPrice(token, base1);
        const lastPriceBase2 = await cliBitfinex.getTokenLastPrice(token, base2);

        expect(lastPriceBase0).to.be.not.equal(undefined);
        expect(lastPriceBase1).to.be.not.equal(undefined);
        expect(lastPriceBase2).to.be.not.equal(undefined);
    });
});