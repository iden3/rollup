/* eslint-disable no-console */
const { send } = require('./actions/offchain/send.js');
const { deposit } = require('./actions/onchain/deposit.js');
const { depositOnTop } = require('./actions/onchain//deposit-on-top');
const { withdraw } = require('./actions/onchain/withdraw.js');
const { forceWithdraw } = require('./actions/onchain/force-withdraw.js');
const { transfer } = require('./actions/onchain/transfer.js');
const { depositAndTransfer } = require('./actions/onchain/deposit-and-transfer.js');
const CliExternalOperator = require('../../rollup-operator/src/cli-external-operator');

async function sendTx(urlOperator, to, amount, wallet, passphrase, tokenId, userFee, idFrom, nonce, nonceObject) {
    return send(urlOperator, to, amount, wallet, passphrase, tokenId, userFee, idFrom, nonce, nonceObject);
}

async function depositTx(nodeEth, addressSC, loadAmount, tokenid, wallet, passphrase, ethAddress, abi, gasLimit, gasMultiplier) {
    return deposit(nodeEth, addressSC, loadAmount, tokenid, wallet, passphrase, ethAddress, abi, gasLimit, gasMultiplier);
}

async function depositOnTopTx(nodeEth, addressSC, loadAmount, tokenid, wallet, passphrase, abi, idTo, gasLimit, gasMultiplier) {
    return depositOnTop(nodeEth, addressSC, loadAmount, tokenid, wallet, passphrase, abi, idTo, gasLimit, gasMultiplier);
}

async function withdrawTx(nodeEth, addressSC, wallet, passphrase, abi, urlOperator, idFrom, numExitRoot, gasLimit, gasMultiplier) {
    return withdraw(nodeEth, addressSC, wallet, passphrase, abi, urlOperator, idFrom, numExitRoot, gasLimit, gasMultiplier);
}

async function forceWithdrawTx(nodeEth, addressSC, amount, wallet, passphrase, abi, idFrom, gasLimit, gasMultiplier) {
    return forceWithdraw(nodeEth, addressSC, amount, wallet, passphrase, abi, idFrom, gasLimit, gasMultiplier);
}

async function transferTx(nodeEth, addressSC, amount, tokenid, wallet, passphrase, abi, idFrom, idTo, gasLimit, gasMultiplier) {
    return transfer(nodeEth, addressSC, amount, tokenid, wallet, passphrase, abi, idFrom, idTo, gasLimit, gasMultiplier);
}

async function depositAndTransferTx(nodeEth, addressSC, loadAmount, amount, tokenid, wallet, passphrase, ethAddress, abi,
    toId, gasLimit, gasMultiplier) {
    return depositAndTransfer(nodeEth, addressSC, loadAmount, amount, tokenid, wallet, passphrase,
        ethAddress, abi, toId, gasLimit, gasMultiplier);
}

async function showAccounts(urlOperator, filters) {
    const apiOperator = new CliExternalOperator(urlOperator);
    return apiOperator.getAccounts(filters);
}

async function showExitsBatch(urlOperator, id) {
    const apiOperator = new CliExternalOperator(urlOperator);
    return apiOperator.getExits(id);
}

module.exports = {
    sendTx,
    depositTx,
    depositOnTopTx,
    withdrawTx,
    forceWithdrawTx,
    showAccounts,
    transferTx,
    depositAndTransferTx,
    showExitsBatch,
};
