const cryptoLib = require("crypto");
const eddsaBabyJub = require("./eddsa-babyjub");
const babyJubKeys = require("./babyjub-hd-keys");
const utils = require("./utils");
const walletUtils = require("./babyjub-wallet-utils");

/**
 * Manage Babyjubjub keys
 * Perform standard wallet actions
 */
class BabyJubWallet {
    /**
     * Initialize Babyjubjub wallet from private key
     * @param {Buffer} privateKey - 32 bytes buffer
     * @param {String} mnemonic - 12 words mnemonic 
     */
    constructor(privateKey, mnemonic = null) {
        this.mnemonic = mnemonic;

        const priv = new eddsaBabyJub.PrivateKey(privateKey);
        const pub = priv.public();

        this.privateKey = privateKey;
        this.publicKey = [pub.p[0], pub.p[1]];
        this.publicKeyCompressed = pub.compress();
    }

    /**
     * Initialize Babyjubjub wallet from 12 word mnemonic
     * @param {String} mnemonic - 12 word mnemonic
     * @param {Number} index - key derivation babyjubjub path
     * @returns {BabyJubWallet} - Babyjubjub wallet class
     */
    static fromMnemonic(mnemonic, index = 0) {
        const root = babyJubKeys.fromMnemonic(mnemonic);
        return new BabyJubWallet(root.getPrivate(index), mnemonic);
    }

    /**
     * Initilize Babyjubjub wallet from random mnemonic
     * @returns {BabyJubWallet} - Babyjubjub wallet class
     */
    static createRandom() {
        const root = babyJubKeys.fromRandom();
        return new BabyJubWallet(root.getPrivate(0));
    }

    /**
     * Initilize Babyjubjub wallet from json wallet
     * @param {Object} json - json babyjubjub wallet 
     * @param {String} pass - passphrase to encryot private key
     * @returns {BabyJubWallet} - Babyjubjub wallet class 
     */
    static fromEncryptedJson(json, pass) {
        const jsonObject = JSON.parse(json);
        const { crypto } = jsonObject;
        const { ciphertext } = jsonObject;
        const { kdfparams } = jsonObject;
        const { mac } = jsonObject;

        const keyStr = walletUtils.passToKey(pass, kdfparams.salt,
            kdfparams.i, kdfparams.dklen, kdfparams.digest);
        walletUtils.checkPass(keyStr, ciphertext, mac);
        const keyBuff = Buffer.from(keyStr, "base64");
        const ivBuff = Buffer.from(crypto.cipherparams.iv, "base64");
        const privKeyStr = walletUtils.decrypt(keyBuff, ciphertext, crypto.cipher, ivBuff);
        return new BabyJubWallet(Buffer.from(privKeyStr, "base64"));
    }

    /**
     * Signs message with private key
     * @param {String} messageStr - message to sign
     * @returns {String} - Babyjubjub signature packed and encoded as an hex string 
     */
    signMessage(messageStr) {
        const messBuff = Buffer.from(messageStr);
        const messHash = utils.hashBuffer(messBuff);
        const privKey = new eddsaBabyJub.PrivateKey(this.privateKey);
        const sig = privKey.signPoseidon(messHash);
        return sig.toString("hex");
    }

    /**
     * Json bayjubjub wallet
     * @param {String} pass - Password to encrypt private key 
     * @param {Number} dklen - key length
     * @param {String} digest - hash to use 
     * @param {Number} iterations - number of iterations
     * @param {String} salt - 16 bytes encoded as base64 string
     * @param {String} algo - algorithm used
     * @param {String} iv - initilaization vector
     * @returns {Object} - json object wallet babyjubjub
     */
    toEncryptedJson(pass, dklen = 24, digest = "sha256",
        iterations = 256, salt = null, algo = "aes-192-cbc", iv = null) {
        if (salt === null) {
            salt = cryptoLib.randomBytes(16).toString("base64");
        }

        if (iv === null) {
            iv = cryptoLib.randomBytes(16);
        } else if (iv.constructor === String) {
            iv = Buffer.from(iv, "base64");
        }

        const keyStr = walletUtils.passToKey(pass, salt, iterations, dklen, digest);
        const keyBuff = Buffer.from(keyStr, "base64");
        const privKeyStr = this.privateKey.toString("base64");
        const encryptDataStr = walletUtils.encrypt(keyBuff, privKeyStr, algo, iv);
        const macCalc = walletUtils.getMac(keyBuff, Buffer.from(encryptDataStr, "base64"));

        const obj = {
            public: {
                ax: this.publicKey[0].toString(16),
                ay: this.publicKey[1].toString(16),
            },
            publicCompressed: this.publicKeyCompressed.toString("hex"),
            crypto: {
                cipher: algo,
                cipherparams: {
                    iv: iv.toString("base64"),
                },
            },
            ciphertext: encryptDataStr,
            kdfparams: {
                dklen,
                digest,
                i: iterations,
                salt,
            },
            mac: macCalc,
        };
        return JSON.stringify(obj);
    }
}

/**
 * Verifies signature for a given message using babyjubjub
 * @param {String} publicKeyHex - Babyjubjub public key encoded as hex string
 * @param {String} messStr - clear message data
 * @param {String} signatureHex - Ecdsa signature compresed and encoded as hex string 
 * @returns {boolean} True if validation is succesfull; otherwise false
 */
function verifyBabyJub(publicKeyHex, messStr, signatureHex) {
    const pkBuff = Buffer.from(publicKeyHex, "hex");
    const pk = eddsaBabyJub.PublicKey.newFromCompressed(pkBuff);
    const msgBuff = Buffer.from(messStr);
    const hash = utils.hashBuffer(msgBuff);
    const sigBuff = Buffer.from(signatureHex, "hex");
    const sig = eddsaBabyJub.Signature.newFromCompressed(sigBuff);
    return pk.verifyPoseidon(hash, sig);
}

module.exports = {
    BabyJubWallet,
    verifyBabyJub,
};
