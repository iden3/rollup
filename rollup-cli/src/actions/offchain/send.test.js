const chai = require('chai');
const {send}= require('./send.js');
const { BabyJubWallet } = require('../../../../rollup-utils/babyjub-wallet');
const { expect } = chai;
const fs = require('fs');
const walletBabyjubPathDefault="../../babyjubWallet.json"

describe('Send', () => {
  const UrlOperator ="http://127.0.0.1:3000/offchain/send";
  const IdFrom = 0;
  const idTo = 1;
  const amount =10;
  const walletBabyJubJson = fs.readFileSync(walletBabyjubPathDefault, "utf8")
  const password = "foo"
  //walletBabyJub = fs.readFileSync("path", "utf8");


  it('Send test', async () => {
     let response = await send(UrlOperator, IdFrom, idTo, amount, walletBabyJubJson, password)
     expect(response).to.be.equal(200);
  });

  
});
