const bigInt = require("snarkjs").bigInt;

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
    res = res.add( bigInt(tx.nonce || 0).shl(160));
    res = res.add( bigInt(fix2float(tx.maxFee || 0)).shl(208));
    res = res.add( bigInt(tx.rqOffset || 0).shl(224));
    res = res.add( bigInt(tx.inChain ? 1 : 0).shl(228));
    res = res.add( bigInt(tx.newAccount ? 1 : 0).shl(229));

    return res;
}

module.exports.buildTxData = buildTxData;
module.exports.fix2float = fix2float;
module.exports.float2fix = float2fix;
