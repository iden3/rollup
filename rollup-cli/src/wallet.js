const Web3 = require('web3');
const provider = new Web3.providers.HttpProvider("http://localhost:8545");
const web3 = new Web3(provider);

const ethers = require('ethers');
const fs = require('fs');

//https://docs.moneybutton.com/docs/bsv-mnemonic.html
var Mnemonic = require('bsv/mnemonic')

export class Wallet {
  writeFile(txs) {
      fs.writeFile('wallet-rollup-cli.json', JSON.stringify(txs), 'utf8', (err) => {
          if (err) throw err;
          console.log('The file has been saved')
      })
  }

  readFile() {
      let a = fs.readFileSync('wallet-rollup-cli.json')
      let a2 = JSON.parse(a);
      console.log(a2)
  }

  create(pass) {
      var mnemonic = Mnemonic.fromRandom();
      const wallet = ethers.Wallet.fromMnemonic(mnemonic.toString());
      pubKey = wallet.signingKey.publicKey;
      encPrivateKey = web3.eth.accounts.encrypt(wallet.signingKey.privateKey, pass).crypto.ciphertext;
      const txs = {}
      txs[pubKey] = encPrivateKey;
      txs['mnemonic'] = wallet.signingKey.mnemonic;
      writeFile(txs)
  }

  importEth(mnemonic, pass) {
      const wallet = ethers.Wallet.fromMnemonic(mnemonic);
      pubKey = wallet.signingKey.publicKey;
      encPrivateKey = web3.eth.accounts.encrypt(wallet.signingKey.privateKey, pass).crypto.ciphertext;
      const txs = {}
      txs[pubKey] = encPrivateKey;
      txs['mnemonic'] = wallet.signingKey.mnemonic;
      writeFile(txs)
  }
}

module.exports = Wallet;

//create('hola')
//importEth('alley topic basic obscure hotel trust concert loyal design second this oxygen', 'hola')
//readFile()
//create('hola');