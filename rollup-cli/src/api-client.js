var express = require('express');
var bodyParser = require('body-parser');

var app = express();
app.use(bodyParser.json())

app.post("/offchain/send", function(req, res) {
    let send = {
        from: req.body.from,
        to: req.body.to,
        amount: req.body.amount
    }
    if(send.from === undefined || send.to === undefined || send.amount === undefined) {
        res.sendStatus(500);
    } else {
        res.sendStatus(200);
    }
})

app.listen(9000, function() {
    console.log('App listening on port 9000')
})