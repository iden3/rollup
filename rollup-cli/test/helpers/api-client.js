/* global BigInt */
/* eslint-disable no-console */
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const ethers = require('ethers');
const RollupTree = require('../../../rollup-utils/rollup-tree');
const utils = require('../../../rollup-utils/utils');

const walletBabyjubPathDefault = '../src/resources/babyjubWallet.json';
const walletEthPathDefault = '../src/resources/ethWallet.json';
const { BabyJubWallet } = require('../../../rollup-utils/babyjub-wallet');

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
            tokenId: 0, balance: 10, Ax: 3, Ay: 4, ethaddress: 5, nonce: 0, id: 1, numExitRoot: 6, sibilings: siblingsId,
        }, {
            tokenId: 1, balance: 10, Ax: 3, Ay: 4, ethaddress: 5, nonce: 0, id: 2, numExitRoot: 6, sibilings: siblingsId,
        }]);
    }
});


app.get('/info/id/:id', async (req, res) => {
    if (req.params.id !== undefined) {
        const walletEth = await ethers.Wallet.fromEncryptedJson(fs.readFileSync(walletEthPathDefault, 'utf8'), 'foo');
        const exitTree = await RollupTree.newMemRollupTree();
        const babyjubJson = fs.readFileSync(walletBabyjubPathDefault, 'utf8');
        const walletBaby = await BabyJubWallet.fromEncryptedJson(babyjubJson, 'foo');
        await exitTree.addId(1, 10, 0, BigInt(walletBaby.publicKey[0]), BigInt(walletBaby.publicKey[1]), BigInt(walletEth.address), 0);

        const infoId = await exitTree.getIdInfo(1);
        const siblingsId = utils.arrayBigIntToArrayStr(infoId.siblings);

        res.send({
            tokenId: 0, balance: 10, Ax: 3, Ay: 4, ethaddress: 5, nonce: 0, idx: req.params.id, numExitRoot: 6, sibilings: siblingsId,
        });
    }
});

app.get('/info/exit/:numbatch/:id', (req, res) => {
    const numExitTree = req.params.numbatch;
    const idBalanceTree = req.params.id;
    if (numExitTree !== undefined && idBalanceTree !== undefined) {
        const leafInfo = {
            found: true,
            siblings: [],
            foundValue: '13566395666457202005979149204652133194563520159222764846657354429385751165798n',
            isOld0: false,
            state:
                {
                    coin: 0,
                    nonce: 0,
                    amount: 1,
                    ax: 'b13a882e6fc993b918fa2ac8a3342cdea1ad81dc1c7152df1addbe02abfef74',
                    ay: '20c7b37d9e1b15f26ce938425230e00cf5e9a7ebb42213b521371956b43bf861',
                    ethAddress: '0x2bde4955c58cb1df48fc93d640c8aa5c3d64018b',
                    idx: idBalanceTree,
                },
        };
        res.send(leafInfo);
    }
});

app.listen(9000, () => {
    console.log('App listening on port 9000');
});
