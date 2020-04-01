const bigInt = require("big-integer");
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
    let res = bigInt(m).times(exp);
    if (e5 && e) {
        res = res.add(exp.divide(bigInt(2)));
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
        while (! m.shiftRight(10).isZero()) {
            m = m.divide(bigInt(10));
            e++;
        }

        const res = Number(m) + (e << 11);
        return res;
    }

    function dist(n1, n2) {
        return n1.minus(n2).abs();
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
    res = res.add( bigInt(fix2float(tx.amount || 0)).shiftLeft(64));
    res = res.add( bigInt(tx.coin || 0).shiftLeft(80));
    res = res.add( bigInt(tx.nonce || 0).shiftLeft(112));
    res = res.add( bigInt(fix2float(tx.userFee || 0)).shiftLeft(160));
    res = res.add( bigInt(tx.rqOffset || 0).shiftLeft(176));
    res = res.add( bigInt(tx.onChain ? 1 : 0).shiftLeft(179));
    res = res.add( bigInt(tx.newAccount ? 1 : 0).shiftLeft(180));

    return res;
}

function decodeTxData(txDataEncoded) {
    const txDataBi = bigInt(txDataEncoded);
    let txData = {};

    txData.amount = float2fix(txDataBi.shiftRight(64).and(bigInt(1).shiftLeft(16).minus(bigInt(1))).toJSNumber());
    txData.tokenId = txDataBi.shiftRight(80).and(bigInt(1).shiftLeft(32).minus(bigInt(1)));
    txData.nonce = txDataBi.shiftRight(112).and(bigInt(1).shiftLeft(48).minus(bigInt(1)));
    txData.maxFee = float2fix(txDataBi.shiftRight(160).and(bigInt(1).shiftLeft(16).minus(bigInt(1))).toJSNumber());
    txData.rqOffset = txDataBi.shiftRight(176).and(bigInt(1).shiftLeft(3).minus(bigInt(1)));
    txData.onChain = txDataBi.shiftRight(179).and(bigInt(1)).equals(1) ? true : false ;
    txData.newAccount = txDataBi.shiftRight(180).and(bigInt(1)).equals(1) ? true : false ;

    return txData;
}

function txRoundValues(tx) {
    tx.amountF = fix2float(tx.amount);
    tx.amount = float2fix(tx.amountF);
    tx.userFeeF = fix2float(tx.userFee);
    tx.userFee = float2fix(tx.userFeeF);
}

function state2array(st) {
    const data = bigInt(st.coin).add( bigInt(st.nonce).shiftLeft(32) );
    return [
        data,
        bigInt(st.amount),
        bigInt(st.ax, 16),
        bigInt(st.ay, 16),
        bigInt(st.ethAddress.slice(2), 16),
    ];
}

function array2state(a) {
    return {
        coin: parseInt(bigInt(a[0]).and(bigInt(1).shiftLeft(32).minus(bigInt(1))).toString(), 10),
        nonce: parseInt(bigInt(a[0]).shiftRight(32).and(bigInt(1).shiftLeft(32).minus(bigInt(1))).toString() , 10),
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
            bigInt(tx.toAx, 16),
            bigInt(tx.toAy, 16),
            bigInt(tx.toEthAddr.slice(2), 16),
        ]);
        const signature = {
            R8: [bigInt(tx.r8x), bigInt(tx.r8y)],
            S: bigInt(tx.s)
        };
        
        const pubKey = [ bigInt(tx.fromAx, 16), bigInt(tx.fromAy, 16)];
        return eddsa.verifyPoseidon(h, signature, pubKey);
    } catch(E) {
        return false;
    }
}

function hashIdx(coin, ax, ay){
    const h = poseidon.createHash(6, 8, 57);
    return h([bigInt(coin), bigInt(ax, 16), bigInt(ay, 16)]);
}

function isStrHex(input){
    if (typeof(input) == "string" && input.slice(0, 2) == "0x"){
        return true;
    }
    return false;
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
module.exports.hashIdx = hashIdx;
module.exports.isStrHex = isStrHex; 
