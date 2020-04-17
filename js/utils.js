const bigInt = require("snarkjs").bigInt;
const poseidon = require("circomlib").poseidon;
const eddsa = require("circomlib").eddsa;

function padZeros(str, length) {
    if (length > str.length)
        str = "0".repeat(length - str.length) + str;
    return str;
}

function float2fix(fl) {
    const m = (fl & 0x3FF);
    const e = (fl >> 11);
    const e5 = (fl >> 10) & 1;

    const exp = bigInt(10).pow(bigInt(e));
    let res = bigInt(m).mul(exp);
    if (e5 && e) {
        res = res.add(exp.div(bigInt(2)));
    }
    return res;
}

function fix2float(_f) {
    const f = bigInt(_f);

    function floorFix2Float(_f) {
        const f = bigInt(_f);
        if (f.isZero()) return 0;

        let m = f;
        let e =0;
        while (! m.shr(10).isZero()) {
            m = m.div(bigInt(10));
            e++;
        }

        const res = Number(m) + (e << 11);
        return res;
    }

    function dist(n1, n2) {
        return n1.sub(n2).abs();
    }

    const fl1 = floorFix2Float(f);
    const fi1 = float2fix(fl1);
    const fl2 = fl1 | 0x400;
    const fi2 = float2fix(fl2);

    let m3 = (fl1 & 0x3FF)+1;
    let e3 = (fl1 >> 11);
    if (m3 == 0x400) {
        m3 = 0x66; // 0x400 / 10
        e3++;
    }
    const fl3 = m3 + (e3<<11);
    const fi3 = float2fix(fl3);

    let res = fl1;
    let d = dist(fi1, f);

    let d2 = dist(fi2, f);
    if (d.greater(d2)) {
        res=fl2;
        d=d2;
    }

    let d3 = dist(fi3, f);
    if (d.greater(d3)) {
        res=fl3;
    }

    return res;
}

function buildTxData(tx) {
    const IDEN3_ROLLUP_TX = bigInt("4839017969649077913");
    let res = bigInt(0);

    res = res.add( bigInt(IDEN3_ROLLUP_TX || 0));
    res = res.add( bigInt(fix2float(tx.amount || 0)).shl(64));
    res = res.add( bigInt(tx.coin || 0).shl(80));
    res = res.add( bigInt(tx.nonce || 0).shl(112));
    res = res.add( bigInt(fix2float(tx.userFee || 0)).shl(160));
    res = res.add( bigInt(tx.rqOffset || 0).shl(176));
    res = res.add( bigInt(tx.onChain ? 1 : 0).shl(179));
    res = res.add( bigInt(tx.newAccount ? 1 : 0).shl(180));

    return res;
}

function decodeTxData(txDataEncoded) {
    const txDataBi = bigInt(txDataEncoded);
    let txData = {};

    txData.amount = float2fix(txDataBi.shr(64).and(bigInt(1).shl(16).sub(bigInt(1))).toJSNumber());
    txData.tokenId = txDataBi.shr(80).and(bigInt(1).shl(32).sub(bigInt(1)));
    txData.nonce = txDataBi.shr(112).and(bigInt(1).shl(48).sub(bigInt(1)));
    txData.maxFee = float2fix(txDataBi.shr(160).and(bigInt(1).shl(16).sub(bigInt(1))).toJSNumber());
    txData.rqOffset = txDataBi.shr(176).and(bigInt(1).shl(3).sub(bigInt(1)));
    txData.onChain = txDataBi.shr(179).and(bigInt(1).shl(1).sub(bigInt(1))) ? true : false ;
    txData.newAccount = txDataBi.shr(180).and(bigInt(1).shl(1).sub(bigInt(1))) ? true : false ;

    return txData;
}

function txRoundValues(tx) {
    tx.amountF = fix2float(tx.amount);
    tx.amount = float2fix(tx.amountF);
    tx.userFeeF = fix2float(tx.userFee);
    tx.userFee = float2fix(tx.userFeeF);
}

function state2array(st) {
    const data = bigInt(st.coin).add( bigInt(st.nonce).shl(32) );
    return [
        data,
        bigInt(st.amount),
        bigInt("0x" + st.ax),
        bigInt("0x" + st.ay),
        bigInt(st.ethAddress),
    ];
}

function array2state(a) {
    return {
        coin: parseInt(bigInt(a[0]).and(bigInt(1).shl(32).sub(bigInt(1))).toString(), 10),
        nonce: parseInt(bigInt(a[0]).shr(32).and(bigInt(1).shl(32).sub(bigInt(1))).toString() , 10),
        amount: bigInt(a[1]),
        ax: bigInt(a[2]).toString(16),
        ay: bigInt(a[3]).toString(16),
        ethAddress: "0x" + padZeros(bigInt(a[4]).toString(16), 40),
    };
}

function hashState(st) {
    const hash = poseidon.createHash(6, 8, 57);

    return hash(state2array(st));
}


/**
 * Sign rollup transaction and add signature to transaction
 * @param {Object} walletBabyJub - Rerpresents a babyjubjub wallet which will sign the rollup transaction 
 * @param {Object} tx - Rollup transaction 
 */
function signRollupTx(walletBabyJub, tx) {
    const data = buildTxData(tx.amount, tx.coin, tx.nonce,
        tx.userFee, tx.rqOffset, tx.onChain, tx.newAccount);
    const hash = poseidon.createHash(5, 8, 57);

    const h = hash([
        data,
        tx.rqTxData || 0,
        bigInt("0x" + tx.toAx),
        bigInt("0x" + tx.toAy),
        bigInt(tx.toEthAddr),
    ]);
    const signature = eddsa.signPoseidon(walletBabyJub.privateKey.toString("hex"), h);
    tx.r8x = signature.R8[0];
    tx.r8y = signature.R8[1];
    tx.s = signature.S;
}

function verifyTxSig(tx) {
    try {
        const data = buildTxData(tx);
        const hash = poseidon.createHash(6, 8, 57);

        const h = hash([
            data,
            tx.rqTxData || 0,
            bigInt("0x" + tx.toAx),
            bigInt("0x" + tx.toAy),
            bigInt(tx.toEthAddr),
        ]);
        const signature = {
            R8: [bigInt(tx.r8x), bigInt(tx.r8y)],
            S: bigInt(tx.s)
        };
        
        const pubKey = [ bigInt("0x" + tx.fromAx), bigInt("0x" + tx.fromAy)];
        return eddsa.verifyPoseidon(h, signature, pubKey);
    } catch(E) {
        return false;
    }
}

function encodeDepositOffchain(depositsOffchain) {
    let bytes = [];
    for (let i=0; i<depositsOffchain.length; i++) {
        pushBigInt(bigInt("0x" + depositsOffchain[i].fromAx), 256/8);
        pushBigInt(bigInt("0x" + depositsOffchain[i].fromAy), 256/8);
        pushBigInt(bigInt(depositsOffchain[i].fromEthAddr), 160/8);
        pushBigInt(bigInt(depositsOffchain[i].coin), 32/8);
    }
    return Buffer.from(bytes);

    function pushBigInt(n, size) {
        for (let i=0; i<size; i++) {
            bytes.push(Number(n.shr(((size-1-i)*8)).and(bigInt(255))));
        }
    }
}

function encodeDepositOffchain2(depositsOffchain) {
    let buffer = Buffer.alloc(0);
    console.log(buffer);
    for (let i=0; i<depositsOffchain.length; i++) {
        buffer = Buffer.concat([
            buffer,
            bigInt("0x" + depositsOffchain[i].fromAx).beInt2Buff(32),
            bigInt("0x" + depositsOffchain[i].fromAy).beInt2Buff(32),
            bigInt(depositsOffchain[i].fromEthAddr).beInt2Buff(20),
            bigInt(depositsOffchain[i].coin).beInt2Buff(4),
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

    const numDeposits = depositsOffchain.length/depositBytes;

    for (let i = 0; i < numDeposits; i++){
        
        const ax = depositsOffchain.slice(0 + i*depositBytes, 32 + depositBytes * i);
        const ay = depositsOffchain.slice(32 + i*depositBytes, 64 + depositBytes * i);
        const ethAddress = depositsOffchain.slice(64 + i*depositBytes,84 + depositBytes * i);
        const token = depositsOffchain.slice(84 + i*depositBytes, 88 + depositBytes * i);

        const tx = {
            loadAmount: 0,
            coin: bigInt.beBuff2int(token).toJSNumber(),
            fromAx: bigInt.beBuff2int(ax).toString(16),
            fromAy: bigInt.beBuff2int(ay).toString(16),
            fromEthAddr: `0x${bigInt.beBuff2int(ethAddress).toString(16)}`,
            toAx: 0,
            toAy: 0,
            toEthAddr: 0,
            onChain: true
        };
        txs.push(tx);
    }

    return txs;
}


function hashIdx(coin, ax, ay){
    const h = poseidon.createHash(6, 8, 57);
    return h([coin, `0x${ax}`, `0x${ay}`]);
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
module.exports.signRollupTx = signRollupTx;
module.exports.verifyTxSig = verifyTxSig;
module.exports.encodeDepositOffchain = encodeDepositOffchain;
module.exports.hashIdx = hashIdx; 
module.exports.decodeDepositOffChain = decodeDepositOffChain;