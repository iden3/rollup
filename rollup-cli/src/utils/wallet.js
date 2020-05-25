/* eslint-disable no-underscore-dangle */
/* eslint-disable prefer-destructuring */
const { eddsa } = require('circomlib');
const { Scalar } = require('ffjavascript');

const { EthereumWallet, verifyEthereum } = require('./ethereum-wallet');
const { BabyJubWallet, verifyBabyJub } = require('../../../rollup-utils/babyjub-wallet');
const utils = require('../../../js/utils');
const { hash } = require('../../../rollup-utils/utils');

class Wallet {
    constructor(ethWallet, babyjubWallet) {
        this.ethWallet = ethWallet;
        this.babyjubWallet = babyjubWallet;
    }

    /**
   * To create a random rollup wallet
   */
    static async createRandom() {
        const ethWallet = EthereumWallet.createRandom();
        const babyjubWallet = BabyJubWallet.createRandom();
        return new Wallet(ethWallet, babyjubWallet);
    }

    /**
   * To create a rollup wallet from mnemonic
   * @param {String} mnemonic - mnemonic
   */
    static async fromMnemonic(mnemonic, index = 0) {
        const ethWallet = EthereumWallet.fromMnemonic(mnemonic, index);
        const babyjubWallet = BabyJubWallet.fromMnemonic(mnemonic, index);
        return new Wallet(ethWallet, babyjubWallet);
    }

    /**
   * To import a rollup wallet from encrypted json
   * @param {Object} wallet - wallet
   * @param {String} pass - password
   */
    static async fromEncryptedJson(wallet, pass) {
        const eth = JSON.stringify(wallet.ethWallet);
        const babyjub = JSON.stringify(wallet.babyjubWallet);
        const ethWallet = await EthereumWallet.fromEncryptedJson(eth, pass);
        const babyjubWallet = await BabyJubWallet.fromEncryptedJson(babyjub, pass);
        return new Wallet(ethWallet, babyjubWallet);
    }

    /**
   * To encrypt a wallet
   * @param {String} pass - password
   */
    async toEncryptedJson(pass) {
        const eth = this.ethWallet;
        const babyjub = this.babyjubWallet;
        const encEthWallet = await eth.toEncryptedJson(pass);
        const encBabyJubWallet = await babyjub.toEncryptedJson(pass);
        return { ethWallet: JSON.parse(encEthWallet), babyjubWallet: JSON.parse(encBabyJubWallet) };
    }

    /**
   * To sign message with ethereum keys
   * @param {String} messageStr
   */
    signMessageEthereum(messageStr) {
        return this.ethWallet.signMessage(messageStr);
    }

    /**
   * To sign message with babyjub keys
   * @param {String} messageStr
   */
    signMessageBabyJub(messageStr) {
        return this.babyjubWallet.signMessage(messageStr);
    }

    /**
   * To sign transaction with babyjub keys
   * @param {Object} tx -transaction
   */
    async signRollupTx(tx) {
        const data = utils.buildTxData(tx);

        const h = hash([
            data,
            Scalar.e(tx.rqTxData || 0),
            Scalar.fromString(tx.toAx, 16),
            Scalar.fromString(tx.toAy, 16),
            Scalar.fromString(tx.toEthAddr, 16),
        ]);

        const signature = eddsa.signPoseidon(this.babyjubWallet.privateKey, h);
        tx.r8x = signature.R8[0];
        tx.r8y = signature.R8[1];
        tx.s = signature.S;
        tx.fromAx = this.babyjubWallet.publicKey[0].toString(16);
        tx.fromAy = this.babyjubWallet.publicKey[1].toString(16);
        tx.fromEthAddr = await this.ethWallet.wallet.getAddress();
    }
}

/**
 * To verify ethereum signature
 * @param {String} publicKey
 * @param {String} messStr
 * @param {String} signatureHex
 */
function verifyMessageEthereum(publicKey, messStr, signatureHex) {
    const verify = verifyEthereum(publicKey, messStr, signatureHex);
    return verify;
}

/**
 * To verify babyjub signature
 * @param {String} pubKeyCompressHex
 * @param {String} msg
 * @param {String} signatureHex
 */
function verifyMessageBabyJub(pubKeyCompressHex, msg, signatureHex) {
    const verify = verifyBabyJub(pubKeyCompressHex, msg, signatureHex);
    return verify;
}

module.exports = {
    Wallet,
    verifyMessageBabyJub,
    verifyMessageEthereum,
};
