const Db = require('./db');
const { send, deposit } = require('./actions/cli-actions');

function loadDb(obj) {
  
}

function sendTx(walletPath, passString, to, amount, operator) {
  send(walletPath, passString, to, amount, operator)
}

function depositTx(walletPath, passString) {
  deposit(walletPath, passString)
}

module.exports = {
  loadDb,
  sendTx,
  depositTx
};
