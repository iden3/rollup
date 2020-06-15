/* eslint-disable no-console */
/* eslint-disable no-await-in-loop */

// const variables
const fs = require('fs');
const { stringifyBigInts } = require('ffjavascript').utils;
const path = require('path');

const feeTable = require('../../../js/constants').fee;
const { Wallet } = require('../../src/utils/wallet');
const CliExternalOperator = require('../../../rollup-operator/src/cli-external-operator');


// Argument variables
const pass = 'password';
const jsonWalletFrom = fs.readFileSync(path.join(__dirname, 'config/wallet.json'), 'utf-8');
const jsonWalletTo = fs.readFileSync(path.join(__dirname, './config/wallets/2wallet.json'));
const apiOperator = new CliExternalOperator('http://localhost:9000');
const numTx = 500;
const fee = feeTable['50%'];
const amount = 2;
const coin = 0;


function timeout(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}


async function send() {
    const walletFrom = await Wallet.fromEncryptedJson(JSON.parse(jsonWalletFrom), pass);
    const walletBaby = walletFrom.babyjubWallet;
    const fromLeaf = await apiOperator.getStateAccount(coin, walletBaby.publicKey[0].toString(16), walletBaby.publicKey[1].toString(16));
    const nonceToSend = fromLeaf.data.nonce;
    console.log(nonceToSend);

    const walletTo = await Wallet.fromEncryptedJson(JSON.parse(jsonWalletTo), pass);
    const toAx = walletTo.babyjubWallet.publicKey[0].toString(16);
    const toAy = walletTo.babyjubWallet.publicKey[1].toString(16);
    const toLeaf = await apiOperator.getStateAccount(coin, toAx, toAy);
    const toEthAddr = toLeaf.data.ethAddress;

    console.log('from Wallet: ');
    console.log(`http://localhost:9000/accounts/${walletFrom.babyjubWallet.publicKey[0].toString(16)}/${walletFrom.babyjubWallet.publicKey[1].toString(16)}/${coin}`);
    console.log('to Wallet: ');
    console.log(`http://localhost:9000/accounts/${walletTo.babyjubWallet.publicKey[0].toString(16)}/${walletTo.babyjubWallet.publicKey[1].toString(16)}/${coin}`);

    for (let i = 0; i < numTx; i++) {
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
        await timeout(0);
    }
}

send();
