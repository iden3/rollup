const fs = require("fs");
const { EthereumWallet } = require("./src/ethereum-wallet");
const { BabyJubWallet } = require("../rollup-utils/babyjub-wallet");
const { Wallet } = require("./src/wallet");
const {
    depositTx, sendTx, depositOnTopTx, withdrawTx, forceWithdrawTx,
} = require("./src/cli-utils");

const walletPathDefault = "./src/resources/wallet.json";
const walletEthPathDefault = "./src/resources/ethWallet.json"; 
const walletBabyjubPathDefault = "./src/resources/babyjubWallet.json";
const configJsonDefault = "./src/resources/config.json";

const { version } = require("./package");
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
  Default: ./src/resources/config.json

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
    Default: ./src/resources/config.json
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
  --paramstx <parameter file>
    Contains all necessary parameters to perform transacction
    Default: ./src/resources/config.json
      
      `)
    .alias("p", "path")
    .alias("pass", "passphrase")
    .help("h")
    .alias("h", "help")
    .alias("t", "type")
    .alias("kt", "keytype")
    .alias("w", "wallet")
    .alias("a", "amount")
    .alias("o", "operator")
    .alias("n", "node")
    .alias("mn", "mnemonic")
    .alias("we", "walleteth")
    .alias("wbb", "walletbabyjub")
    .epilogue("Rollup client cli tool");

const pathName = (argv.path) ? argv.path : "nopath";
const passString = (argv.passphrase) ? argv.passphrase : "nopassphrase";
const type = (argv.type) ? argv.type : "notype";
const keytype = (argv.keytype) ? argv.keytype : "nokeytype";
const to = (argv.to || argv.to === 0) ? argv.to : "norecipient";
const amount = (argv.amount) ? argv.amount : -1;
const mnemonic = (argv.mnemonic) ? argv.mnemonic : "nomnemonic";
const importWallet = (argv.import) ? argv.import : "noimport";
const param = (argv.param) ? argv.param : "noparam";
const value = (argv.value) ? argv.value : "novalue";
const configjson = (argv.paramstx) ? argv.paramstx : configJsonDefault;
const tokenId = (argv.tokenid || argv.tokenid === 0) ? argv.tokenid : "notokenid";
const userFee = argv.fee ? argv.fee : "nouserfee";

(async () => {
    let actualConfig = {};
    try {
        if (fs.existsSync(configjson)) {
            actualConfig = JSON.parse(fs.readFileSync(configjson, "utf8"));
        } else {
            console.log("This file doesn't exist\n\n");
            throw new Error("No params file was submitted");
        }
        // createkeys
        if (argv._[0].toUpperCase() === "CREATEKEYS") {
            let newWalletPath = pathName;
            let wallet = {};
            let encWallet = {};
            // createkeys ethereum
            if (keytype === "ethereum") {
                if (passString === "nopassphrase") {
                    console.log("Please provide a passphrase to encrypt keys by:\n\n");
                    throw new Error("No passphrase was submitted");
                } else {
                    if (pathName === "nopath") {
                        newWalletPath = walletEthPathDefault;
                    }
                    if (mnemonic !== "nomnemonic") {
                        if (mnemonic.split(" ").length !== 12) {
                            console.log("Invalid Menmonic, enter the mnemonic between \"\" \n\n");
                            throw new Error("Invalid Mnemonic");
                        } else {
                            console.log("create ethereum wallet mnemonic");
                            wallet = EthereumWallet.fromMnemonic(mnemonic);
                            encWallet = await wallet.toEncryptedJson(passString);
                        }
                    } else if (importWallet !== "noimport") {
                        if (!fs.existsSync(importWallet) || !fs.lstatSync(importWallet).isFile()) {
                            console.log("Path provided dont work:\n\n");
                            throw new Error("Path provided dont work");
                        }
                        console.log("create ethereum wallet import");
                        const readWallet = fs.readFileSync(importWallet, "utf8");
                        wallet = await EthereumWallet.fromEncryptedJson(readWallet, passString);
                        encWallet = await wallet.toEncryptedJson(passString);
                    } else {
                        console.log("create ethereum wallet random");
                        wallet = EthereumWallet.createRandom();
                        encWallet = await wallet.toEncryptedJson(passString);
                    }
                    fs.writeFileSync(newWalletPath, JSON.stringify(JSON.parse(encWallet), null, 1), "utf-8");
                    // write in config.json the actual path of created wallet
                    actualConfig.walletEth = newWalletPath;
                    fs.writeFileSync(configjson, JSON.stringify(actualConfig, null, 1), "utf-8");
                }
                // createkeys babyjub
            } else if (keytype === "babyjub") {
                if (passString === "nopassphrase") {
                    console.log("Please provide a passphrase to encrypt keys by:\n\n");
                    throw new Error("No passphrase was submitted");
                } else {
                    if (pathName === "nopath") {
                        newWalletPath = walletBabyjubPathDefault;
                    }
                    if (mnemonic !== "nomnemonic") {
                        console.log("create babyjub wallet mnemonic");
                        wallet = BabyJubWallet.fromMnemonic(mnemonic);
                        encWallet = wallet.toEncryptedJson(passString);
                    } else if (importWallet !== "noimport") {
                        if (!fs.existsSync(importWallet) || !fs.lstatSync(importWallet).isFile()) {
                            console.log("Path provided dont work:\n\n");
                            throw new Error("Path provided dont work");
                        }
                        console.log("create babyjub wallet import");
                        const readWallet = fs.readFileSync(importWallet, "utf-8");
                        wallet = BabyJubWallet.fromEncryptedJson(readWallet, passString);
                        encWallet = wallet.toEncryptedJson(passString);
                    } else {
                        console.log("create babyjub wallet random");
                        wallet = BabyJubWallet.createRandom();
                        encWallet = wallet.toEncryptedJson(passString);
                    }
                    fs.writeFileSync(newWalletPath, JSON.stringify(JSON.parse(encWallet), null, 1), "utf-8");
                    // write in config.json the actual path of created wallet
                    actualConfig.walletBabyjub = newWalletPath;
                    fs.writeFileSync(configjson, JSON.stringify(actualConfig, null, 1), "utf-8");
                }
                // createkeys rollup
            } else if (keytype === "rollup") {
                if (passString === "nopassphrase") {
                    console.log("Please provide a passphrase to encrypt keys by:\n\n");
                    throw new Error("No passphrase was submitted");
                } else {
                    if (pathName === "nopath") {
                        newWalletPath = walletPathDefault;
                    }
                    if (mnemonic !== "nomnemonic") {
                        console.log("create rollup wallet mnemonic");
                        wallet = await Wallet.fromMnemonic(mnemonic, passString);
                        encWallet = await wallet.toEncryptedJson(passString);
                    } else if (importWallet !== "noimport") {
                        if (!fs.existsSync(importWallet) || !fs.lstatSync(importWallet).isFile()) {
                            console.log("Path provided dont work:\n\n");
                            throw new Error("Path provided dont work");
                        }
                        console.log("create rollup wallet import");
                        const readWallet = fs.readFileSync(importWallet, "utf-8");
                        wallet = await Wallet.fromEncryptedJson(JSON.parse(readWallet), passString);
                        encWallet = await wallet.toEncryptedJson(passString);
                    } else {
                        console.log("create rollup wallet random");
                        wallet = await Wallet.createRandom(passString);
                        encWallet = await wallet.toEncryptedJson(passString);
                    }
                    fs.writeFileSync(newWalletPath, JSON.stringify(encWallet, null, 1), "utf-8");
                    actualConfig.wallet = newWalletPath;
                    fs.writeFileSync(configjson, JSON.stringify(actualConfig, null, 1), "utf-8");
                }
            } else {
                console.log("Invalid keytype\n\n");
                throw new Error("Invalid keytype");
            }
            process.exit(0);
            // setparam
        } else if (argv._[0].toUpperCase() === "SETPARAM") {
            if (param.toUpperCase() === "NODE" && value !== "novalue") {
                actualConfig.nodeEth = value;
            } else if (param.toUpperCase() === "ADDRESS" && value !== "novalue") {
                actualConfig.address = value;
            } else if (param.toUpperCase() === "OPERATOR" && value !== "novalue") {
                actualConfig.operator = value;
            } else if (param.toUpperCase() === "WALLETETHEREUM" && value !== "novalue") {
                actualConfig.walletEth = value;
            } else if (param.toUpperCase() === "WALLETBABYJUB" && value !== "novalue") {
                actualConfig.walletBabyjub = value;
            } else if (param.toUpperCase() === "WALLET" && value !== "novalue") {
                actualConfig.wallet = value;
            } else if (param.toUpperCase() === "ABI" && value !== "novalue") {
                actualConfig.abi = value;
            } else {
                if (param === "noparam") {
                    console.log("Please provide a param\n\n");
                    throw new Error("No param submitted");
                } else if (value === "novalue") {
                    console.log("Please provide a value\n\n");
                    throw new Error("No value submitted");
                } else {
                    throw new Error("Invalid param");
                }
            }
            fs.writeFileSync(configjson, JSON.stringify(actualConfig, null, 1), "utf-8");
            process.exit(0);
        } else if (argv._[0].toUpperCase() === "PRINTKEYS") {
            let newWalletPath = pathName;
            let wallet = {};
            console.log("The following keys have been found:");
            if (passString === "nopassphrase") {
                console.log("Please provide a passphrase to encrypt keys by:\n\n");
                throw new Error("No passphrase was submitted");
            } else {
                if (keytype === "rollup") {
                    if (pathName === "nopath") {
                        newWalletPath = walletPathDefault;
                    }
                    const readWallet = fs.readFileSync(newWalletPath, "utf-8");
                    wallet = await Wallet.fromEncryptedJson(JSON.parse(readWallet), passString);
                    console.log("Ethereum key");
                    console.log("Public Key: " + wallet.ethWallet.publicKey);
                    console.log("Public Key Compressed: " + wallet.ethWallet.publicKeyCompressed);
                    console.log("Babyjub Key: ");
                    console.log("Public Key: " + wallet.babyjubWallet.publicKey);
                    console.log("Public Key Compressed: " + wallet.babyjubWallet.publicKeyCompressed.toString("hex"));
                } else if (keytype === "ethereum") {
                    if (pathName === "nopath") {
                        newWalletPath = walletEthPathDefault;
                    }
                    const readWallet = fs.readFileSync(newWalletPath, "utf-8");
                    wallet = await EthereumWallet.fromEncryptedJson(readWallet, passString);
                    console.log("Ethereum key");
                    console.log("Public Key: " + wallet.publicKey);
                    console.log("Public Key Compressed: " + wallet.publicKeyCompressed);
                } else if (keytype === "babyjub") {
                    if (pathName === "nopath") {
                        newWalletPath = walletBabyjubPathDefault;
                    }
                    const readWallet = fs.readFileSync(newWalletPath, "utf-8");
                    wallet = await BabyJubWallet.fromEncryptedJson(readWallet, passString);
                    console.log("Babyjub key");
                    console.log("Public Key: " + wallet.publicKey);
                    console.log("Public Key Compressed: " + wallet.publicKeyCompressed.toString("hex"));
                }  else {
                    console.log("Invalid keytype\n\n");
                    throw new Error("Invalid keytype");
                }
                process.exit(0);
            }
        } else if (argv._[0].toUpperCase() === "ONCHAINTX") {
            // onchaintx
            if(type !== "notype" && type.toUpperCase() !== "DEPOSIT" && type.toUpperCase() !== "DEPOSITONTOP" && type.toUpperCase() !== "WITHDRAW" && type.toUpperCase() !== "FORCEWITHDRAW") {
                throw new Error("Invalid type");
            } else {
                if (type === "notype") {
                    console.log("It is necessary to specify the type of action\n\n");
                    throw new Error("No type was submitted");
                } else {
                    checkparamsOnchain(type, actualConfig);
                    const abi = JSON.parse(fs.readFileSync(actualConfig.abi, "utf-8"));
                    const wallet = JSON.parse(fs.readFileSync(actualConfig.wallet, "utf-8"));
                    if (type.toUpperCase() === "FORCEWITHDRAW") {
                        await forceWithdrawTx(actualConfig.nodeEth, actualConfig.address, amount, tokenId, wallet, passString, abi, actualConfig.operator);
                    } else if (type.toUpperCase() === "DEPOSIT") {
                        await depositTx(actualConfig.nodeEth, actualConfig.address, amount, tokenId, wallet, passString, abi);
                    } else if (type.toUpperCase() === "DEPOSITONTOP") {
                        await depositOnTopTx(actualConfig.nodeEth, actualConfig.address, amount, tokenId, wallet, passString, abi, actualConfig.operator);
                    } else if (type.toUpperCase() === "WITHDRAW") {
                        await withdrawTx(actualConfig.nodeEth, actualConfig.address, amount, tokenId, wallet, passString, abi, actualConfig.operator);
                    } else {
                        throw new Error("Invalid type");
                    }
                }
            }
            process.exit(0);
        } else if (argv._[0].toUpperCase() === "OFFCHAINTX") {
            if (type === "notype") {
                console.log("It is necessary to specify the type of action\n\n");
                throw new Error("No type was submitted");
            } else {
                checkparamsOffchain(type, actualConfig);
                const wallet = JSON.parse(fs.readFileSync(actualConfig.wallet, "utf-8"));
                if (type.toUpperCase() === "SEND") {
                    await sendTx(actualConfig.operator, to, amount, wallet, passString, tokenId, userFee);
                } else {
                    throw new Error("Invalid type");
                }
            }
            process.exit(0);
        } else {
            throw new Error("Invalid command");
        }
    } catch (err) {
        console.log(err.stack);
        console.log(`ERROR: ${err}`);
        process.exit(1);
    }
})();

function checkparamsOnchain(type, actualConfig) {
    switch (type.toUpperCase()) {
    case "DEPOSIT":
        checkparam(passString, "nopassphrase", "passphrase");
        checkparam(amount, -1, "amount");
        checkparam(tokenId, "notokenid", "token ID");
        checkparam(actualConfig.nodeEth, undefined, "node (with setparam command)");
        checkparam(actualConfig.address, undefined, "contract address (with setparam command)");
        checkparam(actualConfig.abi, undefined, "abi path (with setparam command)");
        checkparam(actualConfig.wallet, undefined, "wallet path (with setparam command)");
        break;
    case "DEPOSITONTOP":
        checkparam(passString, "nopassphrase", "passphrase");
        checkparam(amount, -1, "amount");
        checkparam(tokenId, "notokenid", "token ID");
        checkparam(actualConfig.nodeEth, undefined, "node (with setparam command)");
        checkparam(actualConfig.address, undefined, "contract address (with setparam command)");
        checkparam(actualConfig.abi, undefined, "abi path (with setparam command)");
        checkparam(actualConfig.wallet, undefined, "wallet path (with setparam command)");
        checkparam(actualConfig.operator, undefined, "operator (with setparam command)");
        break;
    case "WITHDRAW":
        checkparam(passString, "nopassphrase", "passphrase");
        checkparam(amount, -1, "amount");
        checkparam(tokenId, "notokenid", "token ID");
        checkparam(actualConfig.nodeEth, undefined, "node (with setparam command)");
        checkparam(actualConfig.address, undefined, "contract address (with setparam command)");
        checkparam(actualConfig.abi, undefined, "abi path (with setparam command)");
        checkparam(actualConfig.wallet, undefined, "wallet path (with setparam command)");
        checkparam(actualConfig.operator, undefined, "operator (with setparam command)");
        break;
    case "FORCEWITHDRAW":
        checkparam(passString, "nopassphrase", "passphrase");
        checkparam(amount, -1, "amount");
        checkparam(tokenId, "notokenid", "token ID");
        checkparam(actualConfig.nodeEth, undefined, "node (with setparam command)");
        checkparam(actualConfig.address, undefined, "contract address (with setparam command)");
        checkparam(actualConfig.abi, undefined, "abi path (with setparam command)");
        checkparam(actualConfig.wallet, undefined, "wallet path (with setparam command)");
        checkparam(actualConfig.operator, undefined, "operator (with setparam command)");
        break;
    default:
        throw new Error("Invalid type");
    }
}

function checkparamsOffchain(type, actualConfig) {
    switch (type.toUpperCase()) {
    case "SEND":
        checkparam(passString, "nopassphrase", "passphrase");
        checkparam(amount, "-1", "amount");
        checkparam(tokenId, "notokenid", "token ID");
        checkparam(to, "norecipient", "recipient");
        checkparam(userFee, "nouserfee", "fee");
        checkparam(actualConfig.wallet, undefined, "wallet path (with setparam command)");
        checkparam(actualConfig.operator, undefined, "operator (with setparam command)");
        break;
    default:
        throw new Error("Invalid type");
    }
}

function checkparam(param, def, name) {
    if(param === def) {
        console.log(`It is necessary to specify ${name}\n\n`);
        throw new Error(`No ${name} was submitted`);
    }
}