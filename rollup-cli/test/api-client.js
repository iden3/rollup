/* global BigInt */
/* eslint-disable no-console */
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const ethers = require('ethers');
const RollupTree = require('../../rollup-utils/rollup-tree');
const utils = require('../../rollup-utils/utils');

const walletBabyjubPathDefault = '../src/resources/babyjubWallet.json';
const walletEthPathDefault = '../src/resources/ethWallet.json';
const { BabyJubWallet } = require('../../rollup-utils/babyjub-wallet');

const app = express();
app.use(bodyParser.json());


app.post('/offchain/send', (req, res) => {
    const transaction = req.body;
    if (transaction.fromIdx === undefined || transaction.toIdx === undefined
        || transaction.amount === undefined || transaction.r8x === undefined || transaction.nonce === undefined
    || transaction.coin === undefined || transaction.userFee === undefined) {
        res.sendStatus(500);
    } else {
        res.sendStatus(200);
    }
});

app.get('/info/axay/:Ax/:Ay', async (req, res) => {
    if (req.params.Ax !== undefined && req.params.Ax !== undefined) {
        const walletEth = await ethers.Wallet.fromEncryptedJson(fs.readFileSync(walletEthPathDefault, 'utf8'), 'foo');
        const exitTree = await RollupTree.newMemRollupTree();
        const babyjubJson = fs.readFileSync(walletBabyjubPathDefault, 'utf8');
        const walletBaby = await BabyJubWallet.fromEncryptedJson(babyjubJson, 'foo');
        await exitTree.addId(1, 10, 0, BigInt(walletBaby.publicKey[0]), BigInt(walletBaby.publicKey[1]), BigInt(walletEth.address), 0);

        const infoId = await exitTree.getIdInfo(1);
        const siblingsId = utils.arrayBigIntToArrayStr(infoId.siblings);

        res.send([{
            tokenId: 0, balance: 10, Ax: 3, Ay: 4, ethaddress: 5, nonce: 0, id: 1, exitRoot: 6, sibilings: siblingsId,
        }, {
            tokenId: 1, balance: 10, Ax: 3, Ay: 4, ethaddress: 5, nonce: 0, id: 2, exitRoot: 6, sibilings: siblingsId,
        }]);
    }
});

app.listen(9000, () => {
    console.log('App listening on port 9000');
});
