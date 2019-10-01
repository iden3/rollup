/* eslint-disable no-underscore-dangle */
/* global BigInt */
const { EthereumWallet, verifyEthereum } = require("../src/ethereum-wallet");
const { BabyJubWallet, verifyBabyJub } = require("../../rollup-utils/babyjub-wallet");
const utils = require("../../rollup-utils/rollup-utils");
const eddsa = require("circomlib").eddsa;
const { hash } = require("../../rollup-utils/utils");

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
    static async fromMnemonic(mnemonic, index= 0) {
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

    signRollupTx(tx) {
        const IDEN3_ROLLUP_TX = BigInt("1625792389453394788515067275302403776356063435417596283072371667635754651289");
        const data = utils.buildTxData(tx.fromIdx, tx.toIdx, tx.amount, tx.coin, tx.nonce,
            tx.userFee, tx.rqOffset, tx.onChain, tx.newAccount); //new account 1 deposit i deposit ontop   //onchain  1  offchain 0 //rqoffse 0 siempre
        const h = hash([
            IDEN3_ROLLUP_TX,
            data,
            tx.rqData || 0
        ]);
        const signature = eddsa.signPoseidon(this.babyjubWallet.privateKey.toString("hex"), h);
        tx.r8x = signature.R8[0];
        tx.r8y = signature.R8[1];
        tx.s = signature.S;
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
