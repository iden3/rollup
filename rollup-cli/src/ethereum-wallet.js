const ethers = require("ethers");

class EthereumWallet {
    /**
   * Initialization Ethereum Wallet
   * @param {Object} wallet
   */
    constructor(wallet) {
        this.wallet = wallet;

        this.mnemonic = wallet.mnemonic;
        this.privateKey = wallet.privateKey;
        this.publicKey = wallet.signingKey.publicKey;
        this.publicKeyCompressed = wallet.signingKey.keyPair.compressedPublicKey;
    }
    /**
   * Create a new wallet from mnemonic
   * @param {String} mnemonic
   * @returns {Object} wallet
   */
    static fromMnemonic(mnemonic) {
        return new EthereumWallet(ethers.Wallet.fromMnemonic(mnemonic));
    }

    /**
   * Create a new random wallet
   * @returns {Object} wallet
   */
    static createRandom() {
        return new EthereumWallet(ethers.Wallet.createRandom());
    }

    /**
   * Create a new wallet from encrypted json
   * @param {Object} json - encrypted wallet
   * @param {String} pass - password
   * @returns {Object} wallet
   */
    static async fromEncryptedJson(json, pass) {
        return new EthereumWallet(await ethers.Wallet.fromEncryptedJson(json, pass));
    }

    /**
   * To sign message
   * @param {String} messageStr - message to sign
   * @returns {String} signature
   */
    signMessage(messageStr) {
        return this.wallet.signMessage(messageStr);
    }

    /**
   * To encrypt wallet
   * @param {String} pass - password
   * @returns {Object} encrypt wallet
   */
    toEncryptedJson(pass) {
        return this.wallet.encrypt(pass);
    }
}

/**
 * To verify ethereum signature
 * @param {String} publicKey
 * @param {String} messStr
 * @param {String} signatureHex
 * @returns {Boolean}
 */
function verifyEthereum(publicKey, messStr, signatureHex) {
    const address = ethers.utils.verifyMessage(messStr, signatureHex);
    return address === ethers.utils.computeAddress(publicKey);
}

module.exports = {
    EthereumWallet,
    verifyEthereum,
};
