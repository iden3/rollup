/* global BigInt */
const { hashArray, padZeroes } = require('./poseidon-utils.js');

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
    const hashTmp = hashArray([e1, 0, 0, 0, 0]);
    hashTotal = hashArray([hashTotal, hashTmp]);
  }
  const bytesTx = `0x${buffTotalTx.toString('hex')}`;

  return { bytesTx, hashOffChain: hashTotal };
}

module.exports = {
  createOffChainTx,
};
