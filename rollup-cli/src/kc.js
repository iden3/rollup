const ethUtil = require('ethereumjs-util');
const nacl = require('tweetnacl');
const bip39 = require('bip39');
const hdkey = require('hdkey');

const iden3 = require('../node_modules/iden3/index');

const { utils } = iden3;
const { KcUtils } = iden3;
const eddsa = iden3.crypto.eddsaBabyJub;

const { errorLockedMsg, errorDbKeyNoExistMsg, mimc7HashBuffer } = KcUtils;

nacl.util = require('tweetnacl-util');

/**
 * KeyContainer generates and stores keys, and allows using them to sign messages.
 * Usage of keys requires the KeyContainer to be unlocked.  Most functions
 * throw new Error(errorLockedMsg) if the KeyContainer is not unlocked.
 */
class KeyContainer {
  constructor(db) {
    this.encryptionKey = '';
    this.prefix = 'kc';
    this.db = db;
    this.timer = {};
  }

  /**
   * Encrypt a string using the key container encryptionKey
   * @param {string} m - message to encrypt
   * @returns {string}
   */
  _encrypt(m) {
    if (!this.isUnlock()) { throw new Error(errorLockedMsg); }
    return KcUtils.encrypt(this.encryptionKey, m);
  }

  /**
   * Decrypt a string using the key container encryptionKey
   * @param {string} c - message to decrypt
   * @returns {string}
   */
  _decrypt(c) {
    if (!this.isUnlock()) {
      throw new Error(errorLockedMsg);
    }
    return KcUtils.decrypt(this.encryptionKey, c);
  }

  /**
   * Get the value of a key in the key container database
   * @param {string} key - database key
   * @returns {string} database value
   */
  _getKey(key) {
    const value = this.db.get(`${this.prefix}/${key}`);
    if (value == null) {
      throw new Error(errorDbKeyNoExistMsg);
    }
    return value;
  }

  /**
   * Get and decrypt the value of a key in the key container database
   * @param {string} key - database key
   * @returns {string} decrypted key
   */
  _getKeyDecrypt(key) {
    if (!this.isUnlock()) {
      throw new Error(errorLockedMsg);
    }
    return this._decrypt(this._getKey(key));
  }

  /**
   * Store and encrypt a value with a key in the key container database
   * @param {string} key - database key
   * @param {string} value - string to encrypt by key parameter
   */
  _setKeyValueEncrypt(key, value) {
    if (!this.isUnlock()) {
      throw new Error(errorLockedMsg);
    }
    const valueEncrypted = this._encrypt(value);
    this.db.insert(`${this.prefix}/${key}`, valueEncrypted);
  }

  /**
   * Retrieve all keys that matches a given string
   * @param {String} key - key to search into key container
   * @returns {Array} - List all the keys that matches the input key parameter
   */
  _listKeys(key) {
    return this.db.listKeys(`${this.prefix}/${key}`);
  }

  /**
   * Deletes a key that matches the input parameter
   * @param {String} key - key to delete
   */
  _deleteKey(key) {
    // localStorage.removeItem(this.prefix + addressHex);
    this.db.delete(`${this.prefix}/${key}`);
  }

  /**
   * Generate keys from mnemonic
   * @param {String} - mnemonic
   */
  _generateKeys(mnemonic) {
    const seed = bip39.mnemonicToSeedSync(mnemonic);
    // same used in Metamask
    const pathDerivation = "m/44'/60'/0'/0/0";
    const root = hdkey.fromMasterSeed(seed);
    // Retrieve ethereum pub key and pub address
    const addrNode = root.derive(pathDerivation);
    const { address } = this.importKey(addrNode._privateKey.toString('hex'));
    // Retrieve private BabyJub
    const kBaby = this.importBabyKey(utils.hashBytes(addrNode._privateKey).toString('hex'));

    return { ethAddress: address, kBabyJub: kBaby };
  }

  /*
   * Unlock key container by the passphrase to use keys
   * @param  {String} passphrase
   */
  unlock(passphrase) {
    // unlock key container
    this.encryptionKey = KcUtils.passToKey(passphrase, 'salt');
    clearTimeout(this.timer);
    const self = this;
    this.timer = setTimeout(() => {
      // key container locked again
      self.encryptionKey = '';
    }, 30000);
  }

  /**
   * Lock key container
   */
  lock() {
    if (!this.encryptionKey) { return; }
    clearTimeout(this.timer);
    // key container locked
    this.encryptionKey = '';
  }

  /**
   * Check if local storage container is unlocked
   * @returns {Bool} - Lock / Unlock
   */
  isUnlock() {
    if (this.encryptionKey) {
      return true;
    }
    return false;
  }

  /**
   * Deletes all key-container keys
   */
  deleteAll() {
    const allKeys = this._listKeys('');
    allKeys.forEach((key) => {
      this._deleteKey(key.replace(`${this.prefix}/`, ''));
    });
  }

  /**
   * Generates master mnemonic
   * @param {String} - Mnemonic to store
   */
  setMasterSeed(mnemonic = bip39.generateMnemonic()) {
    if (!bip39.validateMnemonic(mnemonic)) {
      throw new Error('Mnemonic validation failed');
    }
    if (!this.isUnlock()) {
      throw new Error(errorLockedMsg);
    }
    const seedEncrypted = this._encrypt(mnemonic);
    this.db.insert(`${this.prefix}/masterSeed`, seedEncrypted);
  }

  /**
   * Get master seed
   * @returns {String} Mnemonic representing the master seed
   */
  getMasterSeed() {
    if (!this.isUnlock()) {
      throw new Error(errorLockedMsg);
    }
    return this._getKeyDecrypt('masterSeed');
  }

  /**
   * Creates all the keys needed to create an identity afterwards
   * @returns {Object} - It contains all the keys generated, undefined otherwise
   */
  createKeys() {
    if (!this.isUnlock()) {
      throw new Error(errorLockedMsg);
    }
    // get mnemonic
    const mnemonic = this.getMasterSeed();
    // Creates keys
    return this._generateKeys(mnemonic);
  }

  /**
   * Derives secp256k1 public key and addres from private key and store them
   * @param {String} privateKeyHex - private key in hexadecimal representation
   * @returns {Object} secp256k1 public key and address generate from private key, encoding in hex
   */
  importKey(privateKeyHex) {
    const privateKey = utils.hexToBytes(privateKeyHex);
    const addressHex = ethUtil.privateToAddress(privateKey).toString('hex');
    const publicKeyHex = ethUtil.privateToPublic(privateKey).toString('hex');

    this._setKeyValueEncrypt(`eth-addr/${addressHex}`, privateKeyHex);
    this._setKeyValueEncrypt(`eth-pk/${publicKeyHex}`, privateKeyHex);
    return { publicKey: publicKeyHex, address: addressHex };
  }

  /**
   * Derives baby jub public key and stores it
   * @param {String} privateKeyHex - private key in hexadecimal representation
   * @returns {String} baby jub public key from private key, encoding in hex
   */
  importBabyKey(privateKeyHex) {
    const privateKeyBuffer = utils.hexToBytes(privateKeyHex);
    const privateKey = new eddsa.PrivateKey(privateKeyBuffer);
    const publicKeyHex = privateKey.public().toString();
    this._setKeyValueEncrypt(`bj/${publicKeyHex}`, privateKey.toString());
    return publicKeyHex;
  }

  /**
   * Sign message with secp256k1 key
   * @param {String} addressHex - public address
   * @param {Buffer} message - message to sign
   * @returns {Object} Signature object
   */
  sign(addressHex, message) {
    if (!this.isUnlock()) {
      throw new Error(errorLockedMsg);
    }
    // const privKHexEncrypted = localStorage.getItem(this.prefix + addressHex);
    const privKHex = this._getKeyDecrypt(`eth-addr/${addressHex}`);
    const msgHash = ethUtil.hashPersonalMessage(message);
    const sig = ethUtil.ecsign(msgHash, utils.hexToBytes(privKHex));

    return KcUtils.concatSignature(message, msgHash, sig.v, sig.r, sig.s);
  }

  /**
   * Sign message with babyjub key
   * @param {String} addressHex - public key
   * @param {Buffer} message - message to sign
   * @returns {Signature} Eddsa signature object
   */
  signBaby(publicKeyHex, message) {
    if (!this.isUnlock()) {
      throw new Error(errorLockedMsg);
    }
    const privateKeyHex = this._getKeyDecrypt(`bj/${publicKeyHex}`);
    const privateKey = new eddsa.PrivateKey(Buffer.from(privateKeyHex, 'hex'));
    return privateKey.signMimc7(mimc7HashBuffer(message));
  }
}

module.exports = KeyContainer;
