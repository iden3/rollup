
const ethers = require('ethers');
const fs = require('fs');
const bip39 = require('bip39');
const Web3 = require('web3');
const hdkey = require('hdkey');

const web3 = new Web3();
// const provider = new Web3.providers.HttpProvider("http://localhost:8545");
// const web3 = new Web3(provider);
const iden3 = require('../node_modules/iden3/index');
const eddsa = iden3.crypto.eddsaBabyJub;

/**
 * Function to write a json file
 * @param {Object} txs - Data for json
 * @param {string} path - json path 
 */
async function _writeFile(txs, path) {
  await new Promise((resolve, reject) => {
    fs.writeFile(path, JSON.stringify(txs), 'utf8', (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

/**
 * Function to read a json file
 * @param {Object} path - json path
 * @returns {Object} - Data from json
 */
async function readFile(path) {
  let info;
  await new Promise((resolve) => {
    fs.readFile(path, (err, data) => {
      if (err) throw err;
      info = data;
      resolve(info);
    });
  });
  return JSON.parse(info);
}

/**
 * Function to decrypt encrypted private key
 * @param {Object} encPrivateKey - encrypted private key
 * @param {Object} pass - passphrase
 * @returns {Object} - decrypted private key
 */
function decrypt(encPrivateKey, pass) {
  const decPrivateKey = web3.eth.accounts.decrypt(encPrivateKey, pass);
  return decPrivateKey;
}

/**
 * Function to write a ethereum wallet into json file
 * @param {Object} wallet - Ethereum wallet
 * @param {string} pass - Passphrase
 * @param {string} path - json path
 */
async function _writeFileEthWallet(wallet, pass, path) {
  const pubKey = wallet.signingKey.publicKey;
  const encPrivateKey = web3.eth.accounts.encrypt(wallet.signingKey.privateKey, pass);
  const obj = {};
  obj.pubKey = pubKey;
  obj.encPrivateKey = encPrivateKey;
  obj.mnemonic = wallet.signingKey.mnemonic;
  await _writeFile(obj, path);
}

/**
 * Function to write a babyjub wallet into json file
 * @param {Object} mnemonic
 * @param {string} pass - Passphrase
 * @param {string} path - json path
 */
async function _writeFileBabyJubWallet(mnemonic, pass, path) {
  const seed = bip39.mnemonicToSeedSync(mnemonic);
  const root = hdkey.fromMasterSeed(seed);
  const pathBaby = "m/44'/60'/0'/0/0/0";
  const addrNode = root.derive(pathBaby);
  const priv1 = addrNode._privateKey.toString('hex');
  const privateKey = new eddsa.PrivateKey(addrNode._privateKey);
  const publicKeyHex = privateKey.public().toString();
  const obj = {};
  obj.pubKey = '0x' + publicKeyHex;
  obj.encPrivateKey = web3.eth.accounts.encrypt('0x' + priv1, pass);
  obj.mnemonic = mnemonic;
  await _writeFile(obj, path);
}

/**
 * Function to create ethereum wallet
 * @param {string} pass - Passphrase
 * @param {string} path - json path
 */
async function createEth(pass, path) {
  const mnemonic = bip39.generateMnemonic();
  const wallet = ethers.Wallet.fromMnemonic(mnemonic);
  await _writeFileEthWallet(wallet, pass, path);
}

/**
 * Function to import ethereum wallet
 * @param {menmonic} mnemonic
 * @param {string} pass - Passphrase
 * @param {string} path - json path
 */
async function importEth(mnemonic, pass, path) {
  const wallet = ethers.Wallet.fromMnemonic(mnemonic);
  await _writeFileEthWallet(wallet, pass, path);
}

/**
 * Function to create babyjub wallet
 * @param {string} pass - Passphrase
 * @param {string} path - json path
 */
async function createBabyJub(pass, path) {
  const mnemonic = bip39.generateMnemonic();
  await _writeFileBabyJubWallet(mnemonic, pass, path);
}

/**
 * Function to import babyjub wallet
 * @param {menmonic} mnemonic
 * @param {string} pass - Passphrase
 * @param {string} path - json path
 */
async function importBabyJub(mnemonic, pass, path) {
  await _writeFileBabyJubWallet(mnemonic, pass, path);
}

module.exports = {
  createEth,
  importEth,
  readFile,
  createBabyJub,
  importBabyJub,
  decrypt,
};
