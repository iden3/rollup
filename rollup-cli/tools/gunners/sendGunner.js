/* eslint-disable no-console */
/* eslint-disable no-await-in-loop */

// const variables
const fs = require('fs');
const { stringifyBigInts } = require('snarkjs');
const path = require('path');

const feeTable = require('../../../js/constants').fee;
const { Wallet } = require('../../src/wallet');
const CliExternalOperator = require('../../../rollup-operator/src/cli-external-operator');

// Argument variables
const pass = '123';
const wallet = fs.readFileSync(path.join(__dirname, 'config/wallet123.json'), 'utf-8');
const apiOperator = new CliExternalOperator('http://localhost:9000/');
const fromIdx = 3;
const numTx = 40;
const toIdx = 4;
const fee = feeTable['50%'];
const amount = 2;
const coin = 0;


function timeout(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}


async function send() {
    const walletRollup = await Wallet.fromEncryptedJson(JSON.parse(wallet), pass);
    const responseLeaf = await apiOperator.getAccountByIdx(fromIdx);
    const nonceToSend = responseLeaf.data.nonce;

    console.log(nonceToSend);
    for (let i = 0; i < numTx; i++) {
        const tx = {
            fromIdx,
            toIdx,
            coin,
            amount,
            nonce: nonceToSend + i,
            fee,
            rqOffset: 0,
            onChain: 0,
            newAccount: 0,
        };
        await walletRollup.signRollupTx(tx); // sign included in transaction
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
        await timeout(1000);
    }
}

send();
