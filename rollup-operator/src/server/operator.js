const ethers = require("ethers");
const MemDb = require("../../../rollup-utils/mem-db");
const LevelDb = require("../../../rollup-utils/level-db");
const SMTMemDB = require("circomlib/src/smt_memdb");
const { SMTLevelDb } = require("../../../rollup-utils/smt-leveldb");
const RollupDB = require("../../../js/rollupdb");
const fs = require("fs");
const { stringifyBigInts } = require("snarkjs");

const Synchronizer = require("../synch");
const SynchPoS = require("../synch-pos");
const Pool = require("../pool-tx");
const OperatorManager = require("../operator-manager");
const CliServerProof = require("../cli-proof-server");
const LoopManager = require("../loop-manager");

const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");

// load environment data
const pathEnvironmentFile = `${__dirname}/config.env`;
require("dotenv").config({ path: pathEnvironmentFile});

// load rollup synchronizers configuration file
let synchConfig;
if (process.env.CONFIG_SYNCH) {
    synchConfig = JSON.parse(fs.readFileSync(process.env.CONFIG_SYNCH, "utf8"));
} else {
    synchConfig = JSON.parse(fs.readFileSync("./rollup-synch-config.json", "utf8"));
}

////////////////
///// POS SYNCH
///////////////
let posDb;
let posSynch;

if (synchConfig.rollupPoS.synchDb == undefined) {
    console.log("Start PoS synch with memory database");
    posDb = new MemDb();
} else {
    posDb = new LevelDb(synchConfig.rollupPoS.synchDb);
}

posSynch = new SynchPoS(
    posDb,
    synchConfig.ethNodeUrl,
    synchConfig.rollupPoS.address,
    synchConfig.rollupPoS.abi,
    synchConfig.rollupPoS.creationHash,
    synchConfig.ethAddressCaller);

// start synchronizer loop
posSynch.synchLoop();

//////////////////////
///// OPERATOR MANAGER
//////////////////////

const opManager = new OperatorManager(
    synchConfig.ethNodeUrl,
    synchConfig.rollupPoS.address,
    synchConfig.rollupPoS.abi);

///////////////////////
///// POOL OFF-CHAIN TX
///////////////////////
const maxTx = 10;
// TODO: Add final pool implementation
const pool = new Pool(maxTx);

////////////////////////
/////CLIENT PROOF SERVER
////////////////////////
const cliServerProof = new CliServerProof(process.env.URL_SERVER_PROOF);

///////////////////
///// ROLLUP SYNCH
///////////////////
let db;
let rollupSynchDb;
let rollupSynch;
let loopManager;

async function mainLoad() {
    if((synchConfig.rollup.synchDb == undefined) || (synchConfig.rollup.treeDb == undefined)){
        rollupSynchDb = new MemDb();
        db = new SMTMemDB();
    } else{
        rollupSynchDb = new LevelDb(synchConfig.rollup.synchDb);
        db = new SMTLevelDb(synchConfig.rollup.treeDb);
    }

    const initRollupDb = await RollupDB(db);
    rollupSynch = new Synchronizer(
        rollupSynchDb,
        initRollupDb,
        synchConfig.ethNodeUrl,
        synchConfig.rollup.address,
        synchConfig.rollup.abi,
        synchConfig.rollupPoS.address,
        synchConfig.rollupPoS.abi,
        synchConfig.creationHash,
        synchConfig.ethAddress);

    // start synchronizer loop
    rollupSynch.synchLoop();

    ////////////////////
    ///// LOOP MANAGER
    ///////////////////
    loopManager = new LoopManager(rollupSynch, posSynch, pool, 
        opManager, cliServerProof);
       
    loopManager.startLoop();
}

mainLoad();

/////////////
///// SERVERS
/////////////

///// API ADMIN
const appAdmin = express();
appAdmin.use(bodyParser.json());
appAdmin.use(cors());
const portAdmin = process.env.OPERATOR_PORT_ADMIN;

appAdmin.post("/loadwallet", async (req, res) => {
    const walletObj = req.body.wallet;
    const wallet = await ethers.Wallet.fromEncryptedJson(walletObj, req.body.pass);
    opManager.loadWallet(wallet);
    res.sendStatus(200);
});

appAdmin.post("/register/:stake/", async (req, res) => {
    const stakeValue = req.params.stake;
    const url = req.body.url;
    const seed = req.body.seed;
    await loopManager.loadSeedHashChain(seed);
    const resManager = await loopManager.register(stakeValue, url);
    if (resManager) res.sendStatus(200);
    else res.status(500).send("Register cannot be done");
});

appAdmin.post("/unregister/:opId", async (req, res) => {
    const opId = req.params.opId;
    await opManager.unregister(opId);
    res.sendStatus(200);
});

appAdmin.post("/withdraw/:opId", async (req, res) => {
    const opId = req.params.opId;
    await opManager.withdraw(opId);
    res.sendStatus(200);
});

const serverAdmin = appAdmin.listen(portAdmin, "127.0.0.1", () => {
    const address = serverAdmin.address().address;
    console.log(`Server admin running on http://${address}:${portAdmin}`);
});

///// API EXTERNAL
const appExternal = express();
appExternal.use(bodyParser.json());
appExternal.use(cors());
const portExternal = process.env.OPERATOR_PORT_EXTERNAL;

appExternal.get("/infoid/id/:id", async (req, res) => {
    const info = await rollupSynch.getStateById(req.params.id);
    res.send(stringifyBigInts(info));
});

appExternal.get("/infoaxay/axay/:Ax/:Ay", async (req, res) => {
    const Ax = req.params.Ax;
    const Ay = req.params.Ay;
    const info = await rollupSynch.getStateByAxAy(Ax, Ay);
    res.send(stringifyBigInts(info));
});

appExternal.get("/info/ethaddress/:ethAddress", async (req, res) => {
    const ethAddress = req.params.ethAddress;
    const info = await rollupSynch.getStateByEthAddr(ethAddress);
    res.send(stringifyBigInts(info));
});

appExternal.get("/state", async (req, res) => {
    const state = await rollupSynch.getState();
    res.send(stringifyBigInts(state));
});

appExternal.post("/offchain/send", async (req, res) => {
    const tx = req.body.transaction;
    pool.addTx(tx);
    res.sendStatus(200);
});

const serverExternal = appAdmin.listen(portExternal, "127.0.0.1", () => {
    const address = serverExternal.address().address;
    console.log(`Server external running on http://${address}:${portExternal}`);
});