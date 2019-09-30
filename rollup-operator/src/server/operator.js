/* global BigInt */
const pathEnvironmentFile = `${__dirname}/config.env`;
require("dotenv").config({ path: pathEnvironmentFile});
const Synchronizer = require("../synch");
const SynchPoS = require("../synch-pos");
const MemDb = require("../../../rollup-utils/mem-db");
const LevelDb = require("../../../rollup-utils/level-db");
const SMTMemDB = require("circomlib/src/smt_memdb");
const RollupDB = require("../../../js/rollupdb");
const fs = require("fs");
const { stringifyBigInts } = require("snarkjs");
const Pool = require("../pool-tx");
const OperatorManager = require("../operator-manager");

// Global vars
let poolConfig = {
    maxtTx: 24,
};

// load rollup synch configuration file
let synchRollupConfig;
if (process.env.CONFIG_SYNCH_ROLLUP) {
    synchRollupConfig = JSON.parse(fs.readFileSync(process.env.CONFIG_SYNCH_ROLLUP, "utf8"));
} else {
    synchRollupConfig = JSON.parse(fs.readFileSync("./rollup-synch-config.json", "utf8"));
}

// load pos synch configuration file
let synchPoSConfig;
if (process.env.CONFIG_SYNCH_POS) {
    synchPoSConfig = JSON.parse(fs.readFileSync(process.env.CONFIG_SYNCH_POS, "utf8"));
} else {
    synchPoSConfig = JSON.parse(fs.readFileSync("./pos-synch-config.json", "utf8"));
}

// load operator manager configuration file
let opManagerConfig;
if (process.env.CONFIG_OP_MANAGER) {
    opManagerConfig = JSON.parse(fs.readFileSync(process.env.CONFIG_OP_MANAGER, "utf8"));
} else {
    opManagerConfig = JSON.parse(fs.readFileSync("./op-manager-config.json", "utf8"));
}

///////////////////
///// ROLLUP SYNCH
///////////////////
let db;
let rollupSynchDb;
let rollupSynch;

if((synchRollupConfig.synchDb == undefined) || (synchRollupConfig.treeDb == undefined)) {
    console.log("Start Rollup synch with memory database");
    // Init Synch Rollup database
    rollupSynchDb = new MemDb();
    db = new SMTMemDB();
    synchRollupConfig.synchDb = rollupSynchDb;
    RollupDB(db).then(res => {
        synchRollupConfig.treeDb = res;
        // start synchronizer loop
        rollupSynch = new Synchronizer(synchRollupConfig.synchDb, synchRollupConfig.treeDb, synchRollupConfig.ethNodeUrl,
            synchRollupConfig.contractAddress, synchRollupConfig.abi, synchRollupConfig.creationHash, synchRollupConfig.ethAddress);

        rollupSynch.synchLoop()
            .catch((err) => console.error(`Synchronizer error: ${err.stack}`)); 
    });
} else {
    // start synchronizer loop
    rollupSynch = new Synchronizer(synchRollupConfig.synchDb, synchRollupConfig.treeDb, synchRollupConfig.ethNodeUrl,
        synchRollupConfig.contractAddress, synchRollupConfig.abi, synchRollupConfig.creationHash, synchRollupConfig.ethAddress);

    rollupSynch.synchLoop()
        .catch((err) => console.error(`Synchronizer error: ${err.stack}`)); 
}

////////////////
///// POS SYNCH
///////////////
let posDb;
let posSynch;

if (synchPoSConfig.synchDb == undefined) {
    console.log("Start PoS synch with memory database");
    posDb = new MemDb();
} else {
    posDb = new LevelDb(synchPoSConfig.synchDb);
}

posSynch = new SynchPoS(posDb, synchPoSConfig.ethNodeUrl, synchPoSConfig.contractAddress,
    synchPoSConfig.abi, synchPoSConfig.creationHash, synchPoSConfig.ethAddress);
posSynch.synchLoop();

//////////////////////
///// OPERATOR MANAGER
//////////////////////

const opManager = new OperatorManager(synchPoSConfig.ethNodeUrl,
    synchPoSConfig.contractAddress, synchPoSConfig.abi, opManagerConfig.debug);

if (opManagerConfig.debug) {
    opManager.loadWallet(opManagerConfig.wallet);
} else {
    const wallet = fs.readFileSync(opManagerConfig.wallet);
    opManager.loadWallet(wallet, opManagerConfig.pass);
}


///////////////////////
///// POOL OFF-CHAIN TX
///////////////////////
const pool = new Pool(poolConfig.maxtTx);

////////////////////
///// LOOP MANAGER
///////////////////


// TODO:
// When operator is registered:
// start loop tracking raffle winner
// store global variable 'operatorId'
// when raffle winner matched operatorId:
// run automatically:
// get maxTx from pool
// build block & witness and send it to server proof
// send commited data to PoS
// poll server pool to get proof when it is ready
// forge commited data to PoS        

////////////////////
///// SERVER CONFIG
///////////////////
const express = require("express");
const cors = require("cors");

const bodyParser = require("body-parser");

const app = express();
app.use(bodyParser.json());
app.use(cors());
const port = process.env.OPERATOR_PORT;

/////////////////////////
///// API Rollup Synch
/////////////////////////
app.get("/info/:id", async (req, res) => {
    const info = await rollupSynch.getStateById(req.params.id);
    res.send(stringifyBigInts(info));
});

app.get("/info/:AxAy", async (req, res) => {
    const babyPubKeyStr = (req.params.AxAy).split(",");
    const babyPubKey = babyPubKeyStr.map(x => BigInt(x));
    const info = await rollupSynch.getStateByAxAy(babyPubKey);
    res.send(stringifyBigInts(info));
});

app.get("/info/:ethAddress", async (req, res) => {
    const ethAddress = req.params.ethAddress;
    const info = await rollupSynch.getStateByEthAddress(ethAddress);
    res.send(stringifyBigInts(info));
});

app.get("/state", async (req, res) => {
    const state = await rollupSynch.getState();
    res.send(stringifyBigInts(state));
});

///////////////////
///// API PoS Synch
///////////////////




///////////////////////////
///// API Pool off-chain Tx
///////////////////////////
app.post("/offchain/send", async (req, res) => {
    const tx = req.body.transaction;
    pool.addTx(tx);
    res.sendStatus(200);
});

///////////////
///// API ADMIN
///////////////
app.post("/forge/:numTx", async (req, res) => {
    const numTx = req.params.id;
    const txsToForge = pool.getTxToForge(numTx);
    const bb = await rollupSynch.getBatchBuilder();
    for (const tx of txsToForge) bb.addTx(tx);
    await bb.build();
    const input = bb.getInput();
    // Generate witness from input
    // Send witness to Server --> server will answer with an 'uuid' to do polling
    // - get 'uuid'
    // - poll this 'uuid' to get state of proof: 'NotSend', 'Pending', 'Ready'
    // - get proof is state is 'Ready'
    const rnd = Math.floor(Math.random() * 100000);
    res.send(rnd);
});

////////////////////////
///// API STAKER MANAGER
////////////////////////
app.post("/register/:hash/:stake", async (req, res) => {
    const rndHash = req.params.hash;
    const stakeValue = req.params.stake;
    await opManager.register(rndHash, stakeValue);
    res.sendStatus(200);
});

app.post("/unregister", async (req, res) => {
    await opManager.unregister();
    res.sendStatus(200);
});

app.post("/withdraw", async (req, res) => {
    await opManager.withdraw();
    res.sendStatus(200);
});

///// Run server
const serverSynch = app.listen(port, "127.0.0.1", () => {
    const address = serverSynch.address().address;
    console.log(`Rollup synchronizer running on http://${address}:${port}`);
});