const express = require('express');
const bodyParser = require('body-parser');
const RollupTree = require("../../rollup-utils/rollup-tree");
const utils = require("../../rollup-utils/utils");
const fs = require('fs');
const walletBabyjubPathDefault="../src/resources/babyjubWallet.json"
const walletEthPathDefault="../src/resources/ethWallet.json"
const { BabyJubWallet } = require('../../rollup-utils/babyjub-wallet');
const ethers = require('ethers');
const app = express();
app.use(bodyParser.json());


app.post('/offchain/send', (req, res) => {
  const send = {
    IdFrom: req.body.transaction.IdFrom,
    idTo: req.body.transaction.idTo,
    coin: req.body.transaction.coin,
    amount: req.body.transaction.amount,
    nonce: req.body.transaction.nonce,
    userFee: req.body.transaction.userFee,
    sign: req.body.sign
  };
  if (send.IdFrom === undefined || send.idTo === undefined || send.amount === undefined||send.sign ===undefined||send.nonce ===undefined
    ||send.coin ===undefined||send.userFee ===undefined) {
      console.log(send.coin, send.userFee)
    res.sendStatus(500);
    console.log("cachis")
  } else {
    res.send("OK");
    console.log("genial!")
  }
});

app.post('/offchain/send', (req, res) => {
  const send = {
    IdFrom: req.body.transaction.IdFrom,
    idTo: req.body.transaction.idTo,
    coin: req.body.transaction.coin,
    amount: req.body.transaction.amount,
    nonce: req.body.transaction.nonce,
    userFee: req.body.transaction.userFee,
    sign: req.body.sign
  };
  if (send.IdFrom === undefined || send.idTo === undefined || send.amount === undefined||send.sign ===undefined||send.nonce ===undefined
    ||send.coin ===undefined||send.userFee ===undefined) {
      console.log(send.coin, send.userFee)
    res.sendStatus(500);
    console.log("cachis")
  } else {
    res.send("OK");
    console.log("genial!")
  }
});


app.get('/offchain/info/:AxAy', async (req, res) => {
  console.log("genial!")
  if (req.params.AxAy !==undefined)
  {
    let  walletEth = await ethers.Wallet.fromEncryptedJson(fs.readFileSync(walletEthPathDefault, "utf8"), "foo");
    exitTree = await RollupTree.newMemRollupTree();
  let babyjubJson= fs.readFileSync(walletBabyjubPathDefault, "utf8")
  let walletBaby = await BabyJubWallet.fromEncryptedJson(babyjubJson, "foo")
  await exitTree.addId(1, 10, 0, BigInt(walletBaby.publicKey[0]), BigInt(walletBaby.publicKey[1]), BigInt(walletEth.address), 0);

  const infoId = await exitTree.getIdInfo(1);
  const siblingsId = utils.arrayBigIntToArrayStr(infoId.siblings);
  const leafId = infoId.foundObject;
    console.log({siblingsId})
    console.log("todoguay")
    res.send({value: {tokenid:1, balance:2, Ax:3, Ay:4, ethaddress:5, nonce:0, id:1, exitRoot: 0, sibilings: null }}) //from 1, nonce 0, test depositOnTop
  }

});

app.listen(9000, () => {
  console.log('App listening on port 9000');
});
