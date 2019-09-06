const bip39 = require('bip39');
const hdkey = require('hdkey');
const eddsaBabyJub = require('./eddsa-babyjub');

/**
 * Use to create babyjub private/public keys following the next rules:
 * path to create babyjubjub keys is the next path used to generate ethereum keys
 * Ethereum common path --> "m/44'/60'/0'/0/0"
 * BabyJubJub derived key --> "m/44'/60'/0'/0/0/{BabyJubJub path}"
 */

class BabyJubJubHdKeys {
  /**
   * Create a babyjubjub hdwallet froma given mnemonic
   * @return {BabyJubJubHDWallet} mnemonic Babyjubjub hd wallet class
   */
  static fromMnemonic(mnemonic) {
    return new BabyJubJubHdKeys(mnemonic);
  }

  /**
   * Create a random babyjubjub hdwallet
   * @return {BabyJubJubHdKeys} mnemonic Babyjubjub hd wallet class
   */
  static fromRandom() {
    const randMnemonic = bip39.generateMnemonic();
    return new BabyJubJubHdKeys(randMnemonic);
  }

  /**
   * Create babyjubjub hdwallet from a mnemonic
   * @param {String} mnemonic - mnemonic
   * @param {String} rootPath - path to start derive babyjubjub keys
   */
  constructor(mnemonic, rootPath = "m/44'/60'/0'/0/0") {
    const seed = bip39.mnemonicToSeedSync(mnemonic);
    this.root = hdkey.fromMasterSeed(seed);
    this.rootPath = rootPath;
  }

  /**
   * Get babyjub private key
   * @param {Number} index - path to generate private key
   */
  getPrivate(index) {
    const node = this.root.derive(`${this.rootPath}/${index}`);
    return node.privateKey;
  }

  /**
   * Get babyjub public key
   * @param {Number} index - path to generate public key
   * @param {Bool | Array[BigInt]} compress - return public key compressed
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
