
// import { describe, it } from 'mocha';
const Web3 = require('web3');
const web3 = new Web3();
const ethers = require('ethers');
const chai = require('chai');
const { createEth, importEth, readFile } = require('./wallet');

const { expect } = chai;
const pass = 'pass';

describe('wallet Eth', () => {
  it('import mnemonic', async () => {
    importEth('alley topic basic obscure hotel trust concert loyal design second this oxygen', pass);
    const data = await readFile();
    expect(data.mnemonic).to.be.equal('alley topic basic obscure hotel trust concert loyal design second this oxygen');
  });

  it('create', async () => {
    createEth(pass);
    const data = await readFile();
    expect(data.mnemonic).to.be.not.equal(undefined);
    expect(data.pubKey).to.be.not.equal(undefined);
    expect(data.encPrivateKey).to.be.not.equal(undefined);
  });

  it('flow', async () => {
    createEth(pass);
    const createWallet = await readFile();
    importEth(createWallet.mnemonic, pass);
    const importWallet = await readFile();
    expect(createWallet.encPrivateKey.address).to.be.equal(importWallet.encPrivateKey.address);
  });
});

describe('Decrypt', () => {
  it('decrypt eth account', async () => {
    const data = await readFile();
    const decAccount = web3.eth.accounts.decrypt(data.encPrivateKey, pass);
    const wallet = ethers.Wallet.fromMnemonic(data.mnemonic);
    expect(decAccount.address).to.be.equal(wallet.address);
  });
});
/* describe('wallet BabyJub', () => {
  it('import mnemonic', () => {      
  });
  it('create', () => {
  });
  it('flow', () => {
  });
}); */
