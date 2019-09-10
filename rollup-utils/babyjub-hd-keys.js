const bip39 = require("bip39");
const hdkey = require("hdkey");
const etherUtil = require("ethereumjs-util");
const eddsaBabyJub = require("./eddsa-babyjub");

/**
 * Use to create babyjub private/public keys following the next rules:
 * path to create babyjubjub keys is the next path used to generate ethereum keys
 * Ethereum common path --> "m/44'/60'/0'/0/0"
 * BabyJubJub derived key --> "m/44'/60'/0'/0/0/{BabyJubJub path}"
 */

class BabyJubJubHdKeys {
    /**
     * Create a babyjubjub hdwallet from a given mnemonic
     * @param {String} mnemonic - mnemonic encoded as string
     * @return {BabyJubJubHDWallet} Babyjubjub hd wallet class
     */
    static fromMnemonic(mnemonic, rootPath = "m/44'/60'/0'/0/0") {
        const seed = bip39.mnemonicToSeedSync(mnemonic);
        const root = hdkey.fromMasterSeed(seed);
        const node = root.derive(rootPath);
        return new BabyJubJubHdKeys(node);
    }

    /**
     * Create a random babyjubjub hdwallet
     * @return {BabyJubJubHdKeys} mnemonic Babyjubjub hd wallet class
     */
    static fromRandom(rootPath = "m/44'/60'/0'/0/0") {
        const randMnemonic = bip39.generateMnemonic();
        const seed = bip39.mnemonicToSeedSync(randMnemonic);
        const root = hdkey.fromMasterSeed(seed);
        const node = root.derive(rootPath);
        return new BabyJubJubHdKeys(node);
    }

    /**
     * Create a babyjubjub hd keys from an ethereum extended private key
     * @param {String} ethExtendedPriv  ethereum private extended key
     * @return {BabyJubJubHdKeys} mnemonic Babyjubjub hd wallet class
     */
    static fromEthExtendedPriv(ethExtendedPriv) {
        const node = hdkey.fromExtendedKey(ethExtendedPriv);
        return new BabyJubJubHdKeys(node);
    }

    /**
     * Create babyjubjub hdwallet from a mnemonic
     * @param {Object} node - node
     */
    constructor(node) {
        this.node = node;
    }

    /**
     * Get ethereum private extended key
     */
    getEthExtendedPrivate() {
        return this.node.privateExtendedKey;
    }

    /**
     * Get ethereum private keyy
     */
    getEthPrivate() {
        return this.node.privateKey;
    }

    /**
     * Get ethereum public address
     */
    getEthAddress() {
        return `0x${etherUtil.privateToAddress(this.node.privateKey).toString("hex")}`;
    }

    /**
     * Get babyjub private key
     * @param {Number} index - path to generate private key
     */
    getPrivate(index) {
        const node = this.node.derive(`m/${index}`);
        return node.privateKey;
    }

    /**
     * Get babyjub public key
     * @param {Number} index - path to generate public key
     * @param {Bool} compress - determines if return would be key compressed
     * @return {Buffer | Array[BigInt]}
     */
    getPublic(index, compress = false) {
        const priv = new eddsaBabyJub.PrivateKey(this.getPrivate(index));
        const pub = priv.public();
        if (compress) {
            return pub.compress();
        }
        return [pub.p[0], pub.p[1]];
    }
}

module.exports = BabyJubJubHdKeys;
