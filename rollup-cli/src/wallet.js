
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

async function _writeFile(txs) {
  await new Promise((resolve, reject) => {
    fs.writeFile('wallet-rollup-cli.json', JSON.stringify(txs), 'utf8', (err) => {
      if (err) reject(err)
      else resolve()
    })
  })
}

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

async function _writeFileEthWallet(wallet, pass) { 
  const pubKey = wallet.signingKey.publicKey;
  const encPrivateKey = web3.eth.accounts.encrypt(wallet.signingKey.privateKey, pass);
  const obj = {};
  obj.pubKey = pubKey;
  obj.encPrivateKey = encPrivateKey;
  obj.mnemonic = wallet.signingKey.mnemonic;
  await _writeFile(obj);
}

async function _writeFileBabyJubWallet(mnemonic, pass) { 
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
  await _writeFile(obj)
}

async function createEth(pass) {
  const mnemonic = bip39.generateMnemonic();
  const wallet = ethers.Wallet.fromMnemonic(mnemonic);
  await _writeFileEthWallet(wallet, pass);
}

async function importEth(mnemonic, pass) {
  const wallet = ethers.Wallet.fromMnemonic(mnemonic);
  await _writeFileEthWallet(wallet, pass);
}

async function createBabyJub(pass) {
  const mnemonic = bip39.generateMnemonic();
  await _writeFileBabyJubWallet(mnemonic, pass);
}

async function importBabyJub(mnemonic, pass) {
  await _writeFileBabyJubWallet(mnemonic, pass);
} 

module.exports = { createEth, importEth, readFile, createBabyJub, importBabyJub };
