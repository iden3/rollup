/* eslint-disable no-console */
const { send } = require('./actions/offchain/send.js');
const { deposit } = require('./actions/onchain/deposit.js');
const { depositOnTop } = require('./actions/onchain//deposit-on-top');
const { withdraw } = require('./actions/onchain/withdraw.js');
const { forceWithdraw } = require('./actions/onchain/force-withdraw.js');
const { transfer } = require('./actions/onchain/transfer.js');
const { depositAndTransfer } = require('./actions/onchain/deposit-and-transfer.js');
const CliExternalOperator = require('../../rollup-operator/src/cli-external-operator');
const { Wallet } = require('./wallet');

async function sendTx(urlOperator, to, amount, walletJson, passphrase, tokenId, userFee, idFrom, nonce, nonceObject) {
    const walletRollup = await Wallet.fromEncryptedJson(walletJson, passphrase);
    return send(urlOperator, to, amount, walletRollup, tokenId, userFee, idFrom, nonce, nonceObject);
}

async function depositTx(nodeEth, addressSC, loadAmount, tokenid, walletJson, passphrase, ethAddress, abi, gasLimit, gasMultiplier) {
    const walletRollup = await Wallet.fromEncryptedJson(walletJson, passphrase);
    return deposit(nodeEth, addressSC, loadAmount, tokenid, walletRollup, ethAddress, abi, gasLimit, gasMultiplier);
}

async function depositOnTopTx(nodeEth, addressSC, loadAmount, tokenid, walletJson, passphrase, abi, idTo, gasLimit, gasMultiplier) {
    const walletRollup = await Wallet.fromEncryptedJson(walletJson, passphrase);
    return depositOnTop(nodeEth, addressSC, loadAmount, tokenid, walletRollup, abi, idTo, gasLimit, gasMultiplier);
}

async function withdrawTx(nodeEth, addressSC, walletJson, passphrase, abi, urlOperator, idFrom, numExitRoot, gasLimit, gasMultiplier) {
    const walletRollup = await Wallet.fromEncryptedJson(walletJson, passphrase);
    return withdraw(nodeEth, addressSC, walletRollup, abi, urlOperator, idFrom, numExitRoot, gasLimit, gasMultiplier);
}

async function forceWithdrawTx(nodeEth, addressSC, amount, walletJson, passphrase, abi, idFrom, gasLimit, gasMultiplier) {
    const walletRollup = await Wallet.fromEncryptedJson(walletJson, passphrase);
    return forceWithdraw(nodeEth, addressSC, amount, walletRollup, abi, idFrom, gasLimit, gasMultiplier);
}

async function transferTx(nodeEth, addressSC, amount, tokenid, walletJson, passphrase, abi, idFrom, idTo, gasLimit, gasMultiplier) {
    const walletRollup = await Wallet.fromEncryptedJson(walletJson, passphrase);
    return transfer(nodeEth, addressSC, amount, tokenid, walletRollup, abi, idFrom, idTo, gasLimit, gasMultiplier);
}

async function depositAndTransferTx(nodeEth, addressSC, loadAmount, amount, tokenid, walletJson, passphrase, ethAddress, abi,
    toId, gasLimit, gasMultiplier) {
    const walletRollup = await Wallet.fromEncryptedJson(walletJson, passphrase);
    return depositAndTransfer(nodeEth, addressSC, loadAmount, amount, tokenid, walletRollup,
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
