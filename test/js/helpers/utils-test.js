const Constants = require("../../../js/constants");

async function depositTx(bb, account, coin, loadamount) {
    bb.addTx({
        loadAmount: loadamount,
        coin: coin,
        fromAx: account.ax,
        fromAy: account.ay,
        fromEthAddr: account.ethAddress,
        toEthAddr: Constants.exitEthAddr,
        onChain: true
    });
}

module.exports = {
    depositTx,
};