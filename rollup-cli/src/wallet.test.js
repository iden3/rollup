
// import { describe, it } from 'mocha';
const Web3 = require('web3');
const ethers = require('ethers');
const chai = require('chai');
const { createEth, importEth, readFile, createBabyJub, importBabyJub } = require('./wallet');

const web3 = new Web3();
const { expect } = chai;
const pass = 'pass';

describe('wallet Eth', () => {
  // Import ethereum wallet from mnemonic
  it('import mnemonic', async () => {
    await importEth('pepper jazz awkward like unhappy opera genuine jazz flash benefit country point', pass, 'wallet-rollup-cli.json');
    const data = await readFile('wallet-rollup-cli.json');
    expect(data.mnemonic).to.be.equal('pepper jazz awkward like unhappy opera genuine jazz flash benefit country point');
    expect(data.pubKey).to.be.equal('0x0493b9c8c4b837eeac7775913ee40d1ef3c7b90ec3ee74108f62d35ad69a940e1ff2e8ab35899df986c4e468d210fa09da30017309252358c3101160dd2a2bd377');
  });
  // Create ethereum wallet
  it('create', async () => {
    await createEth(pass, 'wallet-rollup-cli.json');
    const data = await readFile('wallet-rollup-cli.json');
    expect(data.mnemonic).to.be.not.equal(undefined);
    expect(data.pubKey).to.be.not.equal(undefined);
    expect(data.encPrivateKey).to.be.not.equal(undefined);
  });
  // Create and Import ethereum wallet
  it('flow', async () => {
    await createEth(pass, 'wallet-rollup-cli.json');
    const createWallet = await readFile('wallet-rollup-cli.json');
    await importEth(createWallet.mnemonic, pass, 'wallet-rollup-cli.json');
    const importWallet = await readFile('wallet-rollup-cli.json');
    expect(createWallet.encPrivateKey.address).to.be.equal(importWallet.encPrivateKey.address);
  });
});

describe('Decrypt', () => {
  // Decrypt ethereum wallet
  it('decrypt eth account', async () => {
    const data = await readFile('wallet-rollup-cli.json');
    const decAccount = web3.eth.accounts.decrypt(data.encPrivateKey, pass);
    const wallet = ethers.Wallet.fromMnemonic(data.mnemonic);
    expect(decAccount.address).to.be.equal(wallet.address);
  });
});

describe('wallet BabyJub', () => {
  //Import babyjub wallet from mnemonic
  it('import mnemonic', async () => {
    await importBabyJub('pepper jazz awkward like unhappy opera genuine jazz flash benefit country point', pass, 'wallet-rollup-cli.json');
    const data = await readFile('wallet-rollup-cli.json');
    expect(data.mnemonic).to.be.equal('pepper jazz awkward like unhappy opera genuine jazz flash benefit country point');
    expect(data.pubKey).to.be.equal('0x8d5a21a3b0568c16539b3c8fbe651df4983994aee21756c1eaae89e9a70a5383');
  });
  //Create babyjub wallet
  it('create', async () => {
    await createBabyJub(pass, 'wallet-rollup-cli.json');
    const data = await readFile('wallet-rollup-cli.json');
    expect(data.mnemonic).to.be.not.equal(undefined);
    expect(data.pubKey).to.be.not.equal(undefined);
    expect(data.encPrivateKey).to.be.not.equal(undefined);
  });
  //Create and import babyjub wallet
  it('flow', async () => {
    await createBabyJub(pass, 'wallet-rollup-cli.json');
    const createWallet = await readFile('wallet-rollup-cli.json');
    await importBabyJub(createWallet.mnemonic, pass, 'wallet-rollup-cli.json');
    const importWallet = await readFile('wallet-rollup-cli.json');
    expect(createWallet.encPrivateKey.address).to.be.equal(importWallet.encPrivateKey.address);
  });
});
