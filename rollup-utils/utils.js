const Poseidon = require('../node_modules/circomlib/src/poseidon');

const hash = Poseidon.createHash(6, 8, 57);

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
  let finalStr = '';
  arrayStr.forEach((element) => {
    finalStr = finalStr.concat(element);
  });
  return `0x${padZeroes(finalStr, 64)}`;
}

module.exports = {
  arrayHexToBigInt,
  padZeroes,
  hash,
  buildElement,
  arrayBigIntToArrayStr,
};
