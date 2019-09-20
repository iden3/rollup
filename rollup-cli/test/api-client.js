const express = require('express');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

app.post('/offchain/send', (req, res) => {
  const send = {
    IdFrom: req.body.transaction.IdFrom,
    idTo: req.body.transaction.idTo,
    amount: req.body.transaction.amount,
    nonce: req.body.transaction.nonce,
    sign: req.body.sign
  };
  if (send.IdFrom === undefined || send.idTo === undefined || send.amount === undefined||send.sign ===undefined||send.nonce ===undefined) {
    res.sendStatus(500);
    console.log("cachis")
  } else {
    res.send("OK");
    console.log("genial!")
  }
});

app.get('/offchain/info/:AxAy', (req, res) => {
  console.log("genial!")
  if (req.params.AxAy !==undefined)
  {
    res.send({value: {tokenid:1, balance:2, Ax:3, Ay:4, ethaddress:5, nonce:6, id:7}})
  }

});

app.listen(9000, () => {
  console.log('App listening on port 9000');
});
