const fs = require('fs');
const path = require('path');
const ethers = require('ethers');

const { EthereumWallet, verifyEthereum } = require('./src/ethereum-wallet');
const { BabyJubWallet, verifyBabyJub } = require('../rollup-utils/babyjub-wallet');
const { Wallet } = require('./src/wallet');
const { depositTx, sendTx } = require("./src/cli-utils");

const walletPathDefault = './src/wallet.json';
const walletEthPathDefault = './src/ethWallet.json'; // /docs?
const walletBabyjubPathDefault = './src/babyjubWallet.json'; // /docs?
const configJsonDefault = './src/config.json'; // /docs?

const { version } = require('./package');
const { argv } = require('yargs') // eslint-disable-line
  .version(version)
  .usage(`
rollup-cli <command> <options>
createkeys command
=============
  rollup-cli createkeys <option>
    create new wallet for rollup client
  -keytype or --kt [ethereum | babyjubjub | rollup]
    ...
  -path or --p <path>
    Path to store key container
    Default: current path
  -passphrase or --pass <passphrase string>
    Passphrase to encrypt private key
  -mnemonic or --mn <mnemonic>
    ...
  -import or --imp <walletPath>
    ...
printkeys command
=============
  rollup-cli printkeys <options>
  Print public keys
  -path or --p <path>
    Path to JSON file
    
  -keytype [ethereum | babyjubjub]
    Define which wallet type needs to be readed
offchainTx command
=============
  rollup-cli offchaintx <options>
  --operator or -o <operator url>
    Operator url to send the transaction
    
  --wallet or -w <path json>
      
    Path to babyjubjub wallet  
      
    Default: wallet-babyjubjub.json
  --pass <passphrase string>
    Passphrasse to decrypt babyjubjub wallet
  --to <recipient address>
    User identifier on balance tree which will receive the transaction
    
    Note: send to 0 makes a withdraw transaction
  --amount or -a <amount>
    Amount to send or withdraw
  --paramsTx <parameter file>
    Contains all necessary parameters to perform transacction
    Parameters would be different depending on transaction type
    
    Default: config.json
onchainTx command
=============
  rollup-cli onchaintx <options>
    
  --node or -n <node url>
    Provide ethereum node to send transaction
  --address <ethereum address>
    Rollup ethereum smart contract address
    
  --operator <operator url>
    Operator url to retrieve information about current balance tree state
  --type or -t [deposit | depositontop | withdraw | forcewithdraw]
    Defines which transaction should be done
  --wallet or -w <path json>
      
    Path to ethereum wallet  
      
    Default: wallet-ethereum.json
  --pass <passphrase string>
    Passphrasse to decrypt ethereum wallet
  --paramsTx <parameter file>
    Contains all necessary parameters to perform transacction
    Parameters would be different depending on transaction type
    
    Default: config.json
  
  --tokenid <id>
    ...
      
      `)
  .alias('p', 'path')
  .alias('pass', 'passphrase')
  .help('h')
  .alias('h', 'help')
  .alias('t', 'type')
  .alias('kt', 'keytype')
  .alias('w', 'wallet')
  .alias('a', 'amount')
  .alias('o', 'operator')
  .alias('n', 'node')
  .alias('mn', 'mnemonic')
  .alias('we', 'walleteth')
  .alias('wbb', 'walletbabyjub')
  //.alias('import')
  //.alias('address')
  //.alias('to')
  //.alias('from')
  //.alias('param')
  //.alias('v', 'value')
  //.alias('configjson')
  .epilogue('Rollup client cli tool');

const clientRollUp = require('./index.js');

const pathName = (argv.path) ? argv.path : 'nopath';
//const databaseType = (argv.database) ? argv.database : 'levelDb';
const passString = (argv.passphrase) ? argv.passphrase : 'nopassphrase';
const type = (argv.type) ? argv.type : 'notype';
const keytype = (argv.keytype) ? argv.keytype : 'nokeytype';
const to = (argv.to||argv.to==0) ? argv.to : 'norecipient';
//const from = (argv.from) ? argv.from : 'from';
const amount = (argv.amount) ? argv.amount : -1;
const mnemonic = (argv.mnemonic) ? argv.mnemonic : 'nomnemonic';
const importWallet = (argv.import) ? argv.import : 'noimport';
const param = (argv.param) ? argv.param : 'noparam';
const value = (argv.value) ? argv.value : 'novalue';
const configjson = (argv.paramsTx) ? argv.paramsTx : configJsonDefault;
const tokenId = (argv.tokenid||argv.tokenid==0) ? argv.tokenid : 'notokenid';
//const nodeEth = (argv.node) ? argv.node : 'nonode';
//const address = (argv.address) ? argv.address : 'noaddress';
const operator = (argv.operator) ? argv.operator : 'nooperator';
//const walletPath = (argv.wallet) ? argv.wallet : walletPathDefault;
//const walletEthPath = (argv.walleteth) ? argv.walleteth : walletEthPathDefault;
//const walletBabyjubPath = (argv.walletbabyjub) ? argv.walletbabyjub : walletBabyjubPathDefault;

(async () => {
const mnemonic = (argv.mnemonic) ? argv.mnemonic : 'nomnemonic';
const nodeEth = (argv.nodeEth) ? argv.nodeEth : 'nodeEth';
const scAddress = (argv.scAddress) ? argv.scAddress : 'scAddress';
const opRollup = (argv.opRollup) ? argv.opRollup : 'opRollup';
const from = (argv.from) ? argv.from : 'from';

//asd
try {
  var actualConfig = {};
  if (fs.existsSync(configjson)) {
    actualConfig = JSON.parse(fs.readFileSync(configjson, "utf8"));
  }
  //createkeys
  if (argv._[0].toUpperCase() === 'CREATEKEYS') {
    let newWalletPath = pathName;
    let wallet = {};
    let encWallet = {};
    //createkeys ethereum
    if (keytype === 'ethereum') {
      if (passString === 'nopassphrase') {
        console.log('Please provide a passphrase to encrypt keys by:\n\n');
        throw new Error('No passphrase was submitted');
      }else{
        if (pathName === 'nopath') {
          newWalletPath = walletEthPathDefault;
        }
        if (mnemonic !== 'nomnemonic') {
          if (mnemonic.split(" ").length !== 12) {
            console.log('Invalid Menmonic, enter the mnemonic between "" \n\n');
            throw new Error('Invalid Mnemonic');
          } else {
            console.log('create ethereum wallet mnemonic');
            wallet = EthereumWallet.fromMnemonic(mnemonic);
            encWallet = await wallet.toEncryptedJson(passString);
          }
          
        } else if (importWallet !== 'noimport'){
          if (!fs.existsSync(importWallet) || !fs.lstatSync(importWallet).isFile())
          {
            console.log('Path provided dont work:\n\n');
            throw new Error('Path provided dont work');
          }
          console.log('create ethereum wallet import')
          const readWallet = fs.readFileSync(importWallet, "utf8");
          wallet = await EthereumWallet.fromEncryptedJson(readWallet, passString);
          encWallet = await wallet.toEncryptedJson(passString);
        } else {
          console.log('create ethereum wallet random')
          wallet = EthereumWallet.createRandom();
          encWallet = await wallet.toEncryptedJson(passString);
        }
        
        fs.writeFileSync(newWalletPath, JSON.stringify(JSON.parse(encWallet),null,1), "utf-8");
        
        //write in config.json the actual path of created wallet
        actualConfig.walletEth = newWalletPath;
        fs.writeFileSync(configjson, JSON.stringify(actualConfig,null,1), "utf-8");

      //createkeys babyjub
      }
    } else if (keytype === 'babyjub') {
      if (passString === 'nopassphrase') {
        console.log('Please provide a passphrase to encrypt keys by:\n\n');
        throw new Error('No passphrase was submitted');
      }else{
        if (pathName === 'nopath') {
          newWalletPath = walletBabyjubPathDefault;
        }
        if (mnemonic !== 'nomnemonic') {
          console.log('create babyjub wallet mnemonic');
          wallet = BabyJubWallet.fromMnemonic(mnemonic);
          encWallet = wallet.toEncryptedJson(passString);
          console.log(encWallet)
        } else if (importWallet !== 'noimport'){
          if (!fs.existsSync(importWallet) || !fs.lstatSync(importWallet).isFile())
          {
            console.log('Path provided dont work:\n\n');
            throw new Error('Path provided dont work');
          }
          console.log('create babyjub wallet import')
          const readWallet = fs.readFileSync(importWallet, "utf8");
          wallet = BabyJubWallet.fromEncryptedJson(readWallet, passString);
          encWallet = wallet.toEncryptedJson(passString);
        } else {
          console.log('create babyjub wallet random')
          wallet = BabyJubWallet.createRandom();
          encWallet = wallet.toEncryptedJson(passString);
        }
        fs.writeFileSync(newWalletPath, JSON.stringify(JSON.parse(encWallet),null,1), "utf-8");
        //write in config.json the actual path of created wallet
        actualConfig.walletBabyjub = newWalletPath;
        fs.writeFileSync(configjson, JSON.stringify(actualConfig,null,1), "utf-8");
      }
    //createkeys rollup
    } else if (keytype === 'rollup') {
      if (passString === 'nopassphrase') {
        console.log('Please provide a passphrase to encrypt keys by:\n\n');
        throw new Error('No passphrase was submitted');
      }else{
        if (pathName === 'nopath') {
          newWalletPath = walletPathDefault;
        }
        if (mnemonic !== 'nomnemonic') {
          console.log('create rollup wallet mnemonic')
          encWallet = await Wallet.fromMnemonic(mnemonic, passString);
        } else if (importWallet !== 'noimport'){
          if (!fs.existsSync(importWallet) || !fs.lstatSync(importWallet).isFile())
          {
            console.log('Path provided dont work:\n\n');
            throw new Error('Path provided dont work');
          }
          console.log('create rollup wallet import')
          const readWallet = fs.readFileSync(importWallet, "utf8");
          encWallet = await Wallet.fromEncryptedJson(readWallet, passString);
        } else {
          console.log('create rollup wallet random')
          encWallet = await Wallet.createRandom(passString);
        }
        fs.writeFileSync(newWalletPath, JSON.stringify(JSON.parse(encWallet),null,1), "utf-8");
         //write in config.json the actual path of created wallet
         actualConfig.wallet = newWalletPath;
         fs.writeFileSync(configjson, JSON.stringify(actualConfig,null,1), "utf-8");
      }
    } else {
      console.log('Invalid keytype\n\n');
      throw new Error('Invalid keytype');
    }
    process.exit(0);
    //setparam
  } else if (argv._[0].toUpperCase() === 'SETPARAM') {
    
    if (param === 'node' && value !== 'novalue') {
      actualConfig.nodeEth = value;
    }
    else if (param === 'address' && value !== 'novalue') {
      actualConfig.address = value;
    }
    else if (param === 'operator' && value !== 'novalue') {
      actualConfig.operator = value;
    }
    else if (param === 'walletethereum' && value !== 'novalue') {
      actualConfig.walletEth = value;
    }
    else if (param === 'walletbabyjub' && value !== 'novalue') {
      actualConfig.walletBabyjub = value;
    }
    else if (param === 'wallet' && value !== 'novalue') {
      actualConfig.wallet = value;
    }
    else if (param === 'from' && value !== 'novalue') {
      actualConfig.from = value;
    }
    else if (param === 'abi' && value !== 'novalue') {
      actualConfig.abi = value;
    }
    else {
      if (param === 'noparam'){
        console.log('Please provide a param\n\n');
        throw new Error('No param submitted');
      } else if (value === 'novalue') {
        console.log('Please provide a value\n\n');
        throw new Error('No value submitted');
      } else {
        throw new Error('Invalid param');
      }
    }
    fs.writeFileSync(configjson, JSON.stringify(actualConfig,null,1), "utf-8");
    process.exit(0);
  }
  else if (argv._[0].toUpperCase() === 'PRINTKEYS') {
    console.log('The following keys have been found:');
    process.exit(0);
  }
  //onchaintx
  else if (argv._[0].toUpperCase() === 'ONCHAINTX') {
    if (type === 'notype') {
      console.log('It is necessary to specify the type of action\n\n');
      throw new Error('No type was submitted');
    } else if (type === 'deposit') {
      if (passString === 'nopassphrase') {
        console.log('Please provide a passphrase to encrypt keys by:\n\n');
        throw new Error('No passphrase was submitted');
      } else if (amount === -1) {
        console.log('It is necessary to specify amount\n\n');
        throw new Error('No amount was submitted');
      } else if (tokenId === "notokenid") {
        console.log(tokenId)
        console.log('It is necessary to specify token id\n\n');
        throw new Error('No token id was submitted');
      } else if (actualConfig.nodeEth === undefined){
        console.log('It is necessary to specify the node with setparam command\n\n');
        throw new Error('No node was submitted');
      } else if (actualConfig.address === undefined){
        console.log('It is necessary to specify the smart contract address with setparam command\n\n');
        throw new Error('No sc address was submitted');
      } else if (actualConfig.abi === undefined){
        console.log('It is necessary to specify the abi url with setparam command\n\n');
        throw new Error('No abi was submitted');
      } else if (actualConfig.wallet === undefined){
        console.log('It is necessary to specify the wallet url with setparam command\n\n');
        throw new Error('No wallet was submitted');
      } else {
        //console.log("deposit")
        //console.log("urlNode " + actualConfig.nodeEth);
        //console.log("scAddress " + actualConfig.address);
        //console.log("amount " + amount);
        //console.log("token id " + tokenId);
        //console.log("pass " + passString);
        //console.log("url abi " + actualConfig.abi);
        const abi = JSON.parse(fs.readFileSync(actualConfig.abi, "utf8"));
        //console.log("abi " + abi);
        //console.log("url wallet " + actualConfig.wallet);
        const wallet = fs.readFileSync(actualConfig.wallet, "utf8");
        //console.log("wallet " + wallet);
        const walletEth = JSON.stringify(JSON.parse(wallet).ethWallet)
        const walletBabyjub = JSON.stringify(JSON.parse(wallet).babyjubWallet)
        //console.log("wallet Ethereum " + walletEth);
        //console.log("wallet Babyjub " + walletBabyjub);
        await depositTx(actualConfig.nodeEth, actualConfig.address, amount, tokenId, walletEth, passString, walletBabyjub, abi);
      }
    } else {
      throw new Error('Invalid type');
    }
    process.exit(0);
  } else if (argv._[0].toUpperCase() === 'OFFCHAINTX') {
    if (type === 'notype') {
      console.log('It is necessary to specify the type of action\n\n');
      throw new Error('No type was submitted');
    } else if (type === 'send') {
      if (passString === 'nopassphrase') {
        console.log('Please provide a passphrase to encrypt keys by:\n\n');
        throw new Error('No passphrase was submitted');
      } else if (amount === -1) {
        console.log('It is necessary to specify amount\n\n');
        throw new Error('No amount was submitted');
      } else if (to === "norecipient") {
        console.log('It is necessary to specify recipient\n\n');
        throw new Error('No recipient was submitted');
      } else if (actualConfig.wallet === undefined){
        console.log('It is necessary to specify the wallet url with setparam command\n\n');
        throw new Error('No wallet was submitted');
      } else if (actualConfig.operator === undefined){
        console.log('It is necessary to specify the operator url with setparam command\n\n');
        throw new Error('No operator was submitted');
      }  else {
        //console.log("send")
        //console.log("urlOperator " + actualConfig.operator);
        //console.log("from " + actualConfig.from);
        //console.log("to " + to);
        //console.log("amount " + amount);
        //console.log("pass " + passString);
        //console.log("url wallet " + actualConfig.wallet);
        const wallet = fs.readFileSync(actualConfig.wallet, "utf8");
        //console.log("wallet " + wallet);
        const walletBabyjub = JSON.stringify(JSON.parse(wallet).babyjubWallet)
        //console.log("wallet Babyjub " + walletBabyjub);
        await sendTx(actualConfig.operator, to, amount, walletBabyjub, passString);
      }
    } else {
      throw new Error('Invalid type');
    }
    process.exit(0);
  } else {
    throw new Error('Invalid command');
  }
} catch (err) {
  console.log(err.stack);
  console.log(`ERROR: ${err}`);
  process.exit(1)
}
})()