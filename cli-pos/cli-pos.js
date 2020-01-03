/* eslint-disable no-console */
/* eslint-disable no-use-before-define */
/* eslint-disable no-shadow */
const fs = require("fs");
const ethers = require("ethers");
const { error } = require("./list-errors");
const config = "./config.json";

const { loadSeedHashChain, register, unregister, withdraw, getEtherBalance } = require("./utils");

const version = "0.0.1";
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
    --stake or -s <num>
        Amount to Stake
    --url or -u <url string>
        Operator URL
unregister command
================
    cli-pos unregister <options>
        unregister operator
    --wallet or -w <path>
        Wallet path
    --passphrase or -p <passphrase string>
        Passphrase to decrypt the wallet
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
    .alias("w", "wallet")
    .alias("p", "passphrase")
    .alias("s", "stake")
    .alias("u", "url")
    .alias("i", "id")
    .epilogue("Rollup operator cli tool");

const pathWallet = (argv.wallet) ? argv.wallet : "nowallet";
const passString = (argv.passphrase) ? argv.passphrase : "nopassphrase";
const stake = (argv.stake) ? argv.stake : "nostake";
const url = (argv.url) ? argv.url : "nourl";
const opId = (argv.id || argv.id === 0) ? argv.id : -1;
const gasLimit = 5000000;

(async () => {
    let actualConfig = {};
    try {
        if(fs.existsSync(config)) {
            actualConfig = JSON.parse(fs.readFileSync(config, "utf8"));
        } else {
            console.log("No config file\n\n");
            throw new Error(error.NO_CONFIG_FILE);
        }
        // register
        if(argv._[0] === undefined) {
            console.log("Invalid command");
            throw new Error(error.INVALID_COMMAND);
        } else if (argv._[0].toUpperCase() === "REGISTER") {
            checkParamsRegister(actualConfig);
            let wallet = {};
            if (!fs.existsSync(pathWallet) || !fs.lstatSync(pathWallet).isFile()) {
                console.log("Path provided dont work\n\n");
                throw new Error(error.INVALID_PATH);
            }
            try {
                const readWallet = await fs.readFileSync(pathWallet, "utf8");
                wallet = await ethers.Wallet.fromEncryptedJson(readWallet, passString);
            } catch (err) {
                throw new Error(error.INVALID_WALLET);
            }
            const hashSeed = await loadSeedHashChain(wallet.privateKey);
            await register(hashSeed, wallet, actualConfig, gasLimit, stake, url);
        // unregister
        } else if(argv._[0].toUpperCase() === "UNREGISTER") {
            checkParamsUnregister(actualConfig);
            let wallet = {};
            if (!fs.existsSync(pathWallet) || !fs.lstatSync(pathWallet).isFile()) {
                console.log("Path provided dont work\n\n");
                throw new Error(error.INVALID_PATH);
            }
            try {
                const readWallet = await fs.readFileSync(pathWallet, "utf8");
                wallet = await ethers.Wallet.fromEncryptedJson(readWallet, passString);
            } catch (err) {
                console.log(err);
                throw new Error(error.INVALID_WALLET);
            }
            await unregister(opId, wallet, actualConfig, gasLimit);
        } else if(argv._[0].toUpperCase() === "WITHDRAW") {
            checkParamsWithdraw(actualConfig);
            let wallet = {};
            if (!fs.existsSync(pathWallet) || !fs.lstatSync(pathWallet).isFile()) {
                console.log("Path provided dont work\n\n");
                throw new Error(error.INVALID_PATH);
            }
            try {
                const readWallet = await fs.readFileSync(pathWallet, "utf8");
                wallet = await ethers.Wallet.fromEncryptedJson(readWallet, passString);
            } catch (err) {
                console.log(err);
                throw new Error(error.INVALID_WALLET);
            }
            await withdraw(opId, wallet, actualConfig, gasLimit);
        } else if(argv._[0].toUpperCase() === "BALANCE") {
            let wallet = {};
            if (!fs.existsSync(pathWallet) || !fs.lstatSync(pathWallet).isFile()) {
                console.log("Path provided dont work\n\n");
                throw new Error(error.INVALID_PATH);
            }
            try {
                const readWallet = await fs.readFileSync(pathWallet, "utf8");
                wallet = await ethers.Wallet.fromEncryptedJson(readWallet, passString);
            } catch (err) {
                console.log(err);
                throw new Error(error.INVALID_WALLET);
            }
            const res = await getEtherBalance(wallet, actualConfig);
            console.log(res);
        } else {
            console.log("Invalid command");
            throw new Error(error.INVALID_COMMAND);
        }
        
    } catch (err) {
        console.log(Object.keys(error)[err.message]);
        process.exit(err.message);
    }
})();

function checkParamsRegister(actualConfig) {
    checkParam(pathWallet, "nowallet", "wallet");
    checkParam(passString, "nopassphrase", "password");
    checkParam(stake, "nostake", "stake");
    checkParam(url, "nourl", "url operator");
    checkParam(actualConfig.posAddress, undefined, "posAddress");
    checkParam(actualConfig.posAbi, undefined, "posAbi");
    checkParam(actualConfig.nodeUrl, undefined, "node URL");
}

function checkParamsUnregister(actualConfig) {
    checkParam(opId, -1, "operator id");
    checkParam(pathWallet, "nowallet", "wallet");
    checkParam(passString, "nopassphrase", "password");
    checkParam(actualConfig.posAddress, undefined, "posAddress");
    checkParam(actualConfig.posAbi, undefined, "posAbi");
    checkParam(actualConfig.nodeUrl, undefined, "node URL");
}

function checkParamsWithdraw(actualConfig) {
    checkParam(opId, -1, "operator id");
    checkParam(pathWallet, "nowallet", "wallet");
    checkParam(passString, "nopassphrase", "password");
    checkParam(actualConfig.posAddress, undefined, "posAddress");
    checkParam(actualConfig.posAbi, undefined, "posAbi");
    checkParam(actualConfig.nodeUrl, undefined, "node URL");
}

function checkParam(param, def, name) {
    if (param === def) {
        console.log(`It is necessary to specify ${name}\n\n`);
        throw new Error(error.NO_PARAM);
    }
}
