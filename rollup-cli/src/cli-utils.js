/* eslint-disable no-console */
const { send } = require('./actions/offchain/send.js');
const { deposit } = require('./actions/onchain/deposit.js');
const { depositOnTop } = require('./actions/onchain//deposit-on-top');
const { withdraw } = require('./actions/onchain/withdraw.js');
const { forceWithdraw } = require('./actions/onchain/force-withdraw.js');
const { transfer } = require('./actions/onchain/transfer.js');
const { depositAndTransfer } = require('./actions/onchain/deposit-and-transfer.js');
const CliExternalOperator = require('../../rollup-operator/src/cli-external-operator');

async function sendTx(urlOperator, to, amount, wallet, passString, tokenId, userFee, fromId) {
    return send(urlOperator, to, amount, wallet, passString, tokenId, userFee, fromId);
}

async function depositTx(node, address, amount, tokenid, wallet, passString, ethAddress, abi) {
    return deposit(node, address, amount, tokenid, wallet, passString, ethAddress, abi);
}

async function depositOnTopTx(node, address, amount, tokenid, wallet, passString, abi, IdTo) {
    return depositOnTop(node, address, amount, tokenid, wallet, passString, abi, IdTo);
}

async function withdrawTx(node, address, amount, wallet, passString, abi, urlOperator, fromId, numExitRoot) {
    return withdraw(node, address, amount, wallet, passString, abi, urlOperator, fromId, numExitRoot);
}

async function forceWithdrawTx(node, address, amount, wallet, passString, abi, fromId) {
    return forceWithdraw(node, address, amount, wallet, passString, abi, fromId);
}

async function transferTx(node, address, amount, tokenid, wallet, passString, abi, fromId, toId) {
    return transfer(node, address, amount, tokenid, wallet, passString, abi, fromId, toId);
}

async function depositAndTransferTx(node, address, loadAmount, amount, tokenid, wallet, passString, ethAddress, abi, toId) {
    return depositAndTransfer(node, address, loadAmount, amount, tokenid, wallet, passString, ethAddress, abi, toId);
}

async function showLeafs(urlOperator, wallet) {
    const apiOperator = new CliExternalOperator(urlOperator);
    const filters = {
        ax: wallet.public.ax,
        ay: wallet.public.ay,
    };
    return apiOperator.getAccounts(filters);
}

module.exports = {
    sendTx,
    depositTx,
    depositOnTopTx,
    withdrawTx,
    forceWithdrawTx,
    showLeafs,
    transferTx,
    depositAndTransferTx,
};
