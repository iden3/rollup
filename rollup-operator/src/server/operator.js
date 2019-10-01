const pathEnvironmentFile = `${__dirname}/config.env`;
require("dotenv").config({ path: pathEnvironmentFile});
const MemDb = require("../../../rollup-utils/mem-db");
const LevelDb = require("../../../rollup-utils/level-db");
const SMTMemDB = require("circomlib/src/smt_memdb");
const RollupDB = require("../../../js/rollupdb");
const fs = require("fs");
const { stringifyBigInts } = require("snarkjs");

const Synchronizer = require("../synch");
const SynchPoS = require("../synch-pos");
const Pool = require("../pool-tx");
const OperatorManager = require("../operator-manager");
const CliServerProof = require("../cli-proof-server");
const LoopManager = require("../loop-manager");

// Global vars

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

// load pool configuration
const poolConfig = {
    maxTx: 24,
};

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
const pool = new Pool(poolConfig.maxTx);

////////////////////////
/////CLIENT PROOF SERVER
////////////////////////
const cliServerProof = new CliServerProof(process.env.URL_SERVER_PORT);


////////////////////
///// LOOP MANAGER
///////////////////
const loopManager = new LoopManager(rollupSynch, posSynch, pool, 
    opManager, cliServerProof);
       
loopManager.startLoop();

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

app.get("/info/:Ax/:Ay", async (req, res) => {
    const Ax = req.params.Ax;
    const Ay = req.params.Ay;
    const info = await rollupSynch.getStateByAxAy(Ax, Ay);
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
app.post("/register/:stake", async (req, res) => {
    const stakeValue = req.params.stake;
    const resManager = await loopManager.register(stakeValue);
    if (resManager) res.sendStatus(200);
    else res.status(500).send("Register cannot be done");
    
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