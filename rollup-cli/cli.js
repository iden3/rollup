/* eslint-disable no-console */
/* eslint-disable no-use-before-define */
/* eslint-disable no-shadow */
const fs = require('fs');
const { EthereumWallet } = require('./src/ethereum-wallet');
const { BabyJubWallet } = require('../rollup-utils/babyjub-wallet');
const { Wallet } = require('./src/wallet');
const {
    depositTx, sendTx, depositOnTopTx, withdrawTx, forceWithdrawTx,
    showAccounts, transferTx, depositAndTransferTx, showExitsBatch,
} = require('./src/cli-utils');
const { error } = require('./src/list-errors');

const walletPathDefault = './wallet.json';
const walletEthPathDefault = './ethWallet.json';
const walletBabyjubPathDefault = './babyjubWallet.json';
const configPathDefault = './config.json';

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
    -t or --type [send | beforewithdraw]
        Defines which transaction should be done
    -p or --passphrase <passphrase string>
        Passphrasse to decrypt wallet
    -a or --amount <amount>
        Amount to send
    --tk or --tokenid <token ID>
    -r or --recipient <recipient ID>
    -s or --sender <sender ID>
    -e or --fee <user fee>
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
    -n or --numexitroot <num exit root>
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
    .alias('n', 'numexitroot')
    .alias('gl', 'gaslimit')
    .alias('gm', 'gasmultiplier')
    .epilogue('Rollup client cli tool');

const passphrase = (argv.passphrase) ? argv.passphrase : 'nopassphrase';
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
const numExitRoot = argv.numexitroot ? argv.numexitroot : 'nonumexitroot';
const filter = argv.filter ? argv.filter : 'nofilter';
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
                if (passphrase === 'nopassphrase') {
                    console.log('Please provide a passphrase to encrypt keys\n\n');
                    throw new Error(error.NO_PASS);
                } else {
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
                }
            // createkeys babyjubjub
            } else if (keytype.toUpperCase() === 'BABYJUBJUB') {
                if (passphrase === 'nopassphrase') {
                    console.log('Please provide a passphrase to encrypt keys\n\n');
                    throw new Error(error.NO_PASS);
                } else {
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
                }
            // createkeys rollup
            } else if (keytype.toUpperCase() === 'ROLLUP') {
                if (passphrase === 'nopassphrase') {
                    console.log('Please provide a passphrase to encrypt keys\n\n');
                    throw new Error(error.NO_PASS);
                } else {
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
                }
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
                actualConfig.abiPath = value;
            } else if (param.toUpperCase() === 'URLOPERATOR' && value !== 'novalue') {
                actualConfig.urlOperator = value;
            } else if (param.toUpperCase() === 'NODEETH' && value !== 'novalue') {
                actualConfig.nodeEth = value;
            } else if (param.toUpperCase() === 'ADDRESS' && value !== 'novalue') {
                actualConfig.addressSC = value;
            } else if (param.toUpperCase() === 'DEPOSITETHADDRESS' && value !== 'novalue') {
                actualConfig.depositEthAddress = value;
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
            if (passphrase === 'nopassphrase') {
                console.log('Please provide a passphrase\n\n');
                throw new Error(error.NO_PASS);
            } else {
                if (walletpath === 'nowalletpath') {
                    if (fs.existsSync(configPath)) {
                        actualConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                        if (actualConfig.wallet !== undefined) {
                            walletpath = actualConfig.wallet;
                        }
                    }
                }
                let wallet;
                console.log('The following keys have been found:');
                if (keytype.toUpperCase() === 'ROLLUP') {
                    if (walletpath === 'nowalletpath') {
                        walletpath = walletPathDefault;
                    }
                    if (!fs.existsSync(walletpath)) {
                        console.log('Please provide a valid path\n\n');
                        throw new Error(error.INVALID_PATH);
                    }
                    const readWallet = fs.readFileSync(walletpath, 'utf-8');
                    wallet = await Wallet.fromEncryptedJson(JSON.parse(readWallet), passphrase);
                    console.log('Ethereum key');
                    console.log(`Public Key: ${wallet.ethWallet.publicKey}`);
                    console.log(`Public Key Compressed: ${wallet.ethWallet.publicKeyCompressed}`);
                    console.log('Babyjub Key: ');
                    console.log(`Public Key: ${wallet.babyjubWallet.publicKey}`);
                    console.log(`Public Key Compressed: ${wallet.babyjubWallet.publicKeyCompressed.toString('hex')}`);
                } else if (keytype.toUpperCase() === 'ETHEREUM') {
                    if (walletpath === 'nowalletpath') {
                        walletpath = walletEthPathDefault;
                    }
                    if (!fs.existsSync(walletpath)) {
                        console.log('Please provide a valid path\n\n');
                        throw new Error(error.INVALID_PATH);
                    }
                    const readWallet = fs.readFileSync(walletpath, 'utf-8');
                    wallet = await EthereumWallet.fromEncryptedJson(readWallet, passphrase);
                    console.log('Ethereum key');
                    console.log(`Public Key: ${wallet.publicKey}`);
                    console.log(`Public Key Compressed: ${wallet.publicKeyCompressed}`);
                } else if (keytype.toUpperCase() === 'BABYJUBJUB') {
                    if (walletpath === 'nowalletpath') {
                        walletpath = walletBabyjubPathDefault;
                    }
                    if (!fs.existsSync(walletpath)) {
                        console.log('Please provide a valid path\n\n');
                        throw new Error(error.INVALID_PATH);
                    }
                    const readWallet = fs.readFileSync(walletpath, 'utf-8');
                    wallet = await BabyJubWallet.fromEncryptedJson(readWallet, passphrase);
                    console.log('Babyjub key');
                    console.log(`Public Key: ${wallet.publicKey}`);
                    console.log(`Public Key Compressed: ${wallet.publicKeyCompressed.toString('hex')}`);
                } else {
                    console.log('Invalid keytype\n\n');
                    throw new Error(error.INVALID_KEY_TYPE);
                }
                process.exit(0);
            }
        } else if (argv._[0].toUpperCase() === 'OFFCHAINTX') {
            if (type === 'notype') {
                console.log('It is necessary to specify the type of action\n\n');
                throw new Error(error.NO_TYPE);
            } else {
                if (fs.existsSync(configPath)) {
                    actualConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                } else {
                    console.log('No params file was submitted\n\n');
                    throw new Error(error.NO_PARAMS_FILE);
                }
                checkparamsOffchain(type, actualConfig);
                const wallet = JSON.parse(fs.readFileSync(actualConfig.wallet, 'utf-8'));
                const { urlOperator } = actualConfig;
                if (type.toUpperCase() === 'SEND') {
                    const res = await sendTx(urlOperator, recipient, amount, wallet, passphrase, tokenId, userFee, sender);
                    console.log(JSON.stringify(res));
                } else if (type.toUpperCase() === 'BEFOREWITHDRAW') {
                    const res = await sendTx(urlOperator, 0, amount, wallet, passphrase, tokenId, userFee, sender);
                    console.log(JSON.stringify(res));
                } else {
                    throw new Error(error.INVALID_TYPE);
                }
            }
            process.exit(0);
        } else if (argv._[0].toUpperCase() === 'ONCHAINTX') {
            if (type !== 'notype' && type.toUpperCase() !== 'DEPOSIT' && type.toUpperCase() !== 'DEPOSITONTOP' && type.toUpperCase() !== 'WITHDRAW'
            && type.toUpperCase() !== 'FORCEWITHDRAW' && type.toUpperCase() !== 'TRANSFER' && type.toUpperCase() !== 'DEPOSITANDTRANSFER') {
                throw new Error(error.INVALID_KEY_TYPE);
            } else if (type === 'notype') {
                console.log('It is necessary to specify the type of action\n\n');
                throw new Error(error.NO_TYPE);
            } else {
                if (fs.existsSync(configPath)) {
                    actualConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                } else {
                    console.log('No params file was submitted\n\n');
                    throw new Error(error.NO_PARAMS_FILE);
                }
                checkparamsOnchain(type, actualConfig);
                const abi = JSON.parse(fs.readFileSync(actualConfig.abiPath, 'utf-8'));
                const wallet = JSON.parse(fs.readFileSync(actualConfig.wallet, 'utf-8'));
                if (type.toUpperCase() === 'DEPOSIT') {
                    const Tx = await depositTx(actualConfig.nodeEth, actualConfig.addressSC, loadamount,
                        tokenId, wallet, passphrase, actualConfig.depositEthAddress, abi, gasLimit, gasMultiplier);
                    console.log(JSON.stringify({ 'Transaction Hash': Tx.hash }));
                } else if (type.toUpperCase() === 'DEPOSITONTOP') {
                    const Tx = await depositOnTopTx(actualConfig.nodeEth, actualConfig.addressSC, loadamount,
                        tokenId, wallet, passphrase, abi, recipient, gasLimit, gasMultiplier);
                    console.log(JSON.stringify({ 'Transaction Hash': Tx.hash }));
                } else if (type.toUpperCase() === 'FORCEWITHDRAW') {
                    const Tx = await forceWithdrawTx(actualConfig.nodeEth, actualConfig.addressSC, amount,
                        wallet, passphrase, abi, id, gasLimit, gasMultiplier);
                    console.log(JSON.stringify({ 'Transaction Hash': Tx.hash }));
                } else if (type.toUpperCase() === 'WITHDRAW') {
                    const Tx = await withdrawTx(actualConfig.nodeEth, actualConfig.addressSC, wallet,
                        passphrase, abi, actualConfig.urlOperator, id, numExitRoot, gasLimit, gasMultiplier);
                    console.log(JSON.stringify({ 'Transaction Hash': Tx.hash }));
                } else if (type.toUpperCase() === 'TRANSFER') {
                    const Tx = await transferTx(actualConfig.nodeEth, actualConfig.addressSC, amount,
                        tokenId, wallet, passphrase, abi, sender, recipient, gasLimit, gasMultiplier);
                    console.log(JSON.stringify({ 'Transaction Hash': Tx.hash }));
                } else if (type.toUpperCase() === 'DEPOSITANDTRANSFER') {
                    const Tx = await depositAndTransferTx(actualConfig.nodeEth, actualConfig.addressSC, loadamount, amount,
                        tokenId, wallet, passphrase, actualConfig.depositEthAddress, abi, recipient, gasLimit, gasMultiplier);
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
                    console.log(`Batches found with exit transactions: \n ${res.data}`);
                }
            }
            process.exit(0);
        } else {
            throw new Error(error.INVALID_COMMAND);
        }
    } catch (err) {
        console.log(Object.keys(error)[err.message]);
        process.exit(err.message);
    }
})();

function checkparamsOnchain(type, actualConfig) {
    switch (type.toUpperCase()) {
    case 'DEPOSIT':
        checkparam(passphrase, 'nopassphrase', 'passphrase');
        checkparam(loadamount, -1, 'loadamount');
        checkparam(tokenId, 'notokenid', 'token ID');
        checkparam(actualConfig.nodeEth, undefined, 'node (with setparam command)');
        checkparam(actualConfig.addressSC, undefined, 'contract address (with setparam command)');
        checkparam(actualConfig.abiPath, undefined, 'abi path (with setparam command)');
        checkparam(actualConfig.wallet, undefined, 'wallet path (with setparam command)');
        break;
    case 'DEPOSITONTOP':
        checkparam(passphrase, 'nopassphrase', 'passphrase');
        checkparam(loadamount, -1, 'loadamount');
        checkparam(tokenId, 'notokenid', 'token ID');
        checkparam(actualConfig.nodeEth, undefined, 'node (with setparam command)');
        checkparam(actualConfig.addressSC, undefined, 'contract address (with setparam command)');
        checkparam(actualConfig.abiPath, undefined, 'abi path (with setparam command)');
        checkparam(actualConfig.wallet, undefined, 'wallet path (with setparam command)');
        checkparam(recipient, 'norecipient', 'recipient');
        break;
    case 'WITHDRAW':
        checkparam(passphrase, 'nopassphrase', 'passphrase');
        checkparam(actualConfig.nodeEth, undefined, 'node (with setparam command)');
        checkparam(actualConfig.addressSC, undefined, 'contract address (with setparam command)');
        checkparam(actualConfig.abiPath, undefined, 'abi path (with setparam command)');
        checkparam(actualConfig.wallet, undefined, 'wallet path (with setparam command)');
        checkparam(actualConfig.urlOperator, undefined, 'operator (with setparam command)');
        checkparam(id, 'noid', 'your id');
        checkparam(numExitRoot, 'nonumexitroot', 'num exit root');
        break;
    case 'FORCEWITHDRAW':
        checkparam(passphrase, 'nopassphrase', 'passphrase');
        checkparam(amount, -1, 'amount');
        checkparam(actualConfig.nodeEth, undefined, 'node (with setparam command)');
        checkparam(actualConfig.addressSC, undefined, 'contract address (with setparam command)');
        checkparam(actualConfig.abiPath, undefined, 'abi path (with setparam command)');
        checkparam(actualConfig.wallet, undefined, 'wallet path (with setparam command)');
        checkparam(id, 'noid', 'your id');
        break;
    case 'TRANSFER':
        checkparam(passphrase, 'nopassphrase', 'passphrase');
        checkparam(amount, -1, 'amount');
        checkparam(tokenId, 'notokenid', 'token ID');
        checkparam(actualConfig.nodeEth, undefined, 'node (with setparam command)');
        checkparam(actualConfig.addressSC, undefined, 'contract address (with setparam command)');
        checkparam(actualConfig.abiPath, undefined, 'abi path (with setparam command)');
        checkparam(actualConfig.wallet, undefined, 'wallet path (with setparam command)');
        checkparam(sender, 'nosender', 'sender');
        checkparam(recipient, 'norecipient', 'recipient');
        break;
    case 'DEPOSITANDTRANSFER':
        checkparam(passphrase, 'nopassphrase', 'passphrase');
        checkparam(amount, -1, 'amount');
        checkparam(loadamount, -1, 'loadamount');
        checkparam(tokenId, 'notokenid', 'token ID');
        checkparam(actualConfig.nodeEth, undefined, 'node (with setparam command)');
        checkparam(actualConfig.addressSC, undefined, 'contract address (with setparam command)');
        checkparam(actualConfig.abiPath, undefined, 'abi path (with setparam command)');
        checkparam(actualConfig.wallet, undefined, 'wallet path (with setparam command)');
        checkparam(recipient, 'norecipient', 'recipient');
        break;
    default:
        throw new Error(error.INVALID_TYPE);
    }
}

function checkparamsOffchain(type, actualConfig) {
    switch (type.toUpperCase()) {
    case 'SEND':
        checkparam(passphrase, 'nopassphrase', 'passphrase');
        checkparam(amount, -1, 'amount');
        checkparam(tokenId, 'notokenid', 'token ID');
        checkparam(recipient, 'norecipient', 'recipient');
        checkparam(userFee, 'nouserfee', 'fee');
        checkparam(actualConfig.wallet, undefined, 'wallet path (with setparam command)');
        checkparam(actualConfig.urlOperator, undefined, 'operator (with setparam command)');
        checkparam(sender, 'nosender', 'sender');
        break;
    case 'BEFOREWITHDRAW':
        checkparam(passphrase, 'nopassphrase', 'passphrase');
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
