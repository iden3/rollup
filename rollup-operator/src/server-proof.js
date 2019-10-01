const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");

const { timeout } = require("../src/utils");

// global vars
const port = 10001;

const state = {
    IDLE: 0,
    ERROR: 1,
    PENDING: 2,
    FINISHED: 3,
};
let currentState = state.IDLE;
let isCancel = false;

let timeoutProof;
if( process.argv[2] == undefined) timeoutProof = 5000;
else timeoutProof = Number(process.argv[2]);

const testProof = {
    proofA: ["0", "0"],
    proofB: [["0", "0"], ["0", "0"]],
    proofC: ["0", "0"],
    input: undefined,
};

async function genProof() {
    const numLoops = timeoutProof / 1000;
    const loopTimeout = timeoutProof / numLoops;
    for (let i = 0; i < numLoops; i++) {
        if (!isCancel) await timeout(loopTimeout);
        else break;
    }
    // await timeout(timeoutProof);
    if(!isCancel) currentState = state.FINISHED;
    else {
        isCancel = false;
        console.log("CANCEL PROOF GENERATION");
    }
}
///// Server configuration
const app = express();
app.use(bodyParser.json());
app.use(cors());

app.post("/input", async (req, res) => {
    testProof.input = req.body;
    console.log("input received");
    currentState = state.PENDING;
    genProof();
    res.sendStatus(200);
});

app.get("/status", async (req, res) => {
    const ret = {};
    ret.state = currentState;
    if (currentState == state.FINISHED) {
        ret.proof = testProof;
    } 
    res.json(ret);
});

app.post("/cancel", async (req, res) => {
    if (currentState == state.PENDING) isCancel = true;
    currentState = state.IDLE;
    res.sendStatus(200);
});

///// Run server
const server = app.listen(port, "127.0.0.1", () => {
    const address = server.address().address;
    console.log(`Server proof running on http://${address}:${port}`);
});
// res.json({ username: 'Flavio' })