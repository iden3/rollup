const { Wallet } = require('../src/wallet');
const { argv } = require('yargs'); // eslint-disable-line
const fs = require('fs');
const { depositTx, sendTx } = require('../src/cli-utils');
const configjson = '../src/resources/config.json';

(async () => {
  let actualConfig = {};
  try {
    if (fs.existsSync(configjson)) {
      actualConfig = JSON.parse(fs.readFileSync(configjson, 'utf8'));
    } else {
      throw new Error('No file config.json');
    }
    const numWallets = argv._[0];
    const numTransOnchain = argv._[1];
    const numTransOffchain = argv._[2];
    let wallets = [];
    const node = actualConfig.nodeEth;
    const urlOperator = actualConfig.operator;
    const address = actualConfig.address;
    const amount = 0.1;
    const tokenid = 0;
    const abi = "../src/resources/rollupabi.js";
    const passString = "foo";
    const to = 1;

    if(numWallets) {
      for(i = 0; i < numWallets; i++){
        wallets[i] = await Wallet.createRandom();
      }
    } else {
      throw new Error('No num wallets submitted');
    }
    if(numTransOnchain) {
      for(i = 0; i < numWallets; i++){
        for(j = 0; j < numTransOnchain; j++) {
          depositTx(node, address, amount, tokenid, wallets[i].ethWallet, passString, wallets[i].babyjubWallet, abi);
        }
      }
    } else {
      throw new Error('No num transactions onChain submitted');
    }
    if(numTransOffchain) {
      for(i = 0; i < numWallets; i++){
        for(j = 0; j < numTransOffchain; j++) {
          sendTx(urlOperator, to, amount, wallets[i].babyjubWallet, passString);
        }
      }
    } else {
      throw new Error('No num transactions offChain submitted')
    }
  } catch (err) {
    console.log(err.stack);
    console.log(`ERROR: ${err}`);
    process.exit(1);
  }
})();
