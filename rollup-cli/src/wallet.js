const { EthereumWallet } = require('../src/ethereum-wallet');
const { BabyJubWallet } = require('../../rollup-utils/babyjub-wallet');

class Wallet {
  constructor(ethWallet, babyjubWallet) {
    this.ethWallet = JSON.parse(ethWallet);
    this.babyjubWallet = JSON.parse(babyjubWallet);
  }

  static async createRandom(pass) {
    const ethWallet = EthereumWallet.createRandom();
    const encEthWallet = await ethWallet.toEncryptedJson(pass);
    const babyjubWallet = BabyJubWallet.createRandom();
    const encBabyjubWallet = await babyjubWallet.toEncryptedJson(pass);
    return JSON.stringify(new Wallet(encEthWallet, encBabyjubWallet));
  }

  static async fromMnemonic(mnemonic, pass) {
    const ethWallet = EthereumWallet.fromMnemonic(mnemonic);
    const encEthWallet = await ethWallet.toEncryptedJson(pass);
    const babyjubWallet = BabyJubWallet.fromMnemonic(mnemonic);
    const encBabyjubWallet = await babyjubWallet.toEncryptedJson(pass);
    return JSON.stringify(new Wallet(encEthWallet, encBabyjubWallet));
  }

  static async fromEncryptedJson(wallet, pass) {
    const eth = JSON.stringify(JSON.parse(wallet).ethWallet);
    const babyjub = JSON.stringify(JSON.parse(wallet).babyjubWallet);
    const ethWallet = await EthereumWallet.fromEncryptedJson(eth, pass);
    const encEthWallet = await ethWallet.toEncryptedJson(pass);
    const babyjubWallet = await BabyJubWallet.fromEncryptedJson(babyjub, pass);
    const encBabyjubWallet = await babyjubWallet.toEncryptedJson(pass);
    return JSON.stringify(new Wallet(encEthWallet, encBabyjubWallet));
  }
}

module.exports = {
  Wallet,
};
