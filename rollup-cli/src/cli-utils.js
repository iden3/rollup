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
const { approve } = require('./actions/onchain/approve.js');
const { hexToPoint } = require('../helpers/utils');

async function sendTx(urlOperator, babyjubCompressed, amount, walletJson, passphrase, tokenId, userFee, nonce, nonceObject) {
    const walletRollup = await Wallet.fromEncryptedJson(walletJson, passphrase);
    const babyjubTo = hexToPoint(babyjubCompressed);
    return send(urlOperator, babyjubTo, amount, walletRollup, tokenId, userFee, nonce, nonceObject);
}

async function depositTx(nodeEth, addressSC, loadAmount, tokenId, walletJson, passphrase, ethAddress, abi, gasLimit, gasMultiplier) {
    const walletRollup = await Wallet.fromEncryptedJson(walletJson, passphrase);
    return deposit(nodeEth, addressSC, loadAmount, tokenId, walletRollup, ethAddress, abi, gasLimit, gasMultiplier);
}

async function depositOnTopTx(nodeEth, addressSC, loadAmount, tokenId, babyjubCompressed,
    walletJson, passphrase, abi, gasLimit, gasMultiplier) {
    const walletRollup = await Wallet.fromEncryptedJson(walletJson, passphrase);
    const babyjubTo = hexToPoint(babyjubCompressed);
    return depositOnTop(nodeEth, addressSC, loadAmount, tokenId, babyjubTo, walletRollup, abi, gasLimit, gasMultiplier);
}

async function withdrawTx(nodeEth, addressSC, tokenId, walletJson, passphrase, abi, urlOperator, numExitRoot, gasLimit, gasMultiplier) {
    const walletRollup = await Wallet.fromEncryptedJson(walletJson, passphrase);
    return withdraw(nodeEth, addressSC, tokenId, walletRollup, abi, urlOperator, numExitRoot, gasLimit, gasMultiplier);
}

async function forceWithdrawTx(nodeEth, addressSC, tokenId, amount, walletJson, passphrase, abi, gasLimit, gasMultiplier) {
    const walletRollup = await Wallet.fromEncryptedJson(walletJson, passphrase);
    return forceWithdraw(nodeEth, addressSC, tokenId, amount, walletRollup, abi, gasLimit, gasMultiplier);
}

async function transferTx(nodeEth, addressSC, amount, tokenId, babyjubCompressed, walletJson, passphrase, abi, gasLimit, gasMultiplier) {
    const walletRollup = await Wallet.fromEncryptedJson(walletJson, passphrase);
    const babyjubTo = hexToPoint(babyjubCompressed);
    return transfer(nodeEth, addressSC, amount, tokenId, babyjubTo, walletRollup, abi, gasLimit, gasMultiplier);
}

async function depositAndTransferTx(nodeEth, addressSC, loadAmount, amount, tokenId,
    babyjubCompressed, walletJson, passphrase, ethAddress, abi, gasLimit, gasMultiplier) {
    const walletRollup = await Wallet.fromEncryptedJson(walletJson, passphrase);
    const babyjubTo = hexToPoint(babyjubCompressed);
    return depositAndTransfer(nodeEth, addressSC, loadAmount, amount, tokenId, babyjubTo, walletRollup,
        ethAddress, abi, gasLimit, gasMultiplier);
}

async function showAccounts(urlOperator, filters) {
    const apiOperator = new CliExternalOperator(urlOperator);
    return apiOperator.getAccounts(filters);
}

async function showAccountsByIdx(urlOperator, idx) {
    const apiOperator = new CliExternalOperator(urlOperator);
    return apiOperator.getAccountByIdx(idx);
}

async function showExitsBatch(urlOperator, id) {
    const apiOperator = new CliExternalOperator(urlOperator);
    return apiOperator.getExits(id);
}

async function approveTx(nodeEth, addressTokens, amount, spender, walletJson, passphrase, abi, gasLimit, gasMultiplier) {
    const walletRollup = await Wallet.fromEncryptedJson(walletJson, passphrase);
    return approve(nodeEth, addressTokens, amount, spender, walletRollup, abi, gasLimit, gasMultiplier);
}

module.exports = {
    sendTx,
    depositTx,
    depositOnTopTx,
    withdrawTx,
    forceWithdrawTx,
    showAccounts,
    showAccountsByIdx,
    transferTx,
    depositAndTransferTx,
    showExitsBatch,
    approveTx,
};
