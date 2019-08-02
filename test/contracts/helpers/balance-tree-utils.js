const {
  hash, padZeroes, arrayHexToBigInt, buildElement,
} = require('./utils');

function hashLeafValue(balance, tokenId, Ax, Ay, withdrawAddress, nonce) {
  // Build Entry
  // element 0
  const amountStr = padZeroes(balance.toString('16'), 4);
  const tokenStr = padZeroes(tokenId.toString('16'), 4);
  const withdrawStr = padZeroes(withdrawAddress.toString('16'), 40);
  const nonceStr = padZeroes(nonce.toString('16'), 8);
  const e1 = buildElement([nonceStr, withdrawStr, tokenStr, amountStr]);
  // element 1
  const e2 = buildElement([Ax.toString('16')]);
  // element 2
  const e3 = buildElement([Ay.toString('16')]);
  // Get array BigInt
  const entryBigInt = arrayHexToBigInt([e1, e2, e3]);
  // Object leaf
  const leafObj = {
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

module.exports = {
  buildElement,
  hashLeafValue,
};
