/* eslint-disable no-console */
/* eslint-disable no-use-before-define */
/* eslint-disable no-shadow */
const fs = require('fs');
const Web3 = require('web3');
const ethers = require('ethers');

const configDefault = './config.json';

const {
    register, registerWithDifferentBeneficiary, registerRelay, unregister, withdraw, getEtherBalance,
} = require('./src/utils');
const { getSeedFromPrivKey, loadHashChain } = require('../rollup-utils/rollup-utils');
const { error } = require('./src/list-errors');

const version = '0.0.1';
const { argv } = require('yargs') // eslint-disable-line
    .version(version)
    .usage(`
cli-pos <command> <options>

register command
================
    cli-pos register <options>
        register new operator
    --wallet or -w <path>
        Wallet path
    --passphrase or -p <passphrase string>
        Passphrase to decrypt the wallet
    --gaslimit or -gl <number>
        Gas limit at the time to send a transaction
    --gasmultiplier or -gm <number>
        Gas price used = default gas price * gasmultiplier
    --stake or -s <num>
        Amount to Stake
    --url or -u <url string>
        Operator URL
    --beneficiary or -b <address> (optional)
        Beneficiary address
    --controller or -c <address> (optional)
        Controller address

unregister command
================
    cli-pos unregister <options>
        unregister operator
    --wallet or -w <path>
        Wallet path
    --passphrase or -p <passphrase string>
        Passphrase to decrypt the wallet
    --gaslimit or -gl <number>
        Gas limit at the time to send a transaction
    --gasmultiplier or -gm <number>
        GasPrice used = default gas price * gasmultiplier
    --id or -i <ID>
        Operator ID

withdraw command
================
    cli-pos withdraw <options>
        withdraw ether (after unregister)
    --wallet or -w <path>
        Wallet path
    --passphrase or -p <passphrase string>
        Passphrase to decrypt the wallet
    --gaslimit or -gl <number>
        Gas limit at the time to send a transaction
    --gasmultiplier or -gm <number>
        GasPrice used = default gas price * gasmultiplier
    --id or -i <ID>
        Operator ID

balance command
================
    cli-pos balance <options>
        get balance operator
    --wallet or -w <path>
        Wallet path
    --passphrase or -p <passphrase string>
        Passphrase to decrypt the wallet
    `)
    .alias('w', 'wallet')
    .alias('p', 'passphrase')
    .alias('s', 'stake')
    .alias('u', 'url')
    .alias('i', 'id')
    .alias('gl', 'gaslimit')
    .alias('gm', 'gasmultiplier')
    .alias('b', 'beneficiary')
    .alias('c', 'controller')
    .alias('f', 'fileconfig')
    .epilogue('Rollup operator cli tool');

const config = (argv.fileconfig) ? argv.fileconfig : 'noconfig';
const pathWallet = (argv.wallet) ? argv.wallet : 'nowallet';
const passString = (argv.passphrase) ? argv.passphrase : 'nopassphrase';
const stake = (argv.stake) ? argv.stake : 'nostake';
const url = (argv.url) ? argv.url : 'nourl';
const opId = (argv.id || argv.id === 0) ? argv.id : -1;
const beneficiary = (argv.beneficiary) ? argv.beneficiary : 'nobeneficiary';
const controller = (argv.controller) ? argv.controller : 'nocontroller';
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
        // register
        if (argv._[0] === undefined) {
            console.log('Invalid command');
            throw new Error(error.INVALID_COMMAND);
        } else if (argv._[0].toUpperCase() === 'REGISTER') {
            checkParamsRegister(actualConfig);
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
            const seed = getSeedFromPrivKey(wallet.privateKey);
            const hashChain = loadHashChain(seed);
            let txSigned;
            if (controller === 'nocontroller' && beneficiary === 'nobeneficiary') {
                txSigned = await register(hashChain[hashChain.length - 1], wallet, actualConfig, gasLimit,
                    gasMultiplier, stake, url);
            } else if (controller === 'nocontroller' && beneficiary !== 'nobeneficiary') {
                txSigned = await registerWithDifferentBeneficiary(hashChain[hashChain.length - 1], wallet, actualConfig, gasLimit,
                    gasMultiplier, stake, url, beneficiary);
            } else if (controller !== 'nocontroller' && beneficiary !== 'nobeneficiary') {
                txSigned = await registerRelay(hashChain[hashChain.length - 1], wallet, actualConfig, gasLimit,
                    gasMultiplier, stake, url, beneficiary, controller);
            } else {
                console.log('Invalid command');
                throw new Error(error.INVALID_COMMAND);
            }

            sendTx(txSigned.rawTransaction, actualConfig.nodeUrl);
        // unregister
        } else if (argv._[0].toUpperCase() === 'UNREGISTER') {
            checkParamsUnregister(actualConfig);
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
            const txSigned = await unregister(opId, wallet, actualConfig, gasLimit, gasMultiplier);
            sendTx(txSigned.rawTransaction, actualConfig.nodeUrl);
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
            const txSigned = await withdraw(opId, wallet, actualConfig, gasLimit, gasMultiplier);
            sendTx(txSigned.rawTransaction, actualConfig.nodeUrl);
        } else if (argv._[0].toUpperCase() === 'BALANCE') {
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
        console.log(err.message);
        console.log(Object.keys(error)[err.message]);
        process.exit(err.message);
    }
})();

function checkParamsRegister(actualConfig) {
    checkParam(pathWallet, 'nowallet', 'wallet');
    checkParam(passString, 'nopassphrase', 'password');
    checkParam(stake, 'nostake', 'stake');
    checkParam(url, 'nourl', 'url operator');
    checkParam(actualConfig.posAddress, undefined, 'posAddress');
    checkParam(actualConfig.posAbi, undefined, 'posAbi');
    checkParam(actualConfig.nodeUrl, undefined, 'node URL');
}

function checkParamsUnregister(actualConfig) {
    checkParam(opId, -1, 'operator id');
    checkParam(pathWallet, 'nowallet', 'wallet');
    checkParam(passString, 'nopassphrase', 'password');
    checkParam(actualConfig.posAddress, undefined, 'posAddress');
    checkParam(actualConfig.posAbi, undefined, 'posAbi');
    checkParam(actualConfig.nodeUrl, undefined, 'node URL');
}

function checkParamsWithdraw(actualConfig) {
    checkParam(opId, -1, 'operator id');
    checkParam(pathWallet, 'nowallet', 'wallet');
    checkParam(passString, 'nopassphrase', 'password');
    checkParam(actualConfig.posAddress, undefined, 'posAddress');
    checkParam(actualConfig.posAbi, undefined, 'posAbi');
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
