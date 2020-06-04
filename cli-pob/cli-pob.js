/* eslint-disable no-console */
/* eslint-disable no-use-before-define */
/* eslint-disable no-shadow */
const fs = require('fs');
const Web3 = require('web3');
const ethers = require('ethers');

const configDefault = './config.json';

const {
    bid, bidWithDifferentBeneficiary, bidRelay, bidRelayAndWithdrawAddress, withdraw, getEtherBalance,
} = require('./src/utils');
const { error } = require('./src/list-errors');

const version = '0.0.1';
const { argv } = require('yargs') // eslint-disable-line
    .version(version)
    .usage(`
cli-pob <command> <options>

bid command
================
    cli-pob bid <options>
        Single bid to a specific slot
    --wallet or -w <path>
        Wallet path
    --passphrase or -p <passphrase string>
        Passphrase to decrypt the wallet
    --gaslimit or -gl <number>
        Gas limit at the time to send a transaction
    --gasmultiplier or -gm <number>
        Gas price used = default gas price * gasmultiplier
    --amount or -a <num>
        Amount to bid
    --slot or -s <num>
        Slot to place the bid
    --url or -u <url string>
        Operator URL
    --beneficiary or -b <address> (optional)
        Beneficiary address
    --forger or -f <address> (optional)
        Forger address
    --withdraw or -w <address> (optional)
        Withdraw address

withdraw command
================
    cli-pob withdraw <options>
        Withdraw ether
    --wallet or -w <path>
        Wallet path
    --passphrase or -p <passphrase string>
        Passphrase to decrypt the wallet
    --gaslimit or -gl <number>
        Gas limit at the time to send a transaction
    --gasmultiplier or -gm <number>
        GasPrice used = default gas price * gasmultiplier

balance command
================
    cli-pob balance <options>
        get balance operator
    --wallet or -w <path>
        Wallet path
    --passphrase or -p <passphrase string>
        Passphrase to decrypt the wallet

withdrawinfo command
================
    cli-pob balance <options>
        get balance operator
    --wallet or -w <path>
        Wallet path
    --passphrase or -p <passphrase string>
        Passphrase to decrypt the wallet
    `)
    .alias('w', 'wallet')
    .alias('p', 'passphrase')
    .alias('a', 'amount')
    .alias('u', 'url')
    .alias('s', 'slot')
    .alias('gl', 'gaslimit')
    .alias('gm', 'gasmultiplier')
    .alias('b', 'beneficiary')
    .alias('f', 'forger')
    .alias('w', 'whitdraw')
    .alias('f', 'fileconfig')
    .alias('wi', 'withdrawinfo')
    .epilogue('Rollup operator cli tool');

const config = (argv.fileconfig) ? argv.fileconfig : 'noconfig';
const pathWallet = (argv.wallet) ? argv.wallet : 'nowallet';
const passString = (argv.passphrase) ? argv.passphrase : 'nopassphrase';
const bidValue = (argv.amount) ? argv.amount : 'noamount';
const slot = (argv.slot) ? argv.slot : 'noslot';
const url = (argv.url) ? argv.url : 'nourl';
const beneficiaryAddress = (argv.beneficiary) ? argv.beneficiary : 'nobeneficiary';
const forgerAddress = (argv.forger) ? argv.forger : 'nofoger';
const withdrawAddress = (argv.withdraw) ? argv.withdraw : 'nowithdraw';
const gasLimit = (argv.gaslimit) ? argv.gaslimit : 5000000;
const gasMultiplier = (argv.gasmultiplier) ? argv.gasmultiplier : 1;

(async () => {
    let actualConfig = {};
    try {
        let pathConfig;
        if (config === 'noconfig') {
            pathConfig = configDefault;
        } else {
            pathConfig = config;
        }
        if (fs.existsSync(pathConfig)) {
            actualConfig = JSON.parse(fs.readFileSync(pathConfig, 'utf8'));
        } else {
            console.log('No config file\n\n');
            throw new Error(error.NO_CONFIG_FILE);
        }
        if (argv._[0] === undefined) {
            console.log('Invalid command');
            throw new Error(error.INVALID_COMMAND);
        // bid
        } else if (argv._[0].toUpperCase() === 'BID') {
            checkParamsBid(actualConfig);
            let wallet = {};
            if (!fs.existsSync(pathWallet) || !fs.lstatSync(pathWallet).isFile()) {
                console.log('Path provided does not work\n\n');
                throw new Error(error.INVALID_PATH);
            }
            try {
                const readWallet = await fs.readFileSync(pathWallet, 'utf8');
                wallet = await ethers.Wallet.fromEncryptedJson(readWallet, passString);
            } catch (err) {
                throw new Error(error.INVALID_WALLET);
            }
            let txSigned;
            if (beneficiaryAddress !== 'nobeneficiary' && forgerAddress !== 'noforger' && withdrawAddress !== 'nowithdraw') {
                txSigned = await bidRelayAndWithdrawAddress(wallet, actualConfig, slot, url,
                    bidValue, beneficiaryAddress, forgerAddress, withdrawAddress, gasLimit, gasMultiplier);
            } else if (beneficiaryAddress !== 'nobeneficiary' && forgerAddress !== 'noforger') {
                txSigned = await bidRelay(wallet, actualConfig, slot, url,
                    bidValue, beneficiaryAddress, forgerAddress, gasLimit, gasMultiplier);
            } else if (beneficiaryAddress !== 'nobeneficiary') {
                txSigned = await bidWithDifferentBeneficiary(wallet, actualConfig, slot, url,
                    bidValue, beneficiaryAddress, gasLimit, gasMultiplier);
            } else {
                txSigned = await bid(wallet, actualConfig, slot, url, bidValue, gasLimit, gasMultiplier);
            }

            sendTx(txSigned.rawTransaction, actualConfig.nodeUrl);
        // withdraw
        } else if (argv._[0].toUpperCase() === 'WITHDRAW') {
            checkParamsWithdraw(actualConfig);
            let wallet = {};
            if (!fs.existsSync(pathWallet) || !fs.lstatSync(pathWallet).isFile()) {
                console.log('Path provided does not work\n\n');
                throw new Error(error.INVALID_PATH);
            }
            try {
                const readWallet = await fs.readFileSync(pathWallet, 'utf8');
                wallet = await ethers.Wallet.fromEncryptedJson(readWallet, passString);
            } catch (err) {
                console.log(err);
                throw new Error(error.INVALID_WALLET);
            }

            const txSigned = await withdraw(wallet, actualConfig, gasLimit, gasMultiplier);
            sendTx(txSigned.rawTransaction, actualConfig.nodeUrl);
        // check balance
        } else if (argv._[0].toUpperCase() === 'BALANCE') {
            checkParamsBalance(actualConfig);
            let wallet = {};
            if (!fs.existsSync(pathWallet) || !fs.lstatSync(pathWallet).isFile()) {
                console.log('Path provided does not work\n\n');
                throw new Error(error.INVALID_PATH);
            }
            try {
                const readWallet = await fs.readFileSync(pathWallet, 'utf8');
                wallet = await ethers.Wallet.fromEncryptedJson(readWallet, passString);
            } catch (err) {
                console.log(err);
                throw new Error(error.INVALID_WALLET);
            }
            const res = await getEtherBalance(wallet, actualConfig);
            console.log(res);
        } else {
            console.log('Invalid command');
            throw new Error(error.INVALID_COMMAND);
        }
    } catch (err) {
        console.log(err);
        console.log(err.message);
        console.log(Object.keys(error)[err.message]);
        process.exit(err.message);
    }
})();

function checkParamsBid(actualConfig) {
    checkParam(pathWallet, 'nowallet', 'wallet');
    checkParam(passString, 'nopassphrase', 'password');
    checkParam(bidValue, 'noamount', 'amount');
    checkParam(url, 'nourl', 'url operator');
    checkParam(slot, 'noslot', 'slot');
    checkParam(actualConfig.pobAddress, undefined, 'pobAddress');
    checkParam(actualConfig.pobAbi, undefined, 'pobAbi');
    checkParam(actualConfig.nodeUrl, undefined, 'node URL');
}

function checkParamsWithdraw(actualConfig) {
    checkParam(pathWallet, 'nowallet', 'wallet');
    checkParam(passString, 'nopassphrase', 'password');
    checkParam(actualConfig.pobAddress, undefined, 'pobAddress');
    checkParam(actualConfig.pobAbi, undefined, 'pobAbi');
    checkParam(actualConfig.nodeUrl, undefined, 'node URL');
}

function checkParamsBalance(actualConfig) {
    checkParam(pathWallet, 'nowallet', 'wallet');
    checkParam(passString, 'nopassphrase', 'password');
    checkParam(actualConfig.nodeUrl, undefined, 'node URL');
}

function checkParam(param, def, name) {
    if (param === def) {
        console.log(`It is necessary to specify ${name}\n\n`);
        throw new Error(error.NO_PARAM);
    }
}

function sendTx(rawTransaction, nodeUrl) {
    const web3 = new Web3(new Web3.providers.HttpProvider(nodeUrl));
    web3.eth.sendSignedTransaction(rawTransaction)
        .once('transactionHash', (txHash) => {
            console.log('Transaction hash: ', txHash);
        });
}
