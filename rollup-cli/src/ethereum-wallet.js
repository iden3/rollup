const ethers = require('ethers');

class EthereumWallet {

  constructor(wallet) {
    this.wallet = wallet;

    this.mnemonic = wallet.mnemonic;
    this.privateKey = wallet.privateKey;
    this.publicKey = wallet.signingKey.publicKey;
    this.publicKeyCompressed = wallet.signingKey.keyPair.compressedPublicKey;
  }

  static fromMnemonic(mnemonic) {
    return new EthereumWallet(ethers.Wallet.fromMnemonic(mnemonic));
  }

  static createRandom() {
    return new EthereumWallet(ethers.Wallet.createRandom());
  }

 static async fromEncryptedJson(json, pass) {
    return new EthereumWallet(await ethers.Wallet.fromEncryptedJson(json, pass));
  }

  signMessage(messageStr) {
    return this.wallet.signMessage(messageStr);
  }

  toEncryptedJson(pass) {
    return this.wallet.encrypt(pass);
  }
}

function verifyEthereum(publicKey, messStr, signatureHex) {
  var address = ethers.utils.verifyMessage(messStr, signatureHex);
  return address === ethers.utils.computeAddress(publicKey);
}

module.exports = {
  EthereumWallet,
  verifyEthereum,
};
