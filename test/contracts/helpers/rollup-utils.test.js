/* global BigInt */
const chai = require('chai');
const rollupUtils = require('./rollup-utils');

const { expect } = chai;

describe('Rollup helpers js', () => {
  const id = BigInt(1);
  const amountDeposit = BigInt(2);
  const tokenId = BigInt(3);
  const Ax = BigInt(30890499764467592830739030727222305800976141688008169211302);
  const Ay = BigInt(19826930437678088398923647454327426275321075228766562806246);
  const withdrawAddress = BigInt('0xe0fbce58cfaa72812103f003adce3f284fe5fc7c');
  const nonce = BigInt(4);

  it('hash deposit', async () => {
    // Result retrieved from 'RollupHelpers.sol'
    const hexRollupHelpers = '5802a85619c58a1826c079f172016d1df4bdd9544f5a237ef0fac0b5cc551b5';
    const res = rollupUtils.hashDeposit(id, amountDeposit, tokenId, Ax, Ay, withdrawAddress, nonce);

    expect(res.toString('16')).to.be.equal(hexRollupHelpers);
  });

  it('hash off chain transactions', async () => {
    // Result retrieved from Rollup-offChain.test.js
    const rollupHelpers = 'd58a0c54a4464b5d6027dc5f8f14c60b812ffe178d37e2f973566b7c8bea98a';
    const offTx = '0x0000010000020005';
    const res = rollupUtils.hashOffChainTx(offTx);

    expect(res.toString('16')).to.be.equal(rollupHelpers.toString());
  });
});
