/* global BigInt */
const {
    hash, padZeroes, buildElement, arrayHexToBigInt, num2Buff,
} = require("./utils");
const eddsa = require("circomlib").eddsa;

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

function buildOffChainTx(from, to, amount) {
    return Buffer.concat([
        num2Buff(from, 3), 
        num2Buff(to, 3), 
        num2Buff(amount, 2)
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
    // Build Elemnt Tx Data
    // element 0
    const fromStr = fromId ? padZeroes(fromId.toString("16"), 16) : padZeroes("", 16);
    const toStr = toId ? padZeroes(toId.toString("16"), 16) : padZeroes("", 16);
    const amountStr = amount ? padZeroes(amount.toString("16"), 4) : padZeroes("", 4);
    const tokenStr = token ? padZeroes(token.toString("16"), 8) : padZeroes("", 8);
    const nonceStr = nonce ? padZeroes(nonce.toString("16"), 12) : padZeroes("", 12);
    const maxFeeStr = maxFee ? padZeroes(maxFee.toString("16"), 4) : padZeroes("", 4);
    let last = rqOffset ? (rqOffset & 0x07) : 0x00;
    last = onChain ? ( last | 0x08 ): last;
    last = newAccount ? ( last | 0x10 ): last;
    const element = buildElement([last.toString("16"), maxFeeStr,
        nonceStr, tokenStr, amountStr, toStr, fromStr]);
    return element;
}

function decodeTxData(txDataEncodedHex) {
    const txDataBi = BigInt(txDataEncodedHex);
    let txData = {};

    txData.fromId = txDataBi.and(BigInt(1).shl(64).sub(BigInt(1)));
    txData.toId = txDataBi.shr(64).and(BigInt(1).shl(64).sub(BigInt(1)));
    txData.amount = txDataBi.shr(128).and(BigInt(1).shl(16).sub(BigInt(1)));
    txData.tokenId = txDataBi.shr(144).and(BigInt(1).shl(32).sub(BigInt(1)));
    txData.nonce = txDataBi.shr(176).and(BigInt(1).shl(48).sub(BigInt(1)));
    txData.maxFee = txDataBi.shr(224).and(BigInt(1).shl(16).sub(BigInt(1)));
    txData.rqOffset = txDataBi.shr(240).and(BigInt(1).shl(3).sub(BigInt(1)));
    txData.onChain = txDataBi.shr(243).and(BigInt(1).shl(1).sub(BigInt(1))) ? true : false ;
    txData.newAccount = txDataBi.shr(244).and(BigInt(1).shl(1).sub(BigInt(1))) ? true : false ;

    return txData;
}

function hashOnChain(oldOnChainHash, txData, loadAmount, ethAddress, Ax, Ay) {
    // Build Entry
    // element 0
    const e0 = buildElement([oldOnChainHash.toString("16")]);
    // element 1
    const e1 = buildElement([txData.toString("16")]);
    // element 2
    const e2 = buildElement([loadAmount.toString("16")]);
    // element 3
    const e3 = buildElement([ethAddress.toString("16")]); 
    // element 4
    const e4 = buildElement([Ax.toString("16")]);
    // element 5
    const e5 = buildElement([Ay.toString("16")]);
    
    // Get array BigInt
    const entryBigInt = arrayHexToBigInt([e0, e1, e2, e3, e4, e5]);
    // Hash entryobject
    return { elements: {e0, e1, e2, e3, e4, e5}, hash: hash(entryBigInt)};
}

function signRollupTx(walletBabyJub, tx) {
    const IDEN3_ROLLUP_TX = BigInt("1625792389453394788515067275302403776356063435417596283072371667635754651289");
    const data = buildTxData(tx.fromIdx, tx.toIdx, tx.amount, tx.coin, tx.nonce,
        tx.userFee, tx.rqOffset, tx.onChain, tx.newAccount);

    const h = hash([
        IDEN3_ROLLUP_TX,
        data,
        tx.rqData || 0
    ]);
    const signature = eddsa.signPoseidon(walletBabyJub.privateKey.toString("hex"), h);
    tx.r8x = signature.R8[0];
    tx.r8y = signature.R8[1];
    tx.s = signature.S;
}

function buildFeeInputSm(feePlan) {
    if (feePlan == undefined) return ["0", "0"];
    if (feePlan.length > 16){
        throw new Error("Not allowed more than 16 coins with fee");
    }
    let feePlanCoins = BigInt(0);
    let feePlanFees = BigInt(0);
    for (let i = 0; i < feePlan.length; i++) {
        feePlanCoins = feePlanCoins.add( BigInt(feePlan[i][0]).shl(16*i) );
        feePlanFees = feePlanFees.add( BigInt(feePlan[i][1]).shl(16*i) );
    }
    return [feePlanCoins.toString(), feePlanFees.toString()];
}


module.exports = {
    createOffChainTx,
    hashDeposit,
    hashOffChainTx,
    buildOffChainTx,
    buildTxData,
    hashOnChain,
    decodeTxData,
    signRollupTx,
    buildFeeInputSm,
};