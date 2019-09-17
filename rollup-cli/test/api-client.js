/* global BigInt */
const express = require("express");
const bodyParser = require("body-parser");
const RollupTree = require("../../rollup-utils/rollup-tree");
const utils = require("../../rollup-utils/utils");
const fs = require("fs");
const walletBabyjubPathDefault="../src/resources/babyjubWallet.json";
const walletEthPathDefault="../src/resources/ethWallet.json";
const { BabyJubWallet } = require("../../rollup-utils/babyjub-wallet");
const ethers = require("ethers");
const app = express();
app.use(bodyParser.json());


app.post("/offchain/send", (req, res) => {
    const send = {
        fromIdx: req.body.transaction.fromIdx,
        toIdx: req.body.transaction.toIdx,
        coin: req.body.transaction.coin,
        amount: req.body.transaction.amount,
        nonce: req.body.transaction.nonce,
        userFee: req.body.transaction.userFee,
        r8x: req.body.transaction.r8x,
        r8y: req.body.transaction.r8y,
        s: req.body.transaction.s
    };
    if (send.fromIdx === undefined || send.toIdx === undefined || send.amount === undefined||send.r8x ===undefined||send.nonce ===undefined
    ||send.coin ===undefined||send.userFee ===undefined) {
        res.sendStatus(500);
    } else {
        res.sendStatus(200);
    }
});


app.get("/offchain/info/:AxAy", async (req, res) => {
    if (req.params.AxAy !==undefined)
    {
        let  walletEth = await ethers.Wallet.fromEncryptedJson(fs.readFileSync(walletEthPathDefault, "utf8"), "foo");
        let exitTree = await RollupTree.newMemRollupTree();
        let babyjubJson= fs.readFileSync(walletBabyjubPathDefault, "utf8");
        let walletBaby = await BabyJubWallet.fromEncryptedJson(babyjubJson, "foo");
        await exitTree.addId(1, 10, 0, BigInt(walletBaby.publicKey[0]), BigInt(walletBaby.publicKey[1]), BigInt(walletEth.address), 0);

        const infoId = await exitTree.getIdInfo(1);
        const siblingsId = utils.arrayBigIntToArrayStr(infoId.siblings);
       
        console.log({siblingsId});
        console.log("OK");
        res.send({value: {tokenid:0, balance:10, Ax:3, Ay:4, ethaddress:5, nonce:0, id:1, exitRoot: 6, sibilings: siblingsId }}); //from 1, nonce 0, test depositOnTop
    }

});

app.listen(9000, () => {
    console.log("App listening on port 9000");
});
