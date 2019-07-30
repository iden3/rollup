/* global BigInt */
const Poseidon = require('../../../node_modules/circomlib/src/poseidon.js');

const hash = Poseidon.createHash(6, 8, 57);

function padZeroes(str, length) {
  while (str.length < length) {
    str = `0${str}`;
  }
  return str;
}

function buildElement(arrayStr) {
  let finalStr = '';
  arrayStr.forEach((element) => {
    finalStr = finalStr.concat(element);
  });
  return `0x${padZeroes(finalStr, 64)}`;
}

function arrayHexToBigInt(arrayHex) {
  const arrayBigInt = [];
  arrayHex.forEach((element) => {
    arrayBigInt.push(BigInt(element));
  });
  return arrayBigInt;
}

function hashDeposit(id, balance, tokenId, Ax, Ay, withdrawAddress, nonce) {
  // Build Entry
  // element 0
  const idStr = padZeroes(id.toString('16'), 6);
  const amountStr = padZeroes(balance.toString('16'), 4);
  const tokenStr = padZeroes(tokenId.toString('16'), 4);
  const withdrawStr = padZeroes(withdrawAddress.toString('16'), 40);
  const e1 = buildElement([withdrawStr, tokenStr, amountStr, idStr]);
  // element 1
  const nonceStr = padZeroes(nonce.toString('16'), 8);
  const e2 = buildElement([nonceStr]);
  // element 2
  const e3 = buildElement([Ax.toString('16')]);
  // element 3
  const e4 = buildElement([Ay.toString('16')]);
  // Get array BigInt
  const entryBigInt = arrayHexToBigInt([e1, e2, e3, e4]);
  // Object leaf
  const leafObj = {
    id,
    balance,
    tokenId,
    Ax,
    Ay,
    withdrawAddress,
    nonce,
  };
  // Hash entry and object
  return { leafObj, hash: hash(entryBigInt) };
}

function hashArray(array) {
  return hash(array);
}

module.exports = {
  arrayHexToBigInt,
  padZeroes,
  hashDeposit,
  hashArray,
};
