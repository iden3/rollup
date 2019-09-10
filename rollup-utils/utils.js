/* global BigInt */
const { bigInt, bn128 } = require("snarkjs");

const F = bn128.Fr;
const Poseidon = require("../node_modules/circomlib/src/poseidon");

const hash = Poseidon.createHash(6, 8, 57);

function num2Buff(num, size) {
    let bytes = [];
    for (let i=0; i<size; i++) {
        bytes.push((num >> (i*8))&0xFF);
    }
    return Buffer.from(bytes);
}

function padZeroes(str, length) {
    while (str.length < length) {
        str = `0${str}`;
    }
    return str;
}

function arrayHexToBigInt(arrayHex) {
    const arrayBigInt = [];
    arrayHex.forEach((element) => {
        arrayBigInt.push(BigInt(element));
    });
    return arrayBigInt;
}

function arrayBigIntToArrayStr(arrayBigInt) {
    const arrayStr = [];
    for (let i = 0; i < arrayBigInt.length; i++) {
        arrayStr.push(arrayBigInt[i].toString());
    }
    return arrayStr;
}

function buildElement(arrayStr) {
    let finalStr = "";
    arrayStr.forEach((element) => {
        finalStr = finalStr.concat(element);
    });
    return `0x${padZeroes(finalStr, 64)}`;
}

function multiHash(arr) {
    let r = bigInt(0);
    for (let i = 0; i < arr.length; i += 5) {
        const fiveElems = [];
        for (let j = 0; j < 5; j++) {
            if (i + j < arr.length) {
                fiveElems.push(arr[i + j]);
            } else {
                fiveElems.push(bigInt(0));
            }
        }
        const ph = hash(fiveElems);
        r = F.add(r, ph);
    }
    return F.affine(r);
}

function hashBuffer(msgBuff) {
    const n = 31;
    const msgArray = [];
    const fullParts = Math.floor(msgBuff.length / n);
    for (let i = 0; i < fullParts; i++) {
        const v = bigInt.leBuff2int(msgBuff.slice(n * i, n * (i + 1)));
        msgArray.push(v);
    }
    if (msgBuff.length % n !== 0) {
        const v = bigInt.leBuff2int(msgBuff.slice(fullParts * n));
        msgArray.push(v);
    }
    return multiHash(msgArray);
}

module.exports = {
    arrayHexToBigInt,
    padZeroes,
    hash,
    buildElement,
    arrayBigIntToArrayStr,
    hashBuffer,
    num2Buff,
    multiHash,
};
