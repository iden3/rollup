const Scalar = require("ffjavascript").Scalar;
const poseidon = require("circomlib").poseidon;
const eddsa = require("circomlib").eddsa;
const { beInt2Buff, beBuff2int } = require("ffjavascript").utils;

const Constants = require("./constants");

function extract(num, origin, len) {
    const mask = Scalar.sub(Scalar.shl(1, len), 1);
    return Scalar.band(Scalar.shr(num, origin), mask);
}

function padZeros(str, length) {
    if (length > str.length)
        str = "0".repeat(length - str.length) + str;
    return str;
}

function float2fix(fl) {
    const m = (fl & 0x3FF);
    const e = (fl >> 11);
    const e5 = (fl >> 10) & 1;

    const exp = Scalar.pow(10, e);

    let res = Scalar.mul(m, exp);
    if (e5 && e) {
        res = Scalar.add(res, Scalar.div(exp, 2));
    }
    return res;
}

function fix2float(_f) {
    const f = Scalar.e(_f);

    function floorFix2Float(_f) {
        const f = Scalar.e(_f);
        if (Scalar.isZero(f)) return 0;

        let m = f;
        let e = 0;

        while (!Scalar.isZero(Scalar.shr(m, 10))) {
            m = Scalar.div(m, 10);
            e++;
        }

        const res = Scalar.toNumber(m) + (e << 11);
        return res;
    }

    function dist(n1, n2) {
        const tmp = Scalar.sub(n1, n2);

        return Scalar.abs(tmp);
    }

    const fl1 = floorFix2Float(f);
    const fi1 = float2fix(fl1);
    const fl2 = fl1 | 0x400;
    const fi2 = float2fix(fl2);

    let m3 = (fl1 & 0x3FF) + 1;
    let e3 = (fl1 >> 11);
    if (m3 == 0x400) {
        m3 = 0x66; // 0x400 / 10
        e3++;
    }
    const fl3 = m3 + (e3 << 11);
    const fi3 = float2fix(fl3);

    let res = fl1;
    let d = dist(fi1, f);

    let d2 = dist(fi2, f);
    if (Scalar.gt(d, d2)) {
        res = fl2;
        d = d2;
    }

    let d3 = dist(fi3, f);
    if (Scalar.gt(d, d3)) {
        res = fl3;
    }

    return res;
}

function buildTxData(tx) {
    const IDEN3_ROLLUP_TX = Scalar.fromString("4839017969649077913");
    let res = Scalar.e(0);

    res = Scalar.add(res, IDEN3_ROLLUP_TX);
    res = Scalar.add(res, Scalar.shl(fix2float(tx.amount || 0), 64));
    res = Scalar.add(res, Scalar.shl(tx.coin || 0, 80));
    res = Scalar.add(res, Scalar.shl(tx.nonce || 0, 112));
    res = Scalar.add(res, Scalar.shl(tx.fee || 0, 160));
    res = Scalar.add(res, Scalar.shl(tx.rqOffset || 0, 164));
    res = Scalar.add(res, Scalar.shl(tx.onChain ? 1 : 0, 167));
    res = Scalar.add(res, Scalar.shl(tx.newAccount ? 1 : 0, 168));

    return res;
}

function decodeTxData(txDataEncoded) {
    const txDataBi = Scalar.fromString(txDataEncoded);
    let txData = {};

    txData.amount = float2fix(Scalar.toNumber(extract(txDataBi, 64, 16)));
    txData.coin = extract(txDataBi, 80, 32);
    txData.nonce = extract(txDataBi, 112, 48);
    txData.fee = Scalar.toNumber(extract(txDataBi, 160, 4));
    txData.rqOffset = extract(txDataBi, 164, 3);
    txData.onChain = Scalar.isZero(extract(txDataBi, 167, 1)) ? false : true;
    txData.newAccount = Scalar.isZero(extract(txDataBi, 168, 1)) ? false : true;

    return txData;
}

function txRoundValues(tx) {
    tx.amountF = fix2float(tx.amount);
    tx.amount = float2fix(tx.amountF);
}

function state2array(st) {
    let data = Scalar.e(0);
    
    data = Scalar.add(data, st.coin);
    data = Scalar.add(data, Scalar.shl(st.nonce, 32));

    return [
        data,
        Scalar.e(st.amount),
        Scalar.fromString(st.ax, 16),
        Scalar.fromString(st.ay, 16),
        Scalar.fromString(st.ethAddress, 16),
    ];
}

function array2state(a) {
    return {
        coin: Scalar.toNumber(extract(a[0], 0, 32)),
        nonce: Scalar.toNumber(extract(a[0], 32, 48)),
        amount: Scalar.e(a[1]),
        ax: Scalar.e(a[2]).toString(16),
        ay: Scalar.e(a[3]).toString(16),
        ethAddress: "0x" + padZeros(Scalar.e(a[4]).toString(16), 40),
    };
}

function hashState(st) {
    const hash = poseidon.createHash(6, 8, 57);

    return hash(state2array(st));
}

function verifyTxSig(tx) {
    try {
        const data = buildTxData(tx);
        const hash = poseidon.createHash(6, 8, 57);

        const h = hash([
            data,
            Scalar.e(tx.rqTxData || 0),
            Scalar.fromString(tx.toAx, 16),
            Scalar.fromString(tx.toAy, 16),
            Scalar.fromString(tx.toEthAddr, 16),
        ]);

        const signature = {
            R8: [Scalar.e(tx.r8x), Scalar.e(tx.r8y)],
            S: Scalar.e(tx.s)
        };

        const pubKey = [Scalar.fromString(tx.fromAx, 16), Scalar.fromString(tx.fromAy, 16)];
        return eddsa.verifyPoseidon(h, signature, pubKey);
    } catch (E) {
        return false;
    }
}

function hashIdx(coin, ax, ay) {
    const h = poseidon.createHash(6, 8, 57);
    return h([Scalar.e(coin), Scalar.fromString(ax, 16), Scalar.fromString(ay, 16)]);
}

function encodeDepositOffchain(depositsOffchain) {
    let buffer = Buffer.alloc(0);
    for (let i=0; i<depositsOffchain.length; i++) {
        buffer = Buffer.concat([
            buffer,
            beInt2Buff(Scalar.fromString(depositsOffchain[i].fromAx, 16), 32),
            beInt2Buff(Scalar.fromString(depositsOffchain[i].fromAy, 16), 32),
            beInt2Buff(Scalar.fromString(depositsOffchain[i].fromEthAddr, 16), 20),
            beInt2Buff(Scalar.e(depositsOffchain[i].coin), 4),
        ]);
    }
    
    return buffer;
}

/**
 * Parse encoded deposit off-chain from smart contract
 * |Ax|Ay|EthAddress|Token| - |32 bytes|32 bytes|20 bytes|4 bytes|
 * @param {Buffer} depositsOffchain contains all deposits off-chain data
 * @returns {Array} deposit transactions 
 */
function decodeDepositOffChain(depositsOffchain) {
    const depositBytes = 88;
    let txs = [];
  
    const numDeposits = depositsOffchain.length / depositBytes;
  
    for (let i = 0; i < numDeposits; i++){
        
        const ax = depositsOffchain.slice(0 + i*depositBytes, 32 + depositBytes * i);
        const ay = depositsOffchain.slice(32 + i*depositBytes, 64 + depositBytes * i);
        const ethAddress = depositsOffchain.slice(64 + i*depositBytes, 84 + depositBytes * i);
        const token = depositsOffchain.slice(84 + i*depositBytes, 88 + depositBytes * i);

        const tx = {
            loadAmount: 0,
            coin: Scalar.toNumber(beBuff2int(token)),
            fromAx: beBuff2int(ax).toString(16),
            fromAy: beBuff2int(ay).toString(16),
            fromEthAddr: `0x${beBuff2int(ethAddress).toString(16)}`,
            toAx: Constants.exitAx,
            toAy: Constants.exitAy,
            toEthAddr: Constants.exitEthAddr,
            onChain: true,
            newAccount: true,
        };
        txs.push(tx);
    }
  
    return txs;
}

function isStrHex(input) {
    if (typeof (input) == "string" && input.slice(0, 2) == "0x") {
        return true;
    }
    return false;
}

function decodeDataAvailability(nLevels, dataStr){
    const txs = [];

    const indexBits = nLevels;
    const amountBits = 16;
    const feeBits = 4;

    if (!dataStr.slice(2).length) return txs;

    let txsData = Scalar.fromString(dataStr, 16);

    while(!Scalar.isZero(txsData)){
        const tx = {};
        tx.fee = Scalar.toNumber(extract(txsData, 0, feeBits));
        tx.amount = float2fix(Scalar.toNumber(extract(txsData, feeBits, amountBits)));
        tx.toIdx = Scalar.toNumber(extract(txsData, feeBits + amountBits, indexBits));
        tx.fromIdx = Scalar.toNumber(extract(txsData, feeBits + amountBits + indexBits, indexBits));
        txs.push(tx);

        txsData = Scalar.shr(txsData, feeBits + amountBits + 2*indexBits);
    }

    return txs.reverse();
}


module.exports.padZeros = padZeros;
module.exports.buildTxData = buildTxData;
module.exports.decodeTxData = decodeTxData;
module.exports.fix2float = fix2float;
module.exports.float2fix = float2fix;
module.exports.hashState = hashState;
module.exports.state2array = state2array;
module.exports.array2state = array2state;
module.exports.txRoundValues = txRoundValues;
module.exports.verifyTxSig = verifyTxSig;
module.exports.hashIdx = hashIdx;
module.exports.isStrHex = isStrHex; 
module.exports.extract = extract;
module.exports.encodeDepositOffchain = encodeDepositOffchain;
module.exports.decodeDepositOffChain = decodeDepositOffChain;
module.exports.decodeDataAvailability = decodeDataAvailability;