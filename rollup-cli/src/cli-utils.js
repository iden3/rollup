const { send } = require("./actions/offchain/send.js");
const { deposit } = require("./actions/onchain/deposit.js");
const { depositOnTop } = require("./actions/onchain/depositOnTop.js");
const { withdraw } = require("./actions/onchain/withdraw.js");
const { forceWithdraw } = require("./actions/onchain/forceWithdraw.js");

async function sendTx(urlOperator, to, amount, wallet, passString, tokenId, userFee) {
    const response = await send(urlOperator, to, amount, wallet, passString, tokenId, userFee);
    console.log(JSON.stringify(response));
}

async function depositTx(node, address, amount, tokenid, wallet, passString, abi) {
    const response = await deposit(node, address, amount, tokenid, wallet, passString, abi);
    const receip = await response.wait();
    console.log(JSON.stringify(receip.events.pop()));
}

async function depositOnTopTx(node, address, amount, tokenid, wallet, passString, abi, operator) {
    const response = await depositOnTop(node, address, amount, tokenid, wallet, passString, abi, operator);
    const receip = await response.wait();
    console.log(JSON.stringify(receip.events.pop()));
}

async function withdrawTx(node, address, amount, tokenid, wallet, passString, abi, operator) {
    const response = await withdraw(node, address, amount, tokenid, wallet, passString, abi, operator);
    const receip = await response.wait();
    console.log(JSON.stringify(receip.events.pop()));
}

async function forceWithdrawTx(node, address, amount, tokenid, wallet, passString, abi, operator) {
    const response = await forceWithdraw(node, address, amount, tokenid, wallet, passString, abi, operator);
    const receip = await response.wait();
    console.log(JSON.stringify(receip.events.pop()));
}

module.exports = {
    sendTx,
    depositTx,
    depositOnTopTx,
    withdrawTx,
    forceWithdrawTx,
};
