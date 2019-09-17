const chai = require("chai");
const {send}= require("../src/actions/offchain/send.js");
const { expect } = chai;
const fs = require("fs");
const walletPathDefault="../src/resources/wallet.json";

describe("Send", () => {
    const UrlOperator ="http://127.0.0.1:9000";
    const idTo = 1;
    const amount =10;
    const wallet = JSON.parse(fs.readFileSync(walletPathDefault, "utf8"));
    const password = "foo";
    const tokenId = 0;
    const userFee = 10;
    //walletBabyJub = fs.readFileSync("path", "utf8");

    it("Send test", function() {
        return send(UrlOperator, idTo, amount, wallet, password, tokenId, userFee).then(function(response){
            expect(response).to.be.equal(200);
        });
    }).timeout(0);
  
});
