const {
  hash, padZeroes, buildElement, arrayHexToBigInt,
} = require('./utils');

function createOffChainTx(numTx) {
  // create bunch of tx
  let buffTotalTx = Buffer.alloc(0);
  let hashTotal = 0;
  for (let i = 0; i < numTx; i++) {
    const from = BigInt(i).toString('16');
    const to = BigInt(i).toString('16');
    const amount = BigInt(i).toString('16');

    const fromBuff = Buffer.from(padZeroes(from, 6), 'hex');
    const toBuff = Buffer.from(padZeroes(to, 6), 'hex');
    const amoutBuff = Buffer.from(padZeroes(amount, 4), 'hex');

    const txBuff = Buffer.concat([fromBuff, toBuff, amoutBuff]);
    buffTotalTx = Buffer.concat([buffTotalTx, txBuff]);

    // Caculate hash to check afterwards
    const e1 = BigInt(`0x${txBuff.toString('hex')}`);
    const hashTmp = hash([e1, 0, 0, 0, 0]);
    hashTotal = hash([hashTotal, hashTmp]);
  }
  const bytesTx = `0x${buffTotalTx.toString('hex')}`;

  return { bytesTx, hashOffChain: hashTotal };
}

function hashOffChainTx(hexOffChainTx) {
  // remove '0x'
  const hexOffChain = hexOffChainTx.substring(2);
  const numTx = hexOffChain.length / 16;
  let hashTotal = BigInt(0);

  let tmpStr = '';
  for (let i = 0; i < numTx; i++) {
    tmpStr = hexOffChain.substring(i * 16, (i + 1) * 16);
    const hashTmp = hash([BigInt(`0x${tmpStr.toString('hex')}`)]);
    hashTotal = hash([hashTotal, hashTmp]);
  }
  return hashTotal;
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

  // Hash entry and object
  return hash(entryBigInt);
}

module.exports = {
  createOffChainTx,
  hashDeposit,
  hashOffChainTx,
};
