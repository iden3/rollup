/* global BigInt */
const pathEnvironmentFile = `${__dirname}/config.env`;
require("dotenv").config({ path: pathEnvironmentFile});
const Synchronizer = require("../synch");
const MemDb = require("../../../rollup-utils/mem-db");
const SMTMemDB = require("circomlib/src/smt_memdb");
const RollupDB = require("../../../js/rollupdb");
const fs = require("fs");
const { stringifyBigInts } = require("snarkjs");
const Pool = require("../pool-tx");
const StakerManager = require("../staker-manager");

// Global vars
let synchConfig;
let poolConfig = {
    maxtTx: 24,
};
// Synchronizer database
let db;
let synchDb;
let synch;

// load synchronizer configuration file
if (process.env.CONFIG_SYNCH) {
    synchConfig = JSON.parse(fs.readFileSync(process.env.CONFIG_SYNCH, "utf8"));
} else {
    synchConfig = JSON.parse(fs.readFileSync("./synch-config.json", "utf8"));
}

let stakerConfig;
// load Staker manager wallet file
if (process.env.CONFIG_STAKER) {
    stakerConfig = JSON.parse(fs.readFileSync(process.env.CONFIG_STAKER, "utf8"));
} else {
    stakerConfig = JSON.parse(fs.readFileSync("./staker-config.json", "utf8"));
}

///////////////////
///// SYNCHRONYZER
//////////////////
if((synchConfig.synchDb == undefined) || (synchConfig.treeDb == undefined)) {
    console.log("Start memory database");
    // Init Synch Rollup database
    synchDb = new MemDb();
    db = new SMTMemDB();
    synchConfig.synchDb = synchDb;
    RollupDB(db).then(res => {
        synchConfig.treeDb = res;
        // start synchronizer loop
        synch = new Synchronizer(synchConfig.synchDb, synchConfig.treeDb, synchConfig.ethNodeUrl,
            synchConfig.contractAddress, synchConfig.abi, synchConfig.creationHash, synchConfig.ethAddress);

        synch.synchLoop()
            .catch((err) => console.error(`Synchronizer error: ${err.stack}`)); 
    });
} else {
    // start synchronizer loop
    synch = new Synchronizer(synchConfig.synchDb, synchConfig.treeDb, synchConfig.ethNodeUrl,
        synchConfig.contractAddress, synchConfig.abi, synchConfig.creationHash, synchConfig.ethAddress);

    synch.synchLoop()
        .catch((err) => console.error(`Synchronizer error: ${err.stack}`)); 
}


////////////////////
///// LOOP REGISTER
///////////////////

function startLoopStaker() {
    stakerManager.stakeLoop()
        .catch((err) => console.error(`Staker error: ${err.stack}`));
    
}





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



///////////////////////
///// POOL OFF-CHAIN TX
///////////////////////
const pool = new Pool(poolConfig.maxtTx);

///////////////////
///// STAKE MANAGER
///////////////////
const stakerManager = new StakerManager(stakerConfig.ethNodeUrl,
    stakerConfig.contractAddress, stakerConfig.abi, );

stakerManager.loadWallet(stakerConfig.walletPath, stakerConfig.passWallet);

///// Server configuration
const express = require("express");
const cors = require("cors");

const bodyParser = require("body-parser");

const app = express();
app.use(bodyParser.json());
app.use(cors());
const port = process.env.OPERATOR_PORT;

/////////////////////////
///// API Rollup Database
/////////////////////////
app.get("/info/:id", async (req, res) => {
    const info = await synch.getInfoById(req.params.id);
    res.send(stringifyBigInts(info));
});

app.get("/info/:AxAy", async (req, res) => {
    const babyPubKeyStr = (req.params.AxAy).split(",");
    const babyPubKey = babyPubKeyStr.map(x => BigInt(x));
    const info = await synch.getInfoByPubKey(babyPubKey);
    res.send(stringifyBigInts(info));
});

app.get("/state", async (req, res) => {
    const state = await synch.getState();
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
app.post("/forge/:numTx", async (req, res) => {
    const numTx = req.params.id;
    const txsToForge = pool.getTxToForge(numTx);
    const bb = await synch.getBlockBuilder();
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
    await stakerManager.register(rndHash, stakeValue);
    startLoopStaker();
    res.sendStatus(200);
});

app.post("/unregister", async (req, res) => {
    await stakerManager.unregister();
    res.sendStatus(200);
});

app.post("/withdraw", async (req, res) => {
    await stakerManager.withdraw();
    res.sendStatus(200);
});

///// Run server
const serverSynch = app.listen(port, "127.0.0.1", () => {
    const address = serverSynch.address().address;
    console.log(`Rollup synchronizer running on http://${address}:${port}`);
});