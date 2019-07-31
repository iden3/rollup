
// import { describe, it } from 'mocha';
const Web3 = require('web3');
const web3 = new Web3();
const ethers = require('ethers');
const chai = require('chai');
const { createEth, importEth, readFile, createBabyJub, importBabyJub } = require('./wallet');

const { expect } = chai;
const pass = 'pass';

describe('wallet Eth', () => {
  it('import mnemonic', async () => {
    await importEth('pepper jazz awkward like unhappy opera genuine jazz flash benefit country point', pass);
    const data = await readFile('wallet-rollup-cli.json');
    expect(data.mnemonic).to.be.equal('pepper jazz awkward like unhappy opera genuine jazz flash benefit country point');
    const decAccount = web3.eth.accounts.decrypt(data.encPrivateKey, pass);
    expect(decAccount.address.toLowerCase()).to.be.equal('0x7defb80823d81b872e37e3285d30aca1ec3a6500');
    expect(decAccount.privateKey).to.be.equal('0xc7d654d2eef522e3ad0eae464925d88b218cfaa3cd4f2499314047989e88d83d');
  });

  it('create', async () => {
    await createEth(pass);
    const data = await readFile('wallet-rollup-cli.json');
    expect(data.mnemonic).to.be.not.equal(undefined);
    expect(data.pubKey).to.be.not.equal(undefined);
    expect(data.encPrivateKey).to.be.not.equal(undefined);
  });

  it('flow', async () => {
    await createEth(pass);
    const createWallet = await readFile('wallet-rollup-cli.json');
    await importEth(createWallet.mnemonic, pass);
    const importWallet = await readFile('wallet-rollup-cli.json');
    expect(createWallet.encPrivateKey.address).to.be.equal(importWallet.encPrivateKey.address);
  });
});

describe('Decrypt', () => {
  it('decrypt eth account', async () => {
    const data = await readFile('wallet-rollup-cli.json');
    const decAccount = web3.eth.accounts.decrypt(data.encPrivateKey, pass);
    const wallet = ethers.Wallet.fromMnemonic(data.mnemonic);
    expect(decAccount.address).to.be.equal(wallet.address);
  });
});

describe('wallet BabyJub', () => {
  it('import mnemonic', async () => {
    await importBabyJub('pepper jazz awkward like unhappy opera genuine jazz flash benefit country point', pass);
    const data = await readFile('wallet-rollup-cli.json');
    expect(data.mnemonic).to.be.equal('pepper jazz awkward like unhappy opera genuine jazz flash benefit country point');
    //const decAccount = web3.eth.accounts.decrypt(data.encPrivateKey, pass);
  });

  it('create', async () => {
    await createBabyJub(pass);
    const data = await readFile('wallet-rollup-cli.json');
    expect(data.mnemonic).to.be.not.equal(undefined);
    expect(data.pubKey).to.be.not.equal(undefined);
    expect(data.encPrivateKey).to.be.not.equal(undefined);
  });

  it('flow', async () => {
    await createBabyJub(pass);
    const createWallet = await readFile('wallet-rollup-cli.json');
    await importBabyJub(createWallet.mnemonic, pass);
    const importWallet = await readFile('wallet-rollup-cli.json');
    expect(createWallet.encPrivateKey.address).to.be.equal(importWallet.encPrivateKey.address);
  });
});
