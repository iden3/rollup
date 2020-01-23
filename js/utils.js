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
    let res = bigInt(0);
    res = res.add( bigInt(tx.fromIdx || 0));
    res = res.add( bigInt(tx.toIdx || 0).shl(64));
    res = res.add( bigInt(fix2float(tx.amount || 0)).shl(128));
    res = res.add( bigInt(tx.coin || 0).shl(144));
    res = res.add( bigInt(tx.nonce || 0).shl(176));
    res = res.add( bigInt(fix2float(tx.userFee || 0)).shl(224));
    res = res.add( bigInt(tx.rqOffset || 0).shl(240));
    res = res.add( bigInt(tx.onChain ? 1 : 0).shl(243));
    res = res.add( bigInt(tx.newAccount ? 1 : 0).shl(244));

    return res;
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
        // coin: bigInt(a[0]).and(bigInt(1).shl(32).sub(bigInt(1))).toJSNumber(),
        // nonce: bigInt(a[0]).shr(32).and(bigInt(1).shl(32).sub(bigInt(1))).toJSNumber(),
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

function verifyTxSig(tx) {
    try {
        const IDEN3_ROLLUP_TX = bigInt("1625792389453394788515067275302403776356063435417596283072371667635754651289");
        const data = buildTxData(tx);
        const hash = poseidon.createHash(6, 8, 57);

        const h = hash([
            IDEN3_ROLLUP_TX,
            data,
            tx.rqTxData || 0
        ]);
        const signature = {
            R8: [bigInt(tx.r8x), bigInt(tx.r8y)],
            S: bigInt(tx.s)
        };
        
        const pubKey = [ bigInt("0x" + tx.ax), bigInt("0x" + tx.ay)];
        return eddsa.verifyPoseidon(h, signature, pubKey);
    } catch(E) {
        return false;
    }
}

module.exports.padZeros = padZeros;
module.exports.buildTxData = buildTxData;
module.exports.fix2float = fix2float;
module.exports.float2fix = float2fix;
module.exports.hashState = hashState;
module.exports.state2array = state2array;
module.exports.array2state = array2state;
module.exports.txRoundValues = txRoundValues;
module.exports.verifyTxSig = verifyTxSig;
