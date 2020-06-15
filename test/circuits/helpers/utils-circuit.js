function random(ceil){
    return Math.floor((Math.random() * ceil));
}

function printTx(w, c, nTx){
    console.log();
    console.log(`<-------Tx: ${nTx}------->`);
    console.log("<--Off-Chain-->");
    console.log("txData: ", w[c.getSignalIdx(`main.txData[${nTx}]`)].toString());
    console.log("fromIdx: ", w[c.getSignalIdx(`main.fromIdx[${nTx}]`)].toString());
    console.log("toIdx: ", w[c.getSignalIdx(`main.toIdx[${nTx}]`)].toString());
    console.log("toAx: ", w[c.getSignalIdx(`main.toAx[${nTx}]`)].toString());
    console.log("toAy: ", w[c.getSignalIdx(`main.toAy[${nTx}]`)].toString());
    console.log("toEthAddr: ", w[c.getSignalIdx(`main.toEthAddr[${nTx}]`)].toString());
    console.log("rqTxData: ", w[c.getSignalIdx(`main.rqTxData[${nTx}]`)].toString());
    console.log("step: ", w[c.getSignalIdx(`main.step[${nTx}]`)].toString());
    console.log("s: ", w[c.getSignalIdx(`main.s[${nTx}]`)].toString());
    console.log("r8x: ", w[c.getSignalIdx(`main.r8x[${nTx}]`)].toString());
    console.log("r8y: ", w[c.getSignalIdx(`main.r8y[${nTx}]`)].toString());

    console.log("<--On-Chain-->");
    console.log("loadAmount: ", w[c.getSignalIdx(`main.loadAmount[${nTx}]`)].toString());
    console.log("fromEthAddr: ", w[c.getSignalIdx(`main.fromEthAddr[${nTx}]`)].toString());
    console.log("fromAx: ", w[c.getSignalIdx(`main.fromAx[${nTx}]`)].toString());
    console.log("fromAy: ", w[c.getSignalIdx(`main.fromAy[${nTx}]`)].toString());
    console.log();
}

module.exports = {
    random,
    printTx,
};