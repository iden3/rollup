 
const Db = require('./db');
const {send} = require('./actions/offchain/send.js');
const {deposit} = require('./actions/onchain/deposit.js');

async function sendTx(urlOperator, to, amount, walletBabyjub, passString) {
  console.log(urlOperator + "\n" + to + "\n" + amount + "\n" + walletBabyjub + "\n" + passString);
  let response = await send(urlOperator, to, amount, walletBabyjub, passString)
  console.log({response})
}

async function depositTx(node, address, amount, tokenid, walletEth, passString, walletBabyjub, abi) {
  console.log(node + "\n" + address + "\n" + amount + "\n" + tokenid + "\n" + walletEth + "\n" + passString + "\n" + walletBabyjub + "\n" + "abi");
  let response = await deposit(node, address, amount, tokenid, walletEth, walletBabyjub, passString, abi);
 // console.log({response})
  let receip = await response.wait();
  console.log({events:receip.events.pop().args})

  
}

module.exports = {
  sendTx,
  depositTx
};