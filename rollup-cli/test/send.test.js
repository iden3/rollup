const chai = require('chai');
const {send}= require('../src/actions/offchain/send.js');
const { BabyJubWallet } = require('../../rollup-utils/babyjub-wallet');
const { expect } = chai;
const fs = require('fs');
const walletBabyjubPathDefault="../src/resources/babyjubWallet.json"

describe('Send', () => {
  const UrlOperator ="http://127.0.0.1:9000";
  const idTo = 1;
  const amount =10;
  const walletBabyJubJson = fs.readFileSync(walletBabyjubPathDefault, "utf8")
  const password = "foo";
  const tokenId = 0;
  const userFee = 10;
  //walletBabyJub = fs.readFileSync("path", "utf8");


  it('Send test', async () => {
     let response = await send(UrlOperator, idTo, amount, walletBabyJubJson, password, tokenId, userFee)
     expect(response).to.be.equal(200);
  });

  
});
