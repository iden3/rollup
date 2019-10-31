/* eslint-disable no-console */
/* eslint-disable no-use-before-define */
/* eslint-disable no-shadow */
const fs = require('fs');
const { EthereumWallet } = require('./src/ethereum-wallet');
const { BabyJubWallet } = require('../rollup-utils/babyjub-wallet');
const { Wallet } = require('./src/wallet');
const {
    depositTx, sendTx, depositOnTopTx, withdrawTx, forceWithdrawTx, showLeafs, transferTx, depositAndTransferTx,
} = require('./src/cli-utils');
const { error } = require('./src/list-errors');

const walletPathDefault = './wallet.json';
const walletEthPathDefault = './ethWallet.json';
const walletBabyjubPathDefault = './babyjubWallet.json';
const configJsonDefault = './config.json';

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
    select type of wallet
  -path or --p <path>
    Path to store wallet
    Default: ./src/resources/
  -passphrase or --pass <passphrase string>
    Passphrase to encrypt private key
  -mnemonic or --mn <mnemonic>
    Mnemonic 12 words
  -import or --imp <walletPath>
    To import encrypt wallet
printkeys command
=============
  rollup-cli printkeys <options>
  Print public keys
  -path or --p <path>
    Path to JSON file
  -keytype [ethereum | babyjubjub | rollup]
    Define which wallet type needs to be readed
  -passphrase or --pass <passphrase string>
    Passphrase to decrypt keys

setparam command
=============
  rollup-cli setparam --param <parameter> --value <parameter value>
  --paramstx <parameter file>
  Default: ./config.json

offchainTx command
=============
  rollup-cli offchaintx <options>
  --type or -t [send]
    Defines which transaction should be done
  --pass or -passphrase <passphrase string>
    Passphrasse to decrypt wallet
  --to <recipient address>
    User identifier on balance tree which will receive the transaction
    Note: send to 0 makes a withdraw transaction
  --amount or -a <amount>
    Amount to send or withdraw
  --fee <fee>
    User fee
  --paramstx <parameter file>
    Contains all necessary parameters to perform transacction
    Default: ./config.json
  --tokenid <token ID>

onchainTx command
=============
  rollup-cli onchaintx <options>
  --type or -t [deposit | depositontop | withdraw | forcewithdraw]
    Defines which transaction should be done
  --pass or -passphrase <passphrase string>
    Passphrasse to decrypt ethereum wallet
  --amount or -a <amount>
  --tokenid <token ID>
  --numexitroot <num exit root>
  --paramstx <parameter file>
    Contains all necessary parameters to perform transaction
    Default: ./config.json
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
    .alias('dethaddr', 'depositethaddress')
    .epilogue('Rollup client cli tool');

const pathName = (argv.path) ? argv.path : 'nopath';
const passString = (argv.passphrase) ? argv.passphrase : 'nopassphrase';
const type = (argv.type) ? argv.type : 'notype';
const keytype = (argv.keytype) ? argv.keytype : 'nokeytype';
const to = (argv.to || argv.to === 0) ? argv.to : 'norecipient';
const amount = (argv.amount) ? argv.amount : -1;
const loadamount = (argv.loadamount) ? argv.loadamount : -1;
const mnemonic = (argv.mnemonic) ? argv.mnemonic : 'nomnemonic';
const importWallet = (argv.import) ? argv.import : 'noimport';
const param = (argv.param) ? argv.param : 'noparam';
const value = (argv.value) ? argv.value : 'novalue';
const configjson = (argv.paramstx) ? argv.paramstx : configJsonDefault;
const tokenId = (argv.tokenid || argv.tokenid === 0) ? argv.tokenid : 'notokenid';
const userFee = argv.fee ? argv.fee : 'nouserfee';
const numExitRoot = argv.numexitroot ? argv.numexitroot : 'noparam';
const depositEthaddress = argv.depositethaddress ? argv.depositethaddress : 0;

(async () => {
    let actualConfig = {};
    try {
        if (fs.existsSync(configjson)) {
            actualConfig = JSON.parse(fs.readFileSync(configjson, 'utf8'));
        } else {
            console.log('No params file was submitted\n\n');
            throw new Error(error.NO_PARAMS_FILE);
        }
        // createkeys
        if (argv._[0].toUpperCase() === 'CREATEKEYS') {
            let newWalletPath = pathName;
            let wallet = {};
            let encWallet = {};
            // createkeys ethereum
            if (keytype === 'ethereum') {
                if (passString === 'nopassphrase') {
                    console.log('Please provide a passphrase to encrypt keys\n\n');
                    throw new Error(error.NO_PASS);
                } else {
                    if (pathName === 'nopath') {
                        newWalletPath = walletEthPathDefault;
                    }
                    if (mnemonic !== 'nomnemonic') {
                        if (mnemonic.split(' ').length !== 12) {
                            console.log('Invalid Menmonic, enter the mnemonic between "" \n\n');
                            throw new Error(error.INVALID_MNEMONIC);
                        } else {
                            console.log('create ethereum wallet mnemonic');
                            wallet = EthereumWallet.fromMnemonic(mnemonic);
                            encWallet = await wallet.toEncryptedJson(passString);
                        }
                    } else if (importWallet !== 'noimport') {
                        if (!fs.existsSync(importWallet) || !fs.lstatSync(importWallet).isFile()) {
                            console.log('Path provided dont work\n\n');
                            throw new Error(error.INVALID_PATH);
                        }
                        console.log('create ethereum wallet import');
                        const readWallet = fs.readFileSync(importWallet, 'utf8');
                        wallet = await EthereumWallet.fromEncryptedJson(readWallet, passString);
                        encWallet = await wallet.toEncryptedJson(passString);
                    } else {
                        console.log('create ethereum wallet random');
                        wallet = EthereumWallet.createRandom();
                        encWallet = await wallet.toEncryptedJson(passString);
                    }
                    fs.writeFileSync(newWalletPath, JSON.stringify(JSON.parse(encWallet), null, 1), 'utf-8');
                    // write in config.json the actual path of created wallet
                    actualConfig.walletEth = newWalletPath;
                    fs.writeFileSync(configjson, JSON.stringify(actualConfig, null, 1), 'utf-8');
                }
                // createkeys babyjub
            } else if (keytype === 'babyjub') {
                if (passString === 'nopassphrase') {
                    console.log('Please provide a passphrase to encrypt keys\n\n');
                    throw new Error(error.NO_PASS);
                } else {
                    if (pathName === 'nopath') {
                        newWalletPath = walletBabyjubPathDefault;
                    }
                    if (mnemonic !== 'nomnemonic') {
                        if (mnemonic.split(' ').length !== 12) {
                            console.log('Invalid Menmonic, enter the mnemonic between "" \n\n');
                            throw new Error(error.INVALID_MNEMONIC);
                        } else {
                            console.log('create babyjub wallet mnemonic');
                            wallet = BabyJubWallet.fromMnemonic(mnemonic);
                            encWallet = wallet.toEncryptedJson(passString);
                        }
                    } else if (importWallet !== 'noimport') {
                        if (!fs.existsSync(importWallet) || !fs.lstatSync(importWallet).isFile()) {
                            console.log('Path provided dont work\n\n');
                            throw new Error(error.INVALID_PATH);
                        }
                        console.log('create babyjub wallet import');
                        const readWallet = fs.readFileSync(importWallet, 'utf-8');
                        wallet = BabyJubWallet.fromEncryptedJson(readWallet, passString);
                        encWallet = wallet.toEncryptedJson(passString);
                    } else {
                        console.log('create babyjub wallet random');
                        wallet = BabyJubWallet.createRandom();
                        encWallet = wallet.toEncryptedJson(passString);
                    }
                    fs.writeFileSync(newWalletPath, JSON.stringify(JSON.parse(encWallet), null, 1), 'utf-8');
                    // write in config.json the actual path of created wallet
                    actualConfig.walletBabyjub = newWalletPath;
                    fs.writeFileSync(configjson, JSON.stringify(actualConfig, null, 1), 'utf-8');
                }
                // createkeys rollup
            } else if (keytype === 'rollup') {
                if (passString === 'nopassphrase') {
                    console.log('Please provide a passphrase to encrypt keys\n\n');
                    throw new Error(error.NO_PASS);
                } else {
                    if (pathName === 'nopath') {
                        newWalletPath = walletPathDefault;
                    }
                    if (mnemonic !== 'nomnemonic') {
                        if (mnemonic.split(' ').length !== 12) {
                            console.log('Invalid Menmonic, enter the mnemonic between "" \n\n');
                            throw new Error(error.INVALID_MNEMONIC);
                        } else {
                            console.log('create rollup wallet mnemonic');
                            wallet = await Wallet.fromMnemonic(mnemonic);
                            encWallet = await wallet.toEncryptedJson(passString);
                        }
                    } else if (importWallet !== 'noimport') {
                        if (!fs.existsSync(importWallet) || !fs.lstatSync(importWallet).isFile()) {
                            console.log('Path provided dont work\n\n');
                            throw new Error(error.INVALID_PATH);
                        }
                        console.log('create rollup wallet import');
                        const readWallet = fs.readFileSync(importWallet, 'utf-8');
                        wallet = await Wallet.fromEncryptedJson(JSON.parse(readWallet), passString);
                        encWallet = await wallet.toEncryptedJson(passString);
                    } else {
                        console.log('create rollup wallet random');
                        wallet = await Wallet.createRandom();
                        encWallet = await wallet.toEncryptedJson(passString);
                    }
                    fs.writeFileSync(newWalletPath, JSON.stringify(encWallet, null, 1), 'utf-8');
                    actualConfig.wallet = newWalletPath;
                    fs.writeFileSync(configjson, JSON.stringify(actualConfig, null, 1), 'utf-8');
                }
            } else {
                console.log('Invalid keytype\n\n');
                throw new Error(error.INVALID_KEY_TYPE);
            }
            process.exit(0);
            // setparam
        } else if (argv._[0].toUpperCase() === 'SETPARAM') {
            if (param.toUpperCase() === 'NODE' && value !== 'novalue') {
                actualConfig.nodeEth = value;
            } else if (param.toUpperCase() === 'ADDRESS' && value !== 'novalue') {
                actualConfig.address = value;
            } else if (param.toUpperCase() === 'OPERATOR' && value !== 'novalue') {
                actualConfig.operator = value;
            } else if (param.toUpperCase() === 'WALLETETHEREUM' && value !== 'novalue') {
                actualConfig.walletEth = value;
            } else if (param.toUpperCase() === 'WALLETBABYJUB' && value !== 'novalue') {
                actualConfig.walletBabyjub = value;
            } else if (param.toUpperCase() === 'WALLET' && value !== 'novalue') {
                actualConfig.wallet = value;
            } else if (param.toUpperCase() === 'ABI' && value !== 'novalue') {
                actualConfig.abi = value;
            } else if (param.toUpperCase() === 'ID' && value !== 'novalue') {
                actualConfig.id = value;
            } else if (param === 'noparam') {
                console.log('Please provide a param\n\n');
                throw new Error(error.NO_PARAM);
            } else if (value === 'novalue') {
                console.log('Please provide a value\n\n');
                throw new Error(error.NO_VALUE);
            } else {
                throw new Error(error.INVALID_PARAM);
            }
            fs.writeFileSync(configjson, JSON.stringify(actualConfig, null, 1), 'utf-8');
            process.exit(0);
        } else if (argv._[0].toUpperCase() === 'PRINTKEYS') {
            let newWalletPath = pathName;
            let wallet = {};
            if (passString === 'nopassphrase') {
                console.log('Please provide a passphrase\n\n');
                throw new Error(error.NO_PASS);
            } else {
                console.log('The following keys have been found:');
                if (keytype === 'rollup') {
                    if (pathName === 'nopath') {
                        newWalletPath = walletPathDefault;
                    }
                    const readWallet = fs.readFileSync(newWalletPath, 'utf-8');
                    wallet = await Wallet.fromEncryptedJson(JSON.parse(readWallet), passString);
                    console.log('Ethereum key');
                    console.log(`Public Key: ${wallet.ethWallet.publicKey}`);
                    console.log(`Public Key Compressed: ${wallet.ethWallet.publicKeyCompressed}`);
                    console.log('Babyjub Key: ');
                    console.log(`Public Key: ${wallet.babyjubWallet.publicKey}`);
                    console.log(`Public Key Compressed: ${wallet.babyjubWallet.publicKeyCompressed.toString('hex')}`);
                } else if (keytype === 'ethereum') {
                    if (pathName === 'nopath') {
                        newWalletPath = walletEthPathDefault;
                    }
                    const readWallet = fs.readFileSync(newWalletPath, 'utf-8');
                    wallet = await EthereumWallet.fromEncryptedJson(readWallet, passString);
                    console.log('Ethereum key');
                    console.log(`Public Key: ${wallet.publicKey}`);
                    console.log(`Public Key Compressed: ${wallet.publicKeyCompressed}`);
                } else if (keytype === 'babyjub') {
                    if (pathName === 'nopath') {
                        newWalletPath = walletBabyjubPathDefault;
                    }
                    const readWallet = fs.readFileSync(newWalletPath, 'utf-8');
                    wallet = await BabyJubWallet.fromEncryptedJson(readWallet, passString);
                    console.log('Babyjub key');
                    console.log(`Public Key: ${wallet.publicKey}`);
                    console.log(`Public Key Compressed: ${wallet.publicKeyCompressed.toString('hex')}`);
                } else {
                    console.log('Invalid keytype\n\n');
                    throw new Error(error.INVALID_KEY_TYPE);
                }
                process.exit(0);
            }
        } else if (argv._[0].toUpperCase() === 'ONCHAINTX') {
            // onchaintx
            if (type !== 'notype' && type.toUpperCase() !== 'DEPOSIT' && type.toUpperCase() !== 'DEPOSITONTOP' && type.toUpperCase() !== 'WITHDRAW'
            && type.toUpperCase() !== 'FORCEWITHDRAW' && type.toUpperCase() !== 'TRANSFER' && type.toUpperCase() !== 'DEPOSITANDTRANSFER') {
                throw new Error(error.INVALID_KEY_TYPE);
            } else if (type === 'notype') {
                console.log('It is necessary to specify the type of action\n\n');
                throw new Error(error.NO_TYPE);
            } else {
                checkparamsOnchain(type, actualConfig);
                const abi = JSON.parse(fs.readFileSync(actualConfig.abi, 'utf-8'));
                const wallet = JSON.parse(fs.readFileSync(actualConfig.wallet, 'utf-8'));
                if (type.toUpperCase() === 'FORCEWITHDRAW') {
                    const Tx = await forceWithdrawTx(actualConfig.nodeEth, actualConfig.address, amount,
                        wallet, passString, abi, actualConfig.id);
                    console.log(JSON.stringify({ 'Transaction Hash': Tx.hash }));
                } else if (type.toUpperCase() === 'DEPOSIT') {
                    const Tx = await depositTx(actualConfig.nodeEth, actualConfig.address, amount,
                        tokenId, wallet, passString, depositEthaddress, abi);
                    console.log(JSON.stringify({ 'Transaction Hash': Tx.hash }));
                } else if (type.toUpperCase() === 'DEPOSITONTOP') {
                    const Tx = await depositOnTopTx(actualConfig.nodeEth, actualConfig.address, amount,
                        tokenId, wallet, passString, abi, actualConfig.id);
                    console.log(JSON.stringify({ 'Transaction Hash': Tx.hash }));
                } else if (type.toUpperCase() === 'WITHDRAW') {
                    const Tx = await withdrawTx(actualConfig.nodeEth, actualConfig.address, amount,
                        wallet, passString, abi, actualConfig.operator, actualConfig.id, numExitRoot);
                    console.log(JSON.stringify({ 'Transaction Hash': Tx.hash }));
                } else if (type.toUpperCase() === 'TRANSFER') {
                    const Tx = await transferTx(actualConfig.nodeEth, actualConfig.address, amount,
                        tokenId, wallet, passString, abi, actualConfig.id, to);
                    console.log(JSON.stringify({ 'Transaction Hash': Tx.hash }));
                } else if (type.toUpperCase() === 'DEPOSITANDTRANSFER') {
                    const Tx = await depositAndTransferTx(actualConfig.nodeEth, actualConfig.address, loadamount, amount,
                        tokenId, wallet, passString, depositEthaddress, abi, to);
                    console.log(JSON.stringify({ 'Transaction Hash': Tx.hash })); // poenr abajo!
                } else {
                    throw new Error(error.INVALID_TYPE);
                }
            }
            process.exit(0);
        } else if (argv._[0].toUpperCase() === 'OFFCHAINTX') {
            if (type === 'notype') {
                console.log('It is necessary to specify the type of action\n\n');
                throw new Error(error.NO_TYPE);
            } else {
                checkparamsOffchain(type, actualConfig);
                const wallet = JSON.parse(fs.readFileSync(actualConfig.wallet, 'utf-8'));
                if (type.toUpperCase() === 'SEND') {
                    const res = await sendTx(actualConfig.operator, to, amount, wallet, passString, tokenId, userFee, actualConfig.id);
                    console.log(JSON.stringify(res));
                } else {
                    throw new Error(error.INVALID_TYPE);
                }
            }
            process.exit(0);
        } else if (argv._[0].toUpperCase() === 'SHOWLEAFS') {
            if (actualConfig.wallet === undefined) {
                console.log('It is necessary a wallet Babyjub to perform this operation');
                throw new Error(error.NO_WALLET);
            }
            if (passString === 'nopassphrase') {
                throw new Error(error.NO_PASS);
            }
            const wallet = JSON.parse(fs.readFileSync(actualConfig.wallet, 'utf-8'));
            await showLeafs(actualConfig.operator, wallet, passString);
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
        checkparam(passString, 'nopassphrase', 'passphrase');
        checkparam(amount, -1, 'amount');
        checkparam(tokenId, 'notokenid', 'token ID');
        checkparam(actualConfig.nodeEth, undefined, 'node (with setparam command)');
        checkparam(actualConfig.address, undefined, 'contract address (with setparam command)');
        checkparam(actualConfig.abi, undefined, 'abi path (with setparam command)');
        checkparam(actualConfig.wallet, undefined, 'wallet path (with setparam command)');
        break;
    case 'DEPOSITONTOP':
        checkparam(passString, 'nopassphrase', 'passphrase');
        checkparam(amount, -1, 'amount');
        checkparam(tokenId, 'notokenid', 'token ID');
        checkparam(actualConfig.nodeEth, undefined, 'node (with setparam command)');
        checkparam(actualConfig.address, undefined, 'contract address (with setparam command)');
        checkparam(actualConfig.abi, undefined, 'abi path (with setparam command)');
        checkparam(actualConfig.wallet, undefined, 'wallet path (with setparam command)');
        checkparam(actualConfig.id, undefined, 'From Id missing');
        break;
    case 'WITHDRAW':
        checkparam(passString, 'nopassphrase', 'passphrase');
        checkparam(amount, -1, 'amount');
        checkparam(actualConfig.nodeEth, undefined, 'node (with setparam command)');
        checkparam(actualConfig.address, undefined, 'contract address (with setparam command)');
        checkparam(actualConfig.abi, undefined, 'abi path (with setparam command)');
        checkparam(actualConfig.wallet, undefined, 'wallet path (with setparam command)');
        checkparam(actualConfig.operator, undefined, 'operator (with setparam command)');
        checkparam(actualConfig.id, undefined, 'From Id missing');
        checkparam(numExitRoot, 'noparam', 'Should specify num exit root');
        break;
    case 'FORCEWITHDRAW':
        checkparam(passString, 'nopassphrase', 'passphrase');
        checkparam(amount, -1, 'amount');
        checkparam(actualConfig.nodeEth, undefined, 'node (with setparam command)');
        checkparam(actualConfig.address, undefined, 'contract address (with setparam command)');
        checkparam(actualConfig.abi, undefined, 'abi path (with setparam command)');
        checkparam(actualConfig.wallet, undefined, 'wallet path (with setparam command)');
        checkparam(actualConfig.id, undefined, 'From Id missing');
        break;
    case 'TRANSFER':
        checkparam(passString, 'nopassphrase', 'passphrase');
        checkparam(amount, -1, 'amount');
        checkparam(tokenId, 'notokenid', 'token ID');
        checkparam(actualConfig.nodeEth, undefined, 'node (with setparam command)');
        checkparam(actualConfig.address, undefined, 'contract address (with setparam command)');
        checkparam(actualConfig.abi, undefined, 'abi path (with setparam command)');
        checkparam(actualConfig.wallet, undefined, 'wallet path (with setparam command)');
        checkparam(actualConfig.id, undefined, 'From Id missing');
        checkparam(to, 'norecipient', 'recipient');
        break;
    case 'DEPOSITANDTRANSFER':
        checkparam(passString, 'nopassphrase', 'passphrase');
        checkparam(amount, -1, 'amount');
        checkparam(loadamount, -1, 'loadamount');
        checkparam(tokenId, 'notokenid', 'token ID');
        checkparam(actualConfig.nodeEth, undefined, 'node (with setparam command)');
        checkparam(actualConfig.address, undefined, 'contract address (with setparam command)');
        checkparam(actualConfig.abi, undefined, 'abi path (with setparam command)');
        checkparam(actualConfig.wallet, undefined, 'wallet path (with setparam command)');
        checkparam(to, 'norecipient', 'recipient');
        break;
    default:
        throw new Error(error.INVALID_TYPE);
    }
}

function checkparamsOffchain(type, actualConfig) {
    switch (type.toUpperCase()) {
    case 'SEND':
        checkparam(passString, 'nopassphrase', 'passphrase');
        checkparam(amount, -1, 'amount');
        checkparam(tokenId, 'notokenid', 'token ID');
        checkparam(to, 'norecipient', 'recipient');
        checkparam(userFee, 'nouserfee', 'fee');
        checkparam(actualConfig.wallet, undefined, 'wallet path (with setparam command)');
        checkparam(actualConfig.operator, undefined, 'operator (with setparam command)');
        checkparam(actualConfig.id, undefined, 'From Id missing');
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
