
const ethers = require('ethers');
const fs = require('fs');
const bip39 = require('bip39');
const Web3 = require('web3');

const web3 = new Web3();
// const provider = new Web3.providers.HttpProvider("http://localhost:8545");
// const web3 = new Web3(provider);
/* const iden3 = require('../node_modules/iden3/index');
const eddsa = iden3.crypto.eddsaBabyJub; */

function _writeFile(txs) {
  fs.writeFile('wallet-rollup-cli.json', JSON.stringify(txs), 'utf8', (err) => {
    if (err) throw err;
  });
}

function _writeFileEthWallet(wallet, pass) { 
  const pubKey = wallet.signingKey.publicKey;
  const encPrivateKey = web3.eth.accounts.encrypt(wallet.signingKey.privateKey, pass);
  const obj = {};
  obj.pubKey = pubKey;
  obj.encPrivateKey = encPrivateKey;
  obj.mnemonic = wallet.signingKey.mnemonic;
  _writeFile(obj);
}
/* function readFile() {
  fs.readFile('wallet-rollup-cli.json', (err, data) => {
    if (err) throw err;
    return JSON.parse(data);
  })
} */

async function readFile() {
  let info;
  await new Promise((resolve) => {
    fs.readFile('wallet-rollup-cli.json', (err, data) => {
      if (err) throw err;
      info = data;
      resolve(info);
    });
  });
  return JSON.parse(info);
}

function createEth(pass) {
  const mnemonic = bip39.generateMnemonic();
  const wallet = ethers.Wallet.fromMnemonic(mnemonic);
  _writeFileEthWallet(wallet, pass);
}

function importEth(mnemonic, pass) {
  const wallet = ethers.Wallet.fromMnemonic(mnemonic);
  _writeFileEthWallet(wallet, pass);
}

module.exports = { createEth, importEth, readFile };

/* function createBabyJub(pass) {
}
function importBabyJub(mnemonic, pass) {
} */
// createEth('hola')
// importEth('alley topic basic obscure hotel trust concert loyal design second this oxygen', 'hola')
// readFile()
