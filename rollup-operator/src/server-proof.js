const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const morgan = require("morgan");
const winston = require("winston");
const ip = require("ip");

const { timeout } = require("../src/utils");

// Configure winston logger
var options = {
    console: {
        level: "verbose",
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple(),
        )
    },
};

const logger = winston.createLogger({
    transports: [
        new winston.transports.Console(options.console)
    ]
});

// global vars
const port = 10001;

// Enum proof states
const state = {
    IDLE: 0,
    ERROR: 1,
    PENDING: 2,
    FINISHED: 3,
};
let currentState = state.IDLE;
let isCancel = false;

// Default time for proog genration is set to 5 seconds
// Proof generation time could be changed by passing in into the first parameter
let timeoutProof;
if( process.argv[2] == undefined) timeoutProof = 5000;
else timeoutProof = Number(process.argv[2]);

const testProof = {
    proofA: ["0", "0"],
    proofB: [["0", "0"], ["0", "0"]],
    proofC: ["0", "0"],
    publicInputs: undefined,
};

// Simulate proof generation
async function genProof() {
    const numLoops = timeoutProof / 1000;
    const loopTimeout = timeoutProof / numLoops;
    for (let i = 0; i < numLoops; i++) {
        if (!isCancel) await timeout(loopTimeout);
        else break;
    }
    if(!isCancel) currentState = state.FINISHED;
    else {
        isCancel = false;
        logger.verbose("CANCEL PROOF GENERATION");
    }
}
///// Server configuration
const app = express();
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));
app.use(cors());
app.use(morgan("dev"));

/**
 * POST
 * Receives zkSnark inputs and generates proof
 */
app.post("/input", async (req, res) => {
    logger.info("input received");
    currentState = state.PENDING;
    genProof();
    res.sendStatus(200);
});

/**
 * GET
 * Checks server status
 * If proof has been done, proof result is attached
 */
app.get("/status", async (req, res) => {
    const ret = {};
    ret.state = currentState;
    if (currentState == state.FINISHED) {
        ret.proof = testProof;
    } 
    res.json(ret);
});

/**
 * POST
 * Cancels proof computation
 */
app.post("/cancel", async (req, res) => {
    if (currentState == state.PENDING) isCancel = true;
    currentState = state.IDLE;
    logger.info("Reset server");
    res.sendStatus(200);
});


///// Run server locally
const server = app.listen(port, "127.0.0.1", () => {
    const address = server.address().address;
    logger.info(`Server proof running on http://${address}:${port}`);
});

///// Run server LAN
const serverLAN = app.listen(port, ip.address(), () => {
    const address = serverLAN.address().address;
    logger.info(`Server proof running on http://${address}:${port}`);
});