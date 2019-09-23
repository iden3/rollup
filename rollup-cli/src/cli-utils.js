 
const { send } = require('./actions/offchain/send.js');
const { deposit } = require('./actions/onchain/depositV2.js');
const { depositOnTop } = require('./actions/onchain/depositOnTopV2.js');
const { withdraw } = require('./actions/onchain/withdrawV2.js');
const { forceWithdraw } = require('./actions/onchain/forceWithdrawV2.js');

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

async function depositOnTopTx(node, address, amount, tokenid, walletEth, passString, walletBabyjub, abi, operator) {
  const response = await depositOnTop(node, address, amount, tokenid, walletEth, walletBabyjub, passString, abi, operator);
  console.log(JSON.stringify(response));
}

async function withdrawTx(node, address, amount, tokenid, walletEth, passString, walletBabyjub, abi) {
  const response = await withdraw(node, address, amount, tokenid, walletEth, walletBabyjub, passString, abi, operator);
  console.log(JSON.stringify(response));
}

async function forceWithdrawTx(node, address, amount, tokenid, walletEth, passString, walletBabyjub, abi) {
  const response = await forceWithdraw(node, address, amount, tokenid, walletEth, walletBabyjub, passString, abi, operator);
  console.log(JSON.stringify(response));
}

module.exports = {
  sendTx,
  depositTx,
  depositOnTopTx,
  withdrawTx,
  forceWithdrawTx
};