const chai = require('chai');
const wallet = require('../../rollup-utils/babyjub-hdwallet');
const eddsa = require('../../rollup-utils/eddsa-babyjub');

const { expect } = chai;

describe('BabyJubjub key generation', () => {
  const mnemonic = 'urban add pulse prefer exist recycle verb angle sell year more mosquito';
  const privTest0 = 'c72c427a1b6de6890c61254610ce2a5089b83fddab770177f1dc5fd574be39d3';
  const privTest1 = 'e26a07ed01c9784622200d4f40008dfd8b1163f11d250886c5f6a37a10df8a9f';

  it('from mnemonic', () => {
    const hdWallet = wallet.fromMnemonic(mnemonic);
    const priv0 = hdWallet.getPrivate(0);
    const priv1 = hdWallet.getPrivate(1);
    expect(priv0.toString('hex')).to.be.equal(privTest0);
    expect(priv1.toString('hex')).to.be.equal(privTest1);
  });

  it('from random', () => {
    const hdWallet = wallet.fromRandom(mnemonic);
    const pubPoint = hdWallet.getPublic(0);
    const pubCompressed = hdWallet.getPublic(0, true);
    const priv = new eddsa.PrivateKey(hdWallet.getPrivate(0));
    expect(priv.public().p[0].toString()).to.be.equal(pubPoint[0].toString());
    expect(priv.public().p[1].toString()).to.be.equal(pubPoint[1].toString());
    expect(priv.public().compress().toString()).to.be.equal(pubCompressed.toString());
  });
});
