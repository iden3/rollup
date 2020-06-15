const ethers = require("ethers");
const Poseidon = require("circomlib/src/poseidon");
const keccak256 = require("js-sha3").keccak256;
const eddsa = require("circomlib").eddsa;
const Scalar = require("ffjavascript").Scalar;
const eddsaBabyJub = require("./eddsa-babyjub");
const { ROLLUP_MESSAGE } = require("./rollup-wallet-utils.js");
const { hashBuffer } = require("./utils");
const { buildTxData } = require("../js/utils");

const hash = Poseidon.createHash(6, 8, 57);

class RollupWallet {
    /**
     * Initialization Rollup Wallet
     * @param {Object} wallet - etherjs wallet
     * @param {String} prvRollup - private key to derive public babyjubjub keys
     */
    constructor(wallet, prvRollup) {
        // Ethereum keys
        // wallet holds privae ethereum key
        this.wallet = wallet;
        
        // Rollup keys
        this.rollupPrivateKey = Buffer.from(prvRollup, "hex");
        const priv = new eddsaBabyJub.PrivateKey(this.rollupPrivateKey);
        const pub = priv.public();

        this.rollupPubKeyPoint = [pub.p[0], pub.p[1]];
        this.rollupCompressedKey = pub.compress();
    }

    /**
     * Create a new wallet from mnemonic
     * @param {String} mnemonic - 12 words
     * @param {Number} index - path to derive keys
     * @returns {RollupWallet} Rollup wallet
     */
    static async fromMnemonic(mnemonic, index = 0) {
        const path = `m/44'/60'/0'/0/${index}`;
        const ethWallet = ethers.Wallet.fromMnemonic(mnemonic, path);
        const prvRollup = await _deriveRollup(ethWallet); 
        return new RollupWallet(ethWallet, prvRollup);
    }

    /**
     * Create a new random wallet
     * @returns {RollupWallet} Rollup wallet
     */
    static async createRandom() {
        const ethWallet = ethers.Wallet.createRandom();
        const prvRollup = await _deriveRollup(ethWallet);
        return new RollupWallet(ethWallet, prvRollup);
    }

    /**
     * Create a new wallet from encrypted json
     * @param {Object} json - encrypted wallet
     * @param {String} pass - password
     * @returns {RollupWallet} Rollup wallet
     */
    static async fromEncryptedJson(json, pass) {
        const ethWallet = await ethers.Wallet.fromEncryptedJson(json, pass);
        const prvRollup = await _deriveRollup(ethWallet);
        return new RollupWallet(ethWallet, prvRollup);
    }

    /**
     * Returns rollup public point X coordinate encoded as hex string
     * @returns {String} rollup X point
     */
    ax(){
        return `0x${this.rollupPubKeyPoint[0].toString(16)}`;
    }

    /**
     * Returns rollup public point Y coordinate encoded as hex string
     * @returns {String} rollup Y point
     */
    ay(){
        return `0x${this.rollupPubKeyPoint[1].toString(16)}`;
    }
    
    /**
     * Returns rollup address (Babyjubjub compressed key) encoded as hex string
     * @returns {String} rollup address
     */
    rollupAddress(){
        return `0x${this.rollupCompressedKey.toString("hex")}`;
    }

    /**
     * Returns ethereum address encoded as hex string
     * @returns {String} ethereum address
     */
    ethAddress(){
        return this.wallet.address;
    }

    /**
     * To sign message with ethereum key
     * @param {String} messageStr - message to sign
     * @returns {String} signature
     */
    signEthereumMessage(messageStr) {
        return this.wallet.signMessage(messageStr);
    }

    /**
     * To sign message with rollup key
     * @param {String} messageStr - message to sign
     * @returns {String} - Babyjubjub signature packed and encoded as an hex string 
     */
    signRollupMessage(messageStr) {
        const messBuff = Buffer.from(messageStr);
        const messHash = hashBuffer(messBuff);
        const privKey = new eddsaBabyJub.PrivateKey(this.rollupPrivateKey);
        const sig = privKey.signPoseidon(messHash);
        return sig.toString("hex");
    }

    /**
     * To sign transaction with babyjubjub keys
     * @param {Object} tx -transaction
     */
    signRollupTx(tx) {
        const data = buildTxData(tx);

        const h = hash([
            data,
            Scalar.e(tx.rqTxData || 0),
            Scalar.fromString(tx.toAx, 16),
            Scalar.fromString(tx.toAy, 16),
            Scalar.fromString(tx.toEthAddr, 16),
        ]);

        const signature = eddsa.signPoseidon(this.rollupPrivateKey, h);
        tx.r8x = signature.R8[0];
        tx.r8y = signature.R8[1];
        tx.s = signature.S;
        tx.fromAx = `0x${this.rollupPubKeyPoint[0].toString(16)}`;
        tx.fromAy = `0x${this.rollupPubKeyPoint[1].toString(16)}`;
        tx.fromEthAddr = this.ethAddress();
    }

    /**
     * To encrypt wallet
     * @param {String} pass - password
     * @returns {Object} encrypt wallet
     */
    async toEncryptedJson(pass) {
        const encryptedWallet = JSON.parse(await this.wallet.encrypt(pass));
        
        // add rollup address fields
        encryptedWallet.rollup = {};
        encryptedWallet.rollup.publicPoint = {
            ax: this.rollupPubKeyPoint[0].toString(16),
            ay: this.rollupPubKeyPoint[1].toString(16),
        };
        encryptedWallet.rollup.address = this.rollupAddress();

        return JSON.stringify(encryptedWallet);
    }
}

/**
 * Extract rollup private key from ecdsa signed message
 * @param {Object} wallet - ethereum wallet
 * @returns {String} private rollup key
 */
async function _deriveRollup(wallet) {
    const signature = await wallet.signMessage(ROLLUP_MESSAGE);
    return keccak256(signature);
}

module.exports = {
    RollupWallet,
};
