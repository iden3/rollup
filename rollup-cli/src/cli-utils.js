 
const { send } = require('./actions/offchain/send.js');
const { deposit } = require('./actions/onchain/deposit.js');
// const {depositOnTop} = require('./actions/onchain/deposit-on-top.js');
// const {withdraw} = require('./actions/onchain/withdraw.js');
// const {forceWithdraw} = require('./actions/onchain/force-withdraw.js');

async function sendTx(urlOperator, to, amount, walletBabyjub, passString) {
  const response = await send(urlOperator, to, amount, walletBabyjub, passString);
  console.log(JSON.stringify(response));
}

async function depositTx(node, address, amount, tokenid, walletEth, passString, walletBabyjub, abi) {
  const response = await deposit(node, address, amount, tokenid, walletEth, walletBabyjub, passString, abi);
  const receip = await response.wait();
  // console.log({events:receip.events.pop().args});
  console.log(JSON.stringify(receip.events.pop().args));
}

async function depositOnTopTx(node, address, amount, tokenid, walletEth, passString, walletBabyjub, abi) {
  // let response = await depositOnTop(node, address, amount, tokenid, walletEth, walletBabyjub, passString, abi);
  // console.log(JSON.stringify(response));
  console.log("depositOnTopTx");
}

async function withdrawTx(node, address, amount, tokenid, walletEth, passString, walletBabyjub, abi) {
  // let response = await withdraw(node, address, amount, tokenid, walletEth, walletBabyjub, passString, abi);
  // console.log(JSON.stringify(response));
  console.log("withdrawTx");
}
async function forceWithdrawTx(node, address, amount, tokenid, walletEth, passString, walletBabyjub, abi) {
  // let response = await forceWithdraw(node, address, amount, tokenid, walletEth, walletBabyjub, passString, abi);
  // console.log(JSON.stringify(response));
  console.log("forceWithdrawTx");
}

module.exports = {
  sendTx,
  depositTx,
  depositOnTopTx,
  withdrawTx,
  forceWithdrawTx
};