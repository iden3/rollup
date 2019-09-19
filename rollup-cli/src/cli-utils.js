const Db = require('./db');
const { send, deposit } = require('./actions/cli-actions');

function sendTx(urlOperator, from, to, amount, walletBabyjub, passString) {
  console.log(urlOperator + "\n" + from + "\n" + to + "\n" + amount + "\n" + walletBabyjub + "\n" + passString);
  //send(urlOperator, from, to, amount, walletBabyjub, passString)
}

function depositTx(node, address, amount, tokenid, walletEth, passString, walletBabyjub, abi) {
  console.log(node + "\n" + address + "\n" + amount + "\n" + tokenid + "\n" + walletEth + "\n" + passString + "\n" + walletBabyjub + "\n" + "abi");
  //deposit(node, address, amount, tokenid, walletEth, passString, walletBabyjub, abi);
}

module.exports = {
  sendTx,
  depositTx
};
