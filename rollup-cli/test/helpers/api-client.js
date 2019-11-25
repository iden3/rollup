/* eslint-disable no-console */
const express = require('express');
const bodyParser = require('body-parser');


const app = express();
app.use(bodyParser.json());


app.post('/pool', (req, res) => {
    const transaction = req.body;
    if (transaction.fromIdx === undefined || transaction.toIdx === undefined
        || transaction.amount === undefined || transaction.r8x === undefined || transaction.nonce === undefined
    || transaction.coin === undefined || transaction.userFee === undefined) {
        res.sendStatus(500);
    } else {
        res.sendStatus(200);
    }
});

app.get('/accounts', async (req, res) => {
    const { ax } = req.query;
    const { ay } = req.query;
    const { ethAddr } = req.query;

    const sibilings = [];
    if (ax !== undefined && ay !== undefined) {
        res.send([{
            tokenId: 0, balance: 10, Ax: ax, Ay: ay, ethaddress: 5, nonce: 0, id: 1, numExitRoot: 6, sibilings,
        }, {
            tokenId: 1, balance: 10, Ax: ax, Ay: ay, ethaddress: 5, nonce: 0, id: 2, numExitRoot: 6, sibilings,
        }]);
    } else if (ethAddr !== undefined) {
        res.send([{
            tokenId: 0, balance: 10, Ax: 3, Ay: 4, ethaddress: ethAddr, nonce: 0, id: 1, numExitRoot: 6, sibilings,
        }, {
            tokenId: 1, balance: 10, Ax: 3, Ay: 4, ethaddress: ethAddr, nonce: 0, id: 2, numExitRoot: 6, sibilings,
        }]);
    } else {
        res.sendStatus(404);
    }
});


app.get('/accounts/:id', async (req, res) => {
    if (req.params.id !== undefined) {
        const sibilings = [];
        res.send({
            tokenId: 0, balance: 10, Ax: 3, Ay: 4, ethaddress: 5, nonce: 0, idx: req.params.id, numExitRoot: 6, sibilings,
        });
    } else {
        res.sendStatus(404);
    }
});

app.get('/exits/:id', (req, res) => {
    const idBalanceTree = req.params.id;
    if (idBalanceTree !== undefined) {
        const exitBatches = [6, 21, 23];
        res.send(exitBatches);
    } else {
        res.sendStatus(404);
    }
});

app.get('/exits/:id/:numbatch', (req, res) => {
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
                    amount: 10,
                    ax: 'b13a882e6fc993b918fa2ac8a3342cdea1ad81dc1c7152df1addbe02abfef74',
                    ay: '20c7b37d9e1b15f26ce938425230e00cf5e9a7ebb42213b521371956b43bf861',
                    ethAddress: '0x2bde4955c58cb1df48fc93d640c8aa5c3d64018b',
                    idx: idBalanceTree,
                },
        };
        res.send(leafInfo);
    } else {
        res.sendStatus(404);
    }
});

app.listen(9000, () => {
    console.log('App listening on port 9000');
});
