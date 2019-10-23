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
    const response = await send(urlOperator, to, amount, wallet, passString, tokenId, userFee, fromId);
    return response;
}

async function depositTx(node, address, amount, tokenid, wallet, passString, abi) {
    const response = await deposit(node, address, amount, tokenid, wallet, passString, abi);
    const receip = await response.wait();
    return receip;
}

async function depositOnTopTx(node, address, amount, tokenid, wallet, passString, abi, IdTo, idTo) {
    const response = await depositOnTop(node, address, amount, tokenid, wallet, passString, abi, IdTo, idTo);
    const receip = await response.wait();
    return receip;
}

async function withdrawTx(node, address, amount, tokenid, wallet, passString, abi, operator, fromId) {
    const response = await withdraw(node, address, amount, tokenid, wallet, passString, abi, operator, fromId);
    const receip = await response.wait();
    return receip;
}

async function forceWithdrawTx(node, address, amount, tokenid, wallet, passString, abi, fromId) {
    const response = await forceWithdraw(node, address, amount, tokenid, wallet, passString, abi, fromId);
    const receip = await response.wait();
    return receip;
}

async function transferTx(node, address, amount, tokenid, wallet, passString, abi, fromId, toId) {
    const response = await transfer(node, address, amount, tokenid, wallet, passString, abi, fromId, toId);
    const receip = await response.wait();
    return receip;
}

async function depositAndTransferTx(node, address, loadAmount, amount, tokenid, wallet, passString, abi, toId) {
    const response = await depositAndTransfer(node, address, loadAmount, amount, tokenid, wallet, passString, abi, toId);
    const receip = await response.wait();
    return receip;
}

async function showLeafs(operator, wallet) {
    const apiOperator = new CliExternalOperator(operator);
    const res = await apiOperator.getInfoByAxAy(wallet.public.ax, wallet.public.ay);
    return res.data;
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
