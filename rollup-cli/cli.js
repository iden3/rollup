/* eslint-disable no-console */
/* eslint-disable no-use-before-define */
/* eslint-disable no-shadow */
const fs = require('fs');
const readline = require('readline');
const { Writable } = require('stream');
const { EthereumWallet } = require('./src/ethereum-wallet');
const { BabyJubWallet } = require('../rollup-utils/babyjub-wallet');
const { Wallet } = require('./src/wallet');
const {
    depositTx, sendTx, depositOnTopTx, withdrawTx, forceWithdrawTx,
    showAccounts, transferTx, depositAndTransferTx, showExitsBatch, approveTx,
} = require('./src/cli-utils');
const { error } = require('./src/list-errors');

const walletPathDefault = './wallet.json';
const walletEthPathDefault = './ethWallet.json';
const walletBabyjubPathDefault = './babyjubWallet.json';
const configPathDefault = './config.json';
const noncePathDefault = './nonceJson.json';

const { version } = require('./package');
const { argv } = require('yargs') // eslint-disable-line
    .version(version)
    .usage(`
rollup-cli <command> <options>

createkeys command
=============
    rollup-cli createkeys <option>
        create new wallet for rollup client
    -k or --keytype [ethereum | babyjubjub | rollup]
        select type of wallet
    -w or --walletpath <path> (optional)
        Path to store wallet
        Default: [ethWallet.json | babyjubWallet.json | wallet.json]
    -p or --passphrase <passphrase string>
        Passphrase to encrypt private key
    -m or --mnemonic <mnemonic>
        Mnemonic 12 words
    -i or --import <walletPath>
        To import encrypt wallet

printkeys command
=============
    rollup-cli printkeys <options>
        Print public keys
    -k or --keytype [ethereum | babyjubjub | rollup]
        Define which wallet type needs to be readed
    -p or --passphrase <passphrase string>
        Passphrase to decrypt keys
    You can choose:
        -w or --walletpath <path>
            Path of your wallet
        -c or --configpath <path>
            Path of your configuration file with wallet path
            Default: config.json

setparam command
=============
    rollup-cli setparam
        Set configuration file parameters
    --pm or --param <parameter>
        Parameter to set
    -v or --value <value of parameter>
        Value of the parameter
    -c or --configpath <parameter file> (optional)
        Path of your configuration file
        Default: config.json

offchainTx command
=============
    rollup-cli offchaintx <options>
    -t or --type [send | withdrawOffChain]
        Defines which transaction should be done
    -p or --passphrase <passphrase string>
        Passphrasse to decrypt wallet
    -a or --amount <amount>
        Amount to send
    --tk or --tokenid <token ID>
    -r or --recipient <recipient ID>
    -s or --sender <sender ID>
    -e or --fee <user fee>
    --no or --nonce <nonce TX> (optional)
    -c or --configpath <parameter file> (optional)
        Path of your configuration file
        Default: config.json

onchainTx command
=============
    rollup-cli onchaintx <options>
    --type or -t [deposit | depositontop | withdraw | forcewithdraw | transfer | depositandtransfer]
        Defines which transaction should be done
    -p or --passphrase <passphrase string>
        Passphrasse to decrypt wallet
    -l or --loadamount <amount>
        Amount to deposit within the rollup
    -a or --amount <amount>
        Amount to move inside rollup
    --tk or --tokenid <token ID>
    -n or --numexitbatch <num exit batch>
    -r or --recipient <recipient ID>
    -s or --sender <sender ID>
    --id <ID>
    -c or --configpath <parameter file> (optional)
        Path of your configuration file
        Default: config.json
    --gaslimit or --gl <number>
        Gas limit at the time to send a transaction
    --gasmultiplier or --gm <number>
        GasPrice used = default gas price * gasmultiplier

info command
=============
    rollup-cli info <options>
    -t or --type [accounts | exits]
        get accounts information
        get batches where an account has been done an exit transaction 
    -f or --filter [babyjubjub | ethereum]
        only used on account information
    --id <ID>
    -c or --configpath <parameter file> (optional)
        Path of your configuration file
        Default: config.json
      `)
    .help('h')
    .alias('h', 'help')
    .alias('p', 'passphrase')
    .alias('k', 'keytype')
    .alias('w', 'walletpath')
    .alias('c', 'configpath')
    .alias('m', 'mnemonic')
    .alias('i', 'import')
    .alias('pm', 'param')
    .alias('v', 'value')
    .alias('t', 'type')
    .alias('r', 'recipient')
    .alias('s', 'sender')
    .alias('e', 'fee')
    .alias('f', 'filter')
    .alias('a', 'amount')
    .alias('l', 'loadamount')
    .alias('tk', 'tokenid')
    .alias('n', 'numexitbatch')
    .alias('no', 'nonce')
    .alias('gl', 'gaslimit')
    .alias('gm', 'gasmultiplier')
    .epilogue('Rollup client cli tool');

const keytype = (argv.keytype) ? argv.keytype : 'nokeytype';
let walletpath = (argv.walletpath) ? argv.walletpath : 'nowalletpath';
const mnemonic = (argv.mnemonic) ? argv.mnemonic : 'nomnemonic';
const importWallet = (argv.import) ? argv.import : 'noimport';

const param = (argv.param) ? argv.param : 'noparam';
const value = (argv.value) ? argv.value : 'novalue';
const configPath = (argv.configpath) ? argv.configpath : configPathDefault;

const type = (argv.type) ? argv.type : 'notype';
const recipient = (argv.recipient || argv.recipient === 0) ? argv.recipient : 'norecipient';
const sender = (argv.sender || argv.sender === 0) ? argv.sender : 'nosender';
const id = (argv.id || argv.id === 0) ? argv.id : 'noid';
const amount = (argv.amount) ? argv.amount : -1;
const loadamount = (argv.loadamount) ? argv.loadamount : -1;
const tokenId = (argv.tokenid || argv.tokenid === 0) ? argv.tokenid : 'notokenid';
const userFee = argv.fee ? argv.fee : 'nouserfee';
const numExitBatch = argv.numexitbatch ? argv.numexitbatch : 'nonumexitbatch';
const filter = argv.filter ? argv.filter : 'nofilter';
const nonce = (argv.nonce || argv.nonce === 0) ? argv.nonce : undefined;
const gasLimit = (argv.gaslimit) ? argv.gaslimit : 5000000;
const gasMultiplier = (argv.gasmultiplier) ? argv.gasmultiplier : 1;

(async () => {
    try {
        let actualConfig = {};
        if (argv._[0].toUpperCase() === 'CREATEKEYS') {
            let encWallet;
            let wallet;
            // createkeys ethereum
            if (keytype.toUpperCase() === 'ETHEREUM') {
                const passphrase = await getPassword();
                console.log('repeat your password please: ');
                const passphrase2 = await getPassword();
                if (passphrase !== passphrase2) {
                    throw new Error(error.PASSWORD_NOT_MATCH);
                }
                if (walletpath === 'nowalletpath') {
                    walletpath = walletEthPathDefault;
                }
                if (mnemonic !== 'nomnemonic') {
                    if (mnemonic.split(' ').length !== 12) {
                        console.log('Invalid Menmonic, enter the mnemonic between "" \n\n');
                        throw new Error(error.INVALID_MNEMONIC);
                    } else {
                        console.log('create ethereum wallet mnemonic');
                        wallet = EthereumWallet.fromMnemonic(mnemonic);
                        encWallet = await wallet.toEncryptedJson(passphrase);
                    }
                } else if (importWallet !== 'noimport') {
                    if (!fs.existsSync(importWallet) || !fs.lstatSync(importWallet).isFile()) {
                        console.log('Path provided dont work\n\n');
                        throw new Error(error.INVALID_PATH);
                    }
                    console.log('create ethereum wallet import');
                    const readWallet = fs.readFileSync(importWallet, 'utf8');
                    wallet = await EthereumWallet.fromEncryptedJson(readWallet, passphrase);
                    encWallet = await wallet.toEncryptedJson(passphrase);
                } else {
                    console.log('create ethereum wallet random');
                    wallet = EthereumWallet.createRandom();
                    encWallet = await wallet.toEncryptedJson(passphrase);
                }
                fs.writeFileSync(walletpath, JSON.stringify(JSON.parse(encWallet), null, 1), 'utf-8');
            // createkeys babyjubjub
            } else if (keytype.toUpperCase() === 'BABYJUBJUB') {
                const passphrase = await getPassword();
                console.log('repeat your password please');
                const passphrase2 = await getPassword();
                if (passphrase !== passphrase2) {
                    throw new Error(error.PASSWORD_NOT_MATCH);
                }
                if (walletpath === 'nowalletpath') {
                    walletpath = walletBabyjubPathDefault;
                }
                if (mnemonic !== 'nomnemonic') {
                    if (mnemonic.split(' ').length !== 12) {
                        console.log('Invalid Menmonic, enter the mnemonic between "" \n\n');
                        throw new Error(error.INVALID_MNEMONIC);
                    } else {
                        console.log('create babyjub wallet mnemonic');
                        wallet = BabyJubWallet.fromMnemonic(mnemonic);
                        encWallet = await wallet.toEncryptedJson(passphrase);
                    }
                } else if (importWallet !== 'noimport') {
                    if (!fs.existsSync(importWallet) || !fs.lstatSync(importWallet).isFile()) {
                        console.log('Path provided dont work\n\n');
                        throw new Error(error.INVALID_PATH);
                    }
                    console.log('create babyjub wallet import');
                    const readWallet = fs.readFileSync(importWallet, 'utf-8');
                    wallet = BabyJubWallet.fromEncryptedJson(readWallet, passphrase);
                    encWallet = await wallet.toEncryptedJson(passphrase);
                } else {
                    console.log('create babyjub wallet random');
                    wallet = BabyJubWallet.createRandom();
                    encWallet = await wallet.toEncryptedJson(passphrase);
                }
                fs.writeFileSync(walletpath, JSON.stringify(JSON.parse(encWallet), null, 1), 'utf-8');
            // createkeys rollup
            } else if (keytype.toUpperCase() === 'ROLLUP') {
                const passphrase = await getPassword();
                console.log('repeat your password please');
                const passphrase2 = await getPassword();
                if (passphrase !== passphrase2) {
                    throw new Error(error.PASSWORD_NOT_MATCH);
                }
                if (walletpath === 'nowalletpath') {
                    walletpath = walletPathDefault;
                }
                if (mnemonic !== 'nomnemonic') {
                    if (mnemonic.split(' ').length !== 12) {
                        console.log('Invalid Mnemonic, enter the mnemonic between "" \n\n');
                        throw new Error(error.INVALID_MNEMONIC);
                    } else {
                        console.log('create rollup wallet mnemonic');
                        wallet = await Wallet.fromMnemonic(mnemonic);
                        encWallet = await wallet.toEncryptedJson(passphrase);
                    }
                } else if (importWallet !== 'noimport') {
                    if (!fs.existsSync(importWallet) || !fs.lstatSync(importWallet).isFile()) {
                        console.log('Path provided dont work\n\n');
                        throw new Error(error.INVALID_PATH);
                    }
                    console.log('create rollup wallet import');
                    const readWallet = fs.readFileSync(importWallet, 'utf-8');
                    wallet = await Wallet.fromEncryptedJson(JSON.parse(readWallet), passphrase);
                    encWallet = await wallet.toEncryptedJson(passphrase);
                } else {
                    console.log('create rollup wallet random');
                    wallet = await Wallet.createRandom();
                    encWallet = await wallet.toEncryptedJson(passphrase);
                }
                fs.writeFileSync(walletpath, JSON.stringify(encWallet, null, 1), 'utf-8');
            } else {
                console.log('Invalid keytype\n\n');
                throw new Error(error.INVALID_KEY_TYPE);
            }
            process.exit(0);
        } else if (argv._[0].toUpperCase() === 'SETPARAM') {
            if (fs.existsSync(configPath)) {
                actualConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            }
            if (param.toUpperCase() === 'WALLETETHEREUM' && value !== 'novalue') {
                actualConfig.walletEth = value;
            } else if (param.toUpperCase() === 'WALLETBABYJUBJUB' && value !== 'novalue') {
                actualConfig.walletBabyjubjub = value;
            } else if (param.toUpperCase() === 'WALLET' && value !== 'novalue') {
                actualConfig.wallet = value;
            } else if (param.toUpperCase() === 'ABIPATH' && value !== 'novalue') {
                actualConfig.abiRollupPath = value;
            } else if (param.toUpperCase() === 'URLOPERATOR' && value !== 'novalue') {
                actualConfig.urlOperator = value;
            } else if (param.toUpperCase() === 'NODEETH' && value !== 'novalue') {
                actualConfig.nodeEth = value;
            } else if (param.toUpperCase() === 'ADDRESS' && value !== 'novalue') {
                actualConfig.addressRollup = value;
            } else if (param.toUpperCase() === 'CONTROLLERADDRESS' && value !== 'novalue') {
                actualConfig.controllerAddress = value;
            } else if (param === 'noparam') {
                console.log('Please provide a param\n\n');
                throw new Error(error.NO_PARAM);
            } else if (value === 'novalue') {
                console.log('Please provide a value\n\n');
                throw new Error(error.NO_VALUE);
            } else {
                console.log('Invalid param\n\n');
                throw new Error(error.INVALID_PARAM);
            }
            fs.writeFileSync(configPath, JSON.stringify(actualConfig, null, 1), 'utf-8');
            process.exit(0);
        } else if (argv._[0].toUpperCase() === 'PRINTKEYS') {
            if (walletpath === 'nowalletpath') {
                if (fs.existsSync(configPath)) {
                    actualConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                    if (actualConfig.wallet !== undefined) {
                        walletpath = actualConfig.wallet;
                    }
                }
            }
            console.log('The following keys have been found:');
            if (keytype.toUpperCase() === 'ROLLUP') {
                if (walletpath === 'nowalletpath') {
                    walletpath = walletPathDefault;
                }
                if (!fs.existsSync(walletpath)) {
                    console.log('Please provide a valid path\n\n');
                    throw new Error(error.INVALID_PATH);
                }
                const readWallet = JSON.parse(fs.readFileSync(walletpath, 'utf-8'));
                console.log('Ethereum key:');
                console.log(`  Address: ${readWallet.ethWallet.address}`);
                console.log('Babyjub Key:');
                console.log('  Public Key: ');
                console.log(`    Ax: ${readWallet.babyjubWallet.public.ax.toString(16)}`);
                console.log(`    Ay: ${readWallet.babyjubWallet.public.ay.toString(16)}`);
            } else if (keytype.toUpperCase() === 'ETHEREUM') {
                if (walletpath === 'nowalletpath') {
                    walletpath = walletEthPathDefault;
                }
                if (!fs.existsSync(walletpath)) {
                    console.log('Please provide a valid path\n\n');
                    throw new Error(error.INVALID_PATH);
                }
                const readWallet = JSON.parse(fs.readFileSync(walletpath, 'utf-8'));
                console.log('Ethereum key');
                console.log(`Public Key: ${readWallet.address}`);
            } else if (keytype.toUpperCase() === 'BABYJUBJUB') {
                if (walletpath === 'nowalletpath') {
                    walletpath = walletBabyjubPathDefault;
                }
                if (!fs.existsSync(walletpath)) {
                    console.log('Please provide a valid path\n\n');
                    throw new Error(error.INVALID_PATH);
                }
                const readWallet = JSON.parse(fs.readFileSync(walletpath, 'utf-8'));
                console.log('Babyjub key');
                console.log(`Public Key: ${readWallet.publicKey}`);
                console.log(`Public Key Compressed: ${readWallet.publicKeyCompressed.toString('hex')}`);
            } else {
                console.log('Invalid keytype\n\n');
                throw new Error(error.INVALID_KEY_TYPE);
            }
            process.exit(0);
        } else if (argv._[0].toUpperCase() === 'OFFCHAINTX') {
            if (type === 'notype') {
                console.log('It is necessary to specify the type of action\n\n');
                throw new Error(error.NO_TYPE);
            } else {
                const passphrase = await getPassword();
                if (fs.existsSync(configPath)) {
                    actualConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                } else {
                    console.log('No params file was submitted\n\n');
                    throw new Error(error.NO_PARAMS_FILE);
                }
                checkparamsOffchain(type, actualConfig);
                const wallet = JSON.parse(fs.readFileSync(actualConfig.wallet, 'utf-8'));
                const { urlOperator } = actualConfig;
                let { noncePath } = actualConfig;
                if (noncePath === undefined) {
                    noncePath = noncePathDefault;
                }
                let actualNonce;
                if (fs.existsSync(noncePath)) {
                    actualNonce = JSON.parse(fs.readFileSync(noncePath, 'utf8'));
                }
                if (type.toUpperCase() === 'SEND') {
                    const res = await sendTx(urlOperator, recipient, amount, wallet, passphrase, tokenId,
                        userFee, sender, nonce, actualNonce);
                    console.log(`Status: ${res.status}, Nonce: ${res.nonce}`);
                    if (res.status.toString() === '200') {
                        fs.writeFileSync(noncePath, JSON.stringify(res.nonceObject, null, 1), 'utf-8');
                    }
                } else if (type.toUpperCase() === 'WITHDRAWOFFCHAIN') {
                    const res = await sendTx(urlOperator, 0, amount, wallet, passphrase, tokenId, userFee,
                        sender, nonce, actualNonce);
                    console.log(`Status: ${res.status}, Nonce: ${res.nonce}`);
                    if (res.status.toString() === '200') {
                        fs.writeFileSync(noncePath, JSON.stringify(res.nonceObject, null, 1), 'utf-8');
                    }
                } else {
                    throw new Error(error.INVALID_TYPE);
                }
            }
            process.exit(0);
        } else if (argv._[0].toUpperCase() === 'ONCHAINTX') {
            if (type !== 'notype' && type.toUpperCase() !== 'DEPOSIT' && type.toUpperCase() !== 'DEPOSITONTOP' && type.toUpperCase() !== 'WITHDRAW'
            && type.toUpperCase() !== 'FORCEWITHDRAW' && type.toUpperCase() !== 'TRANSFER' && type.toUpperCase() !== 'DEPOSITANDTRANSFER'
            && type.toUpperCase() !== 'APPROVE') {
                throw new Error(error.INVALID_KEY_TYPE);
            } else if (type === 'notype') {
                console.log('It is necessary to specify the type of action\n\n');
                throw new Error(error.NO_TYPE);
            } else {
                const passphrase = await getPassword();
                if (fs.existsSync(configPath)) {
                    actualConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                } else {
                    console.log('No params file was submitted\n\n');
                    throw new Error(error.NO_PARAMS_FILE);
                }
                checkparamsOnchain(type, actualConfig);
                const abi = JSON.parse(fs.readFileSync(actualConfig.abiRollupPath, 'utf-8'));
                const wallet = JSON.parse(fs.readFileSync(actualConfig.wallet, 'utf-8'));
                const abiTokens = JSON.parse(fs.readFileSync(actualConfig.abiTokensPath, 'utf-8'));
                if (type.toUpperCase() === 'DEPOSIT') {
                    const Tx = await depositTx(actualConfig.nodeEth, actualConfig.addressRollup, loadamount,
                        tokenId, wallet, passphrase, actualConfig.controllerAddress, abi, gasLimit, gasMultiplier);
                    console.log(JSON.stringify({ 'Transaction Hash': Tx.hash }));
                } else if (type.toUpperCase() === 'DEPOSITONTOP') {
                    const Tx = await depositOnTopTx(actualConfig.nodeEth, actualConfig.addressRollup, loadamount,
                        tokenId, wallet, passphrase, abi, recipient, gasLimit, gasMultiplier);
                    console.log(JSON.stringify({ 'Transaction Hash': Tx.hash }));
                } else if (type.toUpperCase() === 'FORCEWITHDRAW') {
                    const Tx = await forceWithdrawTx(actualConfig.nodeEth, actualConfig.addressRollup, amount,
                        wallet, passphrase, abi, id, gasLimit, gasMultiplier);
                    console.log(JSON.stringify({ 'Transaction Hash': Tx.hash }));
                } else if (type.toUpperCase() === 'WITHDRAW') {
                    const Tx = await withdrawTx(actualConfig.nodeEth, actualConfig.addressRollup, wallet,
                        passphrase, abi, actualConfig.urlOperator, id, numExitBatch, gasLimit, gasMultiplier);
                    console.log(JSON.stringify({ 'Transaction Hash': Tx.hash }));
                } else if (type.toUpperCase() === 'TRANSFER') {
                    const Tx = await transferTx(actualConfig.nodeEth, actualConfig.addressRollup, amount,
                        tokenId, wallet, passphrase, abi, sender, recipient, gasLimit, gasMultiplier);
                    console.log(JSON.stringify({ 'Transaction Hash': Tx.hash }));
                } else if (type.toUpperCase() === 'DEPOSITANDTRANSFER') {
                    const Tx = await depositAndTransferTx(actualConfig.nodeEth, actualConfig.addressRollup, loadamount, amount,
                        tokenId, wallet, passphrase, actualConfig.controllerAddress, abi, recipient, gasLimit, gasMultiplier);
                    console.log(JSON.stringify({ 'Transaction Hash': Tx.hash }));
                } else if (type.toUpperCase() === 'APPROVE') {
                    const Tx = await approveTx(actualConfig.nodeEth, actualConfig.addressTokens, amount, actualConfig.addressRollup,
                        wallet, passphrase, abiTokens, gasLimit, gasMultiplier);
                    console.log(JSON.stringify({ 'Transaction Hash': Tx.hash }));
                } else {
                    throw new Error(error.INVALID_TYPE);
                }
            }
            process.exit(0);
        } else if (argv._[0].toUpperCase() === 'INFO') {
            if (type === 'notype') {
                console.log('It is necessary to specify the type of information to print\n\n');
                throw new Error(error.NO_TYPE);
            } else {
                if (fs.existsSync(configPath)) {
                    actualConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                } else {
                    console.log('No params file was submitted\n\n');
                    throw new Error(error.NO_PARAMS_FILE);
                }
                checkParamsInfo(type, actualConfig);
                if (type.toUpperCase() === 'ACCOUNTS') {
                    const wallet = JSON.parse(fs.readFileSync(actualConfig.wallet, 'utf-8'));
                    const filters = {};
                    if (filter.toUpperCase() === 'BABYJUBJUB') {
                        filters.ax = wallet.babyjubWallet.public.ax;
                        filters.ay = wallet.babyjubWallet.public.ay;
                    } else if (filter.toUpperCase() === 'ETHEREUM') {
                        if (wallet.ethWallet.address.startsWith('0x')) {
                            filters.ethAddr = wallet.ethWallet.address;
                        } else {
                            filters.ethAddr = `0x${wallet.ethWallet.address}`;
                        }
                    } else {
                        throw new Error(error.INVALID_FILTER);
                    }
                    const res = await showAccounts(actualConfig.urlOperator, filters);
                    console.log(`Accounts found: \n ${JSON.stringify(res.data, null, 1)}`);
                } else if (type.toUpperCase() === 'EXITS') {
                    const res = await showExitsBatch(actualConfig.urlOperator, id);
                    console.log(`Number exits batch found: \n ${res.data}`);
                }
            }
            process.exit(0);
        } else {
            throw new Error(error.INVALID_COMMAND);
        }
    } catch (err) {
        console.log(err.message);
        console.log(Object.keys(error)[err.message]);
        process.exit(err.message);
    }
})();

function checkparamsOnchain(type, actualConfig) {
    switch (type.toUpperCase()) {
    case 'DEPOSIT':
        checkparam(loadamount, -1, 'loadamount');
        checkparam(tokenId, 'notokenid', 'token ID');
        checkparam(actualConfig.nodeEth, undefined, 'node (with setparam command)');
        checkparam(actualConfig.addressRollup, undefined, 'contract address (with setparam command)');
        checkparam(actualConfig.abiRollupPath, undefined, 'abi path (with setparam command)');
        checkparam(actualConfig.wallet, undefined, 'wallet path (with setparam command)');
        break;
    case 'DEPOSITONTOP':
        checkparam(loadamount, -1, 'loadamount');
        checkparam(tokenId, 'notokenid', 'token ID');
        checkparam(actualConfig.nodeEth, undefined, 'node (with setparam command)');
        checkparam(actualConfig.addressRollup, undefined, 'contract address (with setparam command)');
        checkparam(actualConfig.abiRollupPath, undefined, 'abi path (with setparam command)');
        checkparam(actualConfig.wallet, undefined, 'wallet path (with setparam command)');
        checkparam(recipient, 'norecipient', 'recipient');
        break;
    case 'WITHDRAW':
        checkparam(actualConfig.nodeEth, undefined, 'node (with setparam command)');
        checkparam(actualConfig.addressRollup, undefined, 'contract address (with setparam command)');
        checkparam(actualConfig.abiRollupPath, undefined, 'abi path (with setparam command)');
        checkparam(actualConfig.wallet, undefined, 'wallet path (with setparam command)');
        checkparam(actualConfig.urlOperator, undefined, 'operator (with setparam command)');
        checkparam(id, 'noid', 'your id');
        checkparam(numExitBatch, 'nonumexitbatch', 'num exit batch');
        break;
    case 'FORCEWITHDRAW':
        checkparam(amount, -1, 'amount');
        checkparam(actualConfig.nodeEth, undefined, 'node (with setparam command)');
        checkparam(actualConfig.addressRollup, undefined, 'contract address (with setparam command)');
        checkparam(actualConfig.abiRollupPath, undefined, 'abi path (with setparam command)');
        checkparam(actualConfig.wallet, undefined, 'wallet path (with setparam command)');
        checkparam(id, 'noid', 'your id');
        break;
    case 'TRANSFER':
        checkparam(amount, -1, 'amount');
        checkparam(tokenId, 'notokenid', 'token ID');
        checkparam(actualConfig.nodeEth, undefined, 'node (with setparam command)');
        checkparam(actualConfig.addressRollup, undefined, 'contract address (with setparam command)');
        checkparam(actualConfig.abiRollupPath, undefined, 'abi path (with setparam command)');
        checkparam(actualConfig.wallet, undefined, 'wallet path (with setparam command)');
        checkparam(sender, 'nosender', 'sender');
        checkparam(recipient, 'norecipient', 'recipient');
        break;
    case 'DEPOSITANDTRANSFER':
        checkparam(amount, -1, 'amount');
        checkparam(loadamount, -1, 'loadamount');
        checkparam(tokenId, 'notokenid', 'token ID');
        checkparam(actualConfig.nodeEth, undefined, 'node (with setparam command)');
        checkparam(actualConfig.addressRollup, undefined, 'contract address (with setparam command)');
        checkparam(actualConfig.abiRollupPath, undefined, 'abi path (with setparam command)');
        checkparam(actualConfig.wallet, undefined, 'wallet path (with setparam command)');
        checkparam(recipient, 'norecipient', 'recipient');
        break;
    case 'APPROVE':
        checkparam(amount, -1, 'amount');
        checkparam(actualConfig.nodeEth, undefined, 'node (with setparam command)');
        checkparam(actualConfig.addressRollup, undefined, 'contract address (with setparam command)');
        checkparam(actualConfig.abiTokensPath, undefined, 'abi tokens path in config.json');
        checkparam(actualConfig.wallet, undefined, 'wallet path (with setparam command)');
        break;
    default:
        throw new Error(error.INVALID_TYPE);
    }
}

function checkparamsOffchain(type, actualConfig) {
    switch (type.toUpperCase()) {
    case 'SEND':
        checkparam(amount, -1, 'amount');
        checkparam(tokenId, 'notokenid', 'token ID');
        checkparam(recipient, 'norecipient', 'recipient');
        checkparam(userFee, 'nouserfee', 'fee');
        checkparam(actualConfig.wallet, undefined, 'wallet path (with setparam command)');
        checkparam(actualConfig.urlOperator, undefined, 'operator (with setparam command)');
        checkparam(sender, 'nosender', 'sender');
        break;
    case 'WITHDRAWOFFCHAIN':
        checkparam(amount, -1, 'amount');
        checkparam(tokenId, 'notokenid', 'token ID');
        checkparam(userFee, 'nouserfee', 'fee');
        checkparam(actualConfig.wallet, undefined, 'wallet path (with setparam command)');
        checkparam(actualConfig.urlOperator, undefined, 'operator (with setparam command)');
        checkparam(sender, 'nosender', 'sender');
        break;
    default:
        throw new Error(error.INVALID_TYPE);
    }
}

function checkParamsInfo(type, actualConfig) {
    switch (type.toUpperCase()) {
    case 'ACCOUNTS':
        checkparam(filter, 'nofilter', 'babyjubjub or ethereum');
        checkparam(actualConfig.wallet, undefined, 'wallet path (with setparam command)');
        checkparam(actualConfig.urlOperator, undefined, 'operator (with setparam command)');
        break;
    case 'EXITS':
        checkparam(actualConfig.urlOperator, undefined, 'operator (with setparam command)');
        checkparam(id, 'noid', 'your id');
        break;
    default:
        throw new Error(error.INVALID_TYPE);
    }
}

function checkparam(param, def, name) {
    if (param === def) {
        console.log(`It is necessary to specify ${name}\n\n`);
        throw new Error(error.NO_PARAM);
    }
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
