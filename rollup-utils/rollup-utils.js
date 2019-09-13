/* global BigInt */
const {
    hash, padZeroes, buildElement, arrayHexToBigInt, num2Buff, multiHash,
} = require("./utils");

function createOffChainTx(numTx) {
    // create bunch of tx
    let buffTotalTx = Buffer.alloc(0);
    let hashTotal = 0;
    for (let i = 0; i < numTx; i++) {
        const from = BigInt(i).toString("16");
        const to = BigInt(i).toString("16");
        const amount = BigInt(i).toString("16");

        const fromBuff = Buffer.from(padZeroes(from, 6), "hex");
        const toBuff = Buffer.from(padZeroes(to, 6), "hex");
        const amoutBuff = Buffer.from(padZeroes(amount, 4), "hex");

        const txBuff = Buffer.concat([fromBuff, toBuff, amoutBuff]);
        buffTotalTx = Buffer.concat([buffTotalTx, txBuff]);

        // Caculate hash to check afterwards
        const e1 = BigInt(`0x${txBuff.toString("hex")}`);
        const hashTmp = hash([e1, 0, 0, 0, 0]);
        hashTotal = hash([hashTotal, hashTmp]);
    }
    const bytesTx = `0x${buffTotalTx.toString("hex")}`;

    return { bytesTx, hashOffChain: hashTotal };
}

function hashOffChainTx(hexOffChainTx) {
    // remove '0x'
    const hexOffChain = hexOffChainTx.substring(2);
    const numTx = hexOffChain.length / 16;
    let hashTotal = BigInt(0);

    let tmpStr = "";
    for (let i = 0; i < numTx; i++) {
        tmpStr = hexOffChain.substring(i * 16, (i + 1) * 16);
        const hashTmp = hash([BigInt(`0x${tmpStr.toString("hex")}`)]);
        hashTotal = hash([hashTotal, hashTmp]);
    }
    return hashTotal;
}

function buildOffChainTx(from, to, amount, coin) {
    return Buffer.concat([
        num2Buff(from, 3), 
        num2Buff(to, 3), 
        num2Buff(amount, 2),
        num2Buff(coin, 2)
    ]);
}

function hashDeposit(id, balance, tokenId, Ax, Ay, withdrawAddress, nonce) {
    // Build Entry
    // element 0
    const idStr = padZeroes(id.toString("16"), 6);
    const amountStr = padZeroes(balance.toString("16"), 4);
    const tokenStr = padZeroes(tokenId.toString("16"), 4);
    const withdrawStr = padZeroes(withdrawAddress.toString("16"), 40);
    const e1 = buildElement([withdrawStr, tokenStr, amountStr, idStr]);
    // element 1
    const nonceStr = padZeroes(nonce.toString("16"), 8);
    const e2 = buildElement([nonceStr]);
    // element 2
    const e3 = buildElement([Ax.toString("16")]);
    // element 3
    const e4 = buildElement([Ay.toString("16")]);
    // Get array BigInt
    const entryBigInt = arrayHexToBigInt([e1, e2, e3, e4]);

    // Hash entry and object
    return hash(entryBigInt);
}

function buildTxData(fromId, toId, amount, token, nonce, maxFee, rqOffset, onChain, newAccount) {
    // Build Entry
    // element 0
    const fromStr = padZeroes(fromId.toString("16"), 16);
    const toStr = padZeroes(toId.toString("16"), 16);
    const amountStr = padZeroes(amount.toString("16"), 4);
    const tokenStr = padZeroes(token.toString("16"), 4);
    const nonceStr = padZeroes(nonce.toString("16"), 12);
    const maxFeeStr = padZeroes(maxFee.toString("16"), 4);
    const rqOffsetStr = padZeroes(rqOffset.toString("16"), 1);
    let last = onChain ? 1 : 0;
    last = newAccount ? ( last | 0x02 ): last;
    const element = buildElement([last.toString("16"), rqOffsetStr,
        maxFeeStr, nonceStr, tokenStr, amountStr, toStr, fromStr]);
    return element;
}

function hashOnChain(oldOnChainHash, txData, loadAmount, withdrawAddress, Ax, Ay) {
    // Build Entry
    // element 0
    const e0 = buildElement([oldOnChainHash.toString("16")]);
    // element 1
    const e1 = buildElement([txData.toString("16")]);
    // element 2
    const e2 = buildElement([loadAmount.toString("16")]);
    // element 3
    const e3 = buildElement([withdrawAddress.toString("16")]); 
    // element 4
    const e4 = buildElement([Ax.toString("16")]);
    // element 5
    const e5 = buildElement([Ay.toString("16")]);
    
    // Get array BigInt
    const entryBigInt = arrayHexToBigInt([e0, e1, e2, e3, e4, e5]);
    // Hash entryobject
    return { elements: {e0, e1, e2, e3, e4, e5}, hash: multiHash(entryBigInt)};
}

module.exports = {
    createOffChainTx,
    hashDeposit,
    hashOffChainTx,
    buildOffChainTx,
    buildTxData,
    hashOnChain,
};