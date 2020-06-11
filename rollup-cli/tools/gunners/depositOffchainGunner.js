/* eslint-disable no-console */
/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
/* eslint-disable no-plusplus */
/* eslint-disable guard-for-in */

// const variables
const fs = require('fs');
const { stringifyBigInts } = require('ffjavascript').utils;
const path = require('path');
const ethers = require('ethers');
const { Scalar } = require('ffjavascript');

const feeTable = require('../../../js/constants').fee;
const { Wallet } = require('../../src/utils/wallet');
const CliExternalOperator = require('../../../rollup-operator/src/cli-external-operator');
const { createWallets } = require('./utils');

const configParamsPath = path.join(__dirname, 'config/params.json');


// Argument variables
const urlNodeEth = 'https://goerli.infura.io/v3/135e56bb9eaa42c59e73481fcb0f9b4a';
const pass = 'password';
const jsonWalletFrom = fs.readFileSync(path.join(__dirname, 'config/wallet.json'), 'utf-8');
const apiOperator = new CliExternalOperator('http://localhost:9000');
const coin = 0;
const addressTokens = '0xaff4481d10270f50f203e0763e2597776068cbc5';
const actualConfig = JSON.parse(fs.readFileSync(configParamsPath, 'utf8'));
const etherFund = 0;
const tokensFund = 0;
const pathWallets = path.join(__dirname, './config/wallets');
const { mnenonic } = actualConfig;

// parameters to change
const index = 200;
const numWallets = 10;
const fee = feeTable['50%'];

const ethPrice = 240; // put some more value than the current one to assurance
function timeout(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}


async function send() {
    const provider = new ethers.providers.JsonRpcProvider(urlNodeEth);
    const contractRollup = new ethers.Contract(actualConfig.rollupAddress, actualConfig.abiRollup, provider);

    const feeDepositOffchain = await contractRollup.depositFee();
    const feeTokenAmount = Scalar.e(feeDepositOffchain._hex);

    const amount = (Scalar.mul(Scalar.mul(feeTokenAmount, ethPrice), 2)).toString(); // * 2 cause fee is just the 50%
    const walletFrom = await Wallet.fromEncryptedJson(JSON.parse(jsonWalletFrom), pass);
    const walletBaby = walletFrom.babyjubWallet;
    const walletEthFrom = walletFrom.ethWallet.wallet;
    const fromLeaf = await apiOperator.getStateAccount(coin, walletBaby.publicKey[0].toString(16), walletBaby.publicKey[1].toString(16));
    const nonceToSend = fromLeaf.data.nonce;
    console.log(nonceToSend);


    console.log('from Wallet: ');
    console.log(`http://localhost:9000/accounts/${walletFrom.babyjubWallet.publicKey[0].toString(16)}/${walletFrom.babyjubWallet.publicKey[1].toString(16)}/${coin}`);

    const wallets = await createWallets(numWallets, tokensFund, pass, actualConfig.rollupAddress, walletEthFrom, etherFund,
        addressTokens, actualConfig.abiTokens, urlNodeEth, pathWallets, mnenonic, index);

    let i = 0;
    for (const indexWallet in wallets) {
        const toAx = wallets[indexWallet].babyjubWallet.publicKey[0].toString(16);
        const toAy = wallets[indexWallet].babyjubWallet.publicKey[1].toString(16);
        const toEthAddr = wallets[indexWallet].ethWallet.wallet.address;
        console.log('new Wallet: ');
        console.log(`http://localhost:9000/accounts/${toAx}/${toAy}/${coin}`);
        const tx = {
            toAx,
            toAy,
            toEthAddr,
            coin,
            amount,
            nonce: nonceToSend + i,
            fee,
            rqOffset: 0,
            onChain: 0,
            newAccount: 0,
        };
        await walletFrom.signRollupTx(tx); // sign included in transaction
        const parseTx = stringifyBigInts(tx);// convert bigint to Strings

        apiOperator.sendTx(parseTx).then((resTx) => {
            if (resTx.status.toString() === '200') {
                console.log('correct!');
            } else {
                console.log(resTx.response.data);
            }
        }).catch((error) => {
            console.log(error.message);
        });
        console.log('send!');
        i++;
        await timeout(0);
    }
}

send();
