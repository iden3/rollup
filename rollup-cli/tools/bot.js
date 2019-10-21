const { argv } = require('yargs').alias('t', 'tokens').alias('mn', 'mnemonic').alias('p', 'path')
    .alias('e', 'ether')
    .alias('w', 'wallets')
    .alias('d', 'deposits')
    .alias('s', 'sends');
const fs = require('fs');

const configjsonBot = '../tools/resourcesBot/configBot.json';
const ethers = require('ethers');
const { Wallet } = require('../src/wallet');
const { createWallets } = require('./helpers/createWallets');
const { walletsDeposit } = require('./helpers/walletsDeposit');
const { walletsSend } = require('./helpers/walletsSend');

(async () => {
    let configBot = {};
    try {
        if (fs.existsSync(configjsonBot)) {
            configBot = JSON.parse(fs.readFileSync(configjsonBot, 'utf8'));
        } else {
            throw new Error('No file configBOT.json');
        }
        const node = configBot.nodeEth;
        const urlOperator = configBot.operator;
        const { addressTokens } = configBot;
        const { addressRollup } = configBot;
        const abiRollupPath = configBot.abiRollup;

        const abiTokens = JSON.parse(fs.readFileSync(configBot.abiTokens, 'utf8'));
        const passString = 'foo';
        const walletRollupFunder = await Wallet.fromEncryptedJson(JSON.parse(fs.readFileSync(configBot.walletFunder, 'utf8')), passString);
        const walletEthFunder = walletRollupFunder.ethWallet.wallet;

        const pathNewWallets = (argv.path) ? argv.path : '../tools/resourcesBot/wallets';
        const mnemonic = (argv.mnemonic) ? argv.mnemonic : 0;
        const amountEther = (argv.ether) ? ethers.utils.parseEther(argv.ether) : ethers.utils.parseEther('2.0'); // 0.2- for Tx (aprox)
        const amountToken = (argv.tokens) ? argv.tokens : 10;
        const tokenId = (argv.tokenid) ? argv.tokenid : 0;
        const numWallets = (argv.wallets) ? argv.wallets : 4;
        const numTransOnchain = (argv.deposits) ? argv.deposit : 1;
        const numTransOffchain = (argv.sends) ? argv.send : 1;
        const userfee = (argv.fee) ? argv.fee : 1;

        if (argv._[0].toUpperCase() === 'CREATEWALLETS') {
            // create, and fund wallets with ethers and tokens, also approve (allowance) the rollup SC use the wallets tokens.
            await createWallets(numWallets, amountToken, passString, addressRollup, walletEthFunder, amountEther,
                addressTokens, abiTokens, node, pathNewWallets, mnemonic);
        }
        if (argv._[0].toUpperCase() === 'DEPOSIT') {
            await walletsDeposit(numTransOnchain, amountToken, passString, addressRollup, abiRollupPath, node, tokenId, pathNewWallets);
        }
        if (argv._[0].toUpperCase() === 'SEND') {
            await walletsSend(numTransOffchain, amountToken, passString, urlOperator, userfee, tokenId, pathNewWallets);
        }
        if (argv._[0].toUpperCase() === 'DOALL') {
            await createWallets(numWallets, amountToken, passString, addressRollup, walletEthFunder, amountEther,
                addressTokens, abiTokens, node, pathNewWallets, mnemonic);
            await walletsDeposit(numTransOnchain, amountToken, passString, addressRollup, abiRollupPath, node, tokenId, pathNewWallets);
            await walletsSend(numTransOffchain, amountToken, passString, urlOperator, userfee, tokenId, pathNewWallets);
        }
    } catch (err) {
        process.exit(1);
    }
})();
