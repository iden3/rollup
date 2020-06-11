/* eslint-disable no-console */
/* eslint-disable no-use-before-define */
/* eslint-disable no-shadow */
const fs = require('fs');
const readline = require('readline');
const { Writable } = require('stream');
const Web3 = require('web3');
const ethers = require('ethers');

const configDefault = './config.json';

const {
    bid, bidWithDifferentBeneficiary, bidRelay, bidRelayAndWithdrawAddress, bidWithDifferentAddresses,
    multiBid, withdraw, getEtherBalance,
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
    --configpath or -c <path>
        Path of your configuration file with wallet path
        Default: config.json
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
    --forger or -fr <address> (optional)
        Forger address
    --withdrawaddress or --wd <address> (optional)
        Withdraw address
    --bonusaddress or --bo <address> (optional)
        Bonus address
    --usebonus or --ub <boolean> (optional)
        Bonus address (true | false)

multibid command
================
    cli-pob multibid <options>
        Multibid to a specifics slots
    --wallet or -w <path>
        Wallet path
    --configpath or -c <path>
        Path of your configuration file with wallet path
        Default: config.json
    --gaslimit or --gl <number>
        Gas limit at the time to send a transaction
    --gasmultiplier or --gm <number>
        Gas price used = default gas price * gasmultiplier
    --amount or -a <num>
        Amount to bids (example: 1,2,3)
    --slot or -s <num>
        Slots to place the bids (example: 19-21,23-26,27-29)
    --url or -u <url string>
        Operator URL

withdraw command
================
    cli-pob withdraw <options>
        Withdraw ether
    --wallet or -w <path>
        Wallet path
    --configpath or -c <path>
        Path of your configuration file with wallet path
        Default: config.json
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

withdrawinfo command
================
    cli-pob balance <options>
        get balance operator
    --wallet or -w <path>
        Wallet path
    `)
    .alias('w', 'wallet')
    .alias('a', 'amount')
    .alias('u', 'url')
    .alias('s', 'slot')
    .alias('gl', 'gaslimit')
    .alias('gm', 'gasmultiplier')
    .alias('b', 'beneficiary')
    .alias('f', 'forger')
    .alias('wd', 'withdrawaddress')
    .alias('c', 'configpath')
    .alias('wi', 'withdrawinfo')
    .alias('ub', 'usebonus')
    .alias('bo', 'bonusaddress')
    .epilogue('Rollup operator cli tool');

const config = (argv.configpath) ? argv.configpath : 'noconfig';
const pathWallet = (argv.wallet) ? argv.wallet : 'nowallet';
const bidValue = (argv.amount) ? argv.amount : 'noamount';
const slot = (argv.slot) ? argv.slot : 'noslot';
const url = (argv.url) ? argv.url : 'nourl';
const beneficiaryAddress = (argv.beneficiary) ? argv.beneficiary : 'nobeneficiary';
const forgerAddress = (argv.forger) ? argv.forger : 'noforger';
const withdrawAddress = (argv.withdrawaddress) ? argv.withdrawaddress : 'nowithdrawaddress';
const bonusAddress = (argv.bonusaddress) ? argv.bonusaddress : 'nobonusaddress';
const useBonus = (argv.usebonus) ? argv.usebonus : false;
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
            const passphrase = await getPassword();
            try {
                const readWallet = await fs.readFileSync(pathWallet, 'utf8');
                wallet = await ethers.Wallet.fromEncryptedJson(readWallet, passphrase);
            } catch (err) {
                throw new Error(error.INVALID_WALLET);
            }
            let txSigned;
            if (beneficiaryAddress !== 'nobeneficiary' && forgerAddress !== 'noforger' && withdrawAddress !== 'nowithdrawaddress'
                && bonusAddress !== 'nobonusaddress') {
                let useBonusBool = false;
                if (useBonus === 'true') {
                    useBonusBool = true;
                }
                txSigned = await bidWithDifferentAddresses(wallet, actualConfig, slot, url, bidValue, beneficiaryAddress,
                    forgerAddress, withdrawAddress, bonusAddress, useBonusBool, gasLimit, gasMultiplier);
                console.log('Beneficiary Address: ', beneficiaryAddress);
                console.log('Forger Address: ', forgerAddress);
                console.log('Withdraw Address: ', withdrawAddress);
                console.log('Bonus Address: ', bonusAddress);
            } else if (beneficiaryAddress !== 'nobeneficiary' && forgerAddress !== 'noforger' && withdrawAddress !== 'nowithdrawaddress') {
                txSigned = await bidRelayAndWithdrawAddress(wallet, actualConfig, slot, url,
                    bidValue, beneficiaryAddress, forgerAddress, withdrawAddress, gasLimit, gasMultiplier);
                console.log('Beneficiary Address: ', beneficiaryAddress);
                console.log('Forger Address: ', forgerAddress);
                console.log('Withdraw Address: ', withdrawAddress);
                console.log('Bonus Address: ', wallet.address);
            } else if (beneficiaryAddress !== 'nobeneficiary' && forgerAddress !== 'noforger') {
                txSigned = await bidRelay(wallet, actualConfig, slot, url,
                    bidValue, beneficiaryAddress, forgerAddress, gasLimit, gasMultiplier);
                console.log('Beneficiary Address: ', beneficiaryAddress);
                console.log('Forger Address: ', forgerAddress);
                console.log('Withdraw & Bonus Address: ', wallet.address);
            } else if (beneficiaryAddress !== 'nobeneficiary') {
                txSigned = await bidWithDifferentBeneficiary(wallet, actualConfig, slot, url,
                    bidValue, beneficiaryAddress, gasLimit, gasMultiplier);
                console.log('Beneficiary Address: ', beneficiaryAddress);
                console.log('Forger & Withdraw & Bonus Address: ', wallet.address);
            } else {
                txSigned = await bid(wallet, actualConfig, slot, url, bidValue, gasLimit, gasMultiplier);
                console.log('Forger & Beneficiary & Withdraw & Bonus Address: ', wallet.address);
            }
            await sendTx(txSigned.rawTransaction, actualConfig.nodeUrl);
            process.exit(0);
        // multibid
        } else if (argv._[0].toUpperCase() === 'MULTIBID') {
            checkParamsBid(actualConfig);
            let wallet = {};
            if (!fs.existsSync(pathWallet) || !fs.lstatSync(pathWallet).isFile()) {
                console.log('Path provided does not work\n\n');
                throw new Error(error.INVALID_PATH);
            }
            const passphrase = await getPassword();
            try {
                const readWallet = await fs.readFileSync(pathWallet, 'utf8');
                wallet = await ethers.Wallet.fromEncryptedJson(readWallet, passphrase);
            } catch (err) {
                throw new Error(error.INVALID_WALLET);
            }
            let rangeBid = [];
            try {
                rangeBid = bidValue.split(',');
            } catch (err) {
                rangeBid.push(bidValue);
            }
            const rangeSlot = [];
            let rangeSlotAux = [];
            try {
                rangeSlotAux = slot.split(',');
            } catch (err) {
                rangeSlot.push(slot);
            }
            for (let i = 0; i < rangeSlotAux.length; i++) {
                const auxSlot = rangeSlotAux[i].split('-');
                if (auxSlot.length === 2) {
                    rangeSlot.push(auxSlot);
                } else if (auxSlot.length === 1) {
                    rangeSlot.push([rangeSlotAux[i], rangeSlotAux[i]]);
                } else {
                    throw new Error(error.ERROR);
                }
            }
            const txSigned = await multiBid(wallet, actualConfig, rangeSlot, url, rangeBid, gasLimit, gasMultiplier);
            await sendTx(txSigned.rawTransaction, actualConfig.nodeUrl);
            process.exit(0);
        // withdraw
        } else if (argv._[0].toUpperCase() === 'WITHDRAW') {
            checkParamsWithdraw(actualConfig);
            let wallet = {};
            if (!fs.existsSync(pathWallet) || !fs.lstatSync(pathWallet).isFile()) {
                console.log('Path provided does not work\n\n');
                throw new Error(error.INVALID_PATH);
            }
            const passphrase = await getPassword();
            try {
                const readWallet = await fs.readFileSync(pathWallet, 'utf8');
                wallet = await ethers.Wallet.fromEncryptedJson(readWallet, passphrase);
            } catch (err) {
                console.log(err);
                throw new Error(error.INVALID_WALLET);
            }

            const txSigned = await withdraw(wallet, actualConfig, gasLimit, gasMultiplier);
            await sendTx(txSigned.rawTransaction, actualConfig.nodeUrl);
            process.exit(0);
        // check balance
        } else if (argv._[0].toUpperCase() === 'BALANCE') {
            checkParamsBalance(actualConfig);
            let wallet = {};
            if (!fs.existsSync(pathWallet) || !fs.lstatSync(pathWallet).isFile()) {
                console.log('Path provided does not work\n\n');
                throw new Error(error.INVALID_PATH);
            }
            const passphrase = await getPassword();
            try {
                const readWallet = await fs.readFileSync(pathWallet, 'utf8');
                wallet = await ethers.Wallet.fromEncryptedJson(readWallet, passphrase);
            } catch (err) {
                console.log(err);
                throw new Error(error.INVALID_WALLET);
            }
            const res = await getEtherBalance(wallet, actualConfig);
            console.log(res);
            process.exit(0);
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
    checkParam(bidValue, 'noamount', 'amount');
    checkParam(url, 'nourl', 'url operator');
    checkParam(slot, 'noslot', 'slot');
    checkParam(actualConfig.pobAddress, undefined, 'pobAddress');
    checkParam(actualConfig.pobAbi, undefined, 'pobAbi');
    checkParam(actualConfig.nodeUrl, undefined, 'node URL');
}

function checkParamsWithdraw(actualConfig) {
    checkParam(pathWallet, 'nowallet', 'wallet');
    checkParam(actualConfig.pobAddress, undefined, 'pobAddress');
    checkParam(actualConfig.pobAbi, undefined, 'pobAbi');
    checkParam(actualConfig.nodeUrl, undefined, 'node URL');
}

function checkParamsBalance(actualConfig) {
    checkParam(pathWallet, 'nowallet', 'wallet');
    checkParam(actualConfig.nodeUrl, undefined, 'node URL');
}

function checkParam(param, def, name) {
    if (param === def) {
        console.log(`It is necessary to specify ${name}\n\n`);
        throw new Error(error.NO_PARAM);
    }
}

async function sendTx(rawTransaction, nodeUrl) {
    const web3 = new Web3(new Web3.providers.HttpProvider(nodeUrl));
    await web3.eth.sendSignedTransaction(rawTransaction)
        .once('transactionHash', (txHash) => {
            console.log('Transaction hash: ', txHash);
        });
}

function getPassword() {
    return new Promise((resolve) => {
        const mutableStdout = new Writable({
            write(chunk, encoding, callback) {
                if (!this.muted) { process.stdout.write(chunk, encoding); }
                callback();
            },
        });
        const rl = readline.createInterface({
            input: process.stdin,
            output: mutableStdout,
            terminal: true,
        });
        rl.question('Password: ', (password) => {
            rl.close();
            console.log('');
            resolve(password);
        });
        mutableStdout.muted = true;
    });
}
