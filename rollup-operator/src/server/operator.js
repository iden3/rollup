const fs = require("fs");
const ethers = require("ethers");
const morgan = require("morgan");
const winston = require("winston");
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");

const SMTMemDB = require("circomlib/src/smt_memdb");
const { SMTLevelDb } = require("../../../rollup-utils/smt-leveldb");
const RollupDB = require("../../../js/rollupdb");
const { stringifyBigInts } = require("snarkjs");
const MemDb = require("../../../rollup-utils/mem-db");
const LevelDb = require("../../../rollup-utils/level-db");

const Synchronizer = require("../synch");
const SynchPoS = require("../synch-pos");
const Pool = require("../../../js/txpool");
const OperatorManager = require("../operator-manager");
const CliServerProof = require("../cli-proof-server");
const LoopManager = require("../loop-manager");

// config winston
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

// load environment data
const pathEnvironmentFile = `${__dirname}/config.env`;
require("dotenv").config({ path: pathEnvironmentFile });

// load rollup synchronizers configuration file
let synchConfig;
if (process.env.CONFIG_SYNCH) {
    synchConfig = JSON.parse(fs.readFileSync(process.env.CONFIG_SYNCH, "utf8"));
} else {
    synchConfig = JSON.parse(fs.readFileSync("./rollup-synch-config.json", "utf8"));
}

// load pool configuration file
let pool;
let poolConfig;

if (process.env.CONFIG_POOL) {
    poolConfig = JSON.parse(fs.readFileSync(process.env.CONFIG_POOL, "utf8"));
} else {
    poolConfig = JSON.parse(fs.readFileSync("./pool-config.json", "utf8"));
}

////////////////
///// POS SYNCH
///////////////
let posDb;
let posSynch;

if (synchConfig.rollupPoS.synchDb == undefined) {
    logger.info("Start PoS synch with memory database");
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

    // Intantiate pool
    const conversion = {};
    pool = await Pool(initRollupDb, conversion, poolConfig);

    ////////////////////
    ///// LOOP MANAGER
    ///////////////////
    loopManager = new LoopManager(rollupSynch, posSynch, pool, 
        opManager, cliServerProof);
       
    loopManager.startLoop();
}

mainLoad();

async function getGeneralInfo() {
    const generalInfo = {};
    generalInfo["posSynch"] = {};
    generalInfo["rollupSynch"] = {};

    generalInfo.currentBlock = await posSynch.getCurrentBlock();

    generalInfo["posSynch"].isSynched = await posSynch.isSynched();
    generalInfo["posSynch"].synch = await posSynch.getSynchPercentage();
    generalInfo["posSynch"].genesisBlock = await posSynch.genesisBlock;
    generalInfo["posSynch"].lastEraSynch = await posSynch.getLastSynchEra();
    generalInfo["posSynch"].currentEra = await posSynch.getCurrentEra();
    generalInfo["posSynch"].currentSlot = await posSynch.getCurrentSlot();

    generalInfo["rollupSynch"].isSynched = await rollupSynch.isSynched();
    generalInfo["rollupSynch"].synch = await rollupSynch.getSynchPercentage();
    generalInfo["rollupSynch"].lastBlockSynched = await rollupSynch.getLastSynchBlock();
    generalInfo["rollupSynch"].lastBatchSynched = await rollupSynch.getLastBatch();

    return generalInfo;
}

/////////////
///// SERVERS
/////////////

///// API ADMIN
const appAdmin = express();
appAdmin.use(bodyParser.json());
appAdmin.use(cors());
appAdmin.use(morgan("dev"));
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

appAdmin.post("/pool/conversion", async (req, res) => {
    await pool.setConversion(req.body.conversion);
    res.sendStatus(200);
});

const serverAdmin = appAdmin.listen(portAdmin, "127.0.0.1", () => {
    const address = serverAdmin.address().address;
    logger.info(`Server admin running on http://${address}:${portAdmin}`);
});

///// API EXTERNAL
const appExternal = express();
appExternal.use(bodyParser.json());
appExternal.use(cors());
appExternal.use(morgan("dev"));
const portExternal = process.env.OPERATOR_PORT_EXTERNAL;

appExternal.get("/info/id/:id", async (req, res) => {
    const info = await rollupSynch.getStateById(req.params.id);
    res.send(stringifyBigInts(info));
});
 
appExternal.get("/info/axay/:Ax/:Ay", async (req, res) => {
    const Ax = req.params.Ax;
    const Ay = req.params.Ay;
    const info = await rollupSynch.getStateByAxAy(Ax, Ay);
    res.status(200).json(stringifyBigInts(info));
});

appExternal.get("/info/ethaddress/:ethAddress", async (req, res) => {
    const ethAddress = req.params.ethAddress;
    const info = await rollupSynch.getStateByEthAddr(ethAddress);
    res.status(200).json(stringifyBigInts(info));
});

appExternal.get("/state", async (req, res) => {
    const state = await rollupSynch.getState();
    res.status(200).json(stringifyBigInts(state));
});

appExternal.get("/info/general", async (req, res) => {
    const generalInfo = await getGeneralInfo(); 
    res.status(200).json(generalInfo);
});

appExternal.get("/info/operators", async (req, res) => {
    const operatorList = await posSynch.getOperators();
    res.status(200).json(stringifyBigInts(operatorList));
});

appExternal.post("/offchain/send", async (req, res) => {
    const tx = req.body.transaction;
    await pool.addTx(tx);
    res.sendStatus(200);
});

const serverExternal = appExternal.listen(portExternal, "127.0.0.1", () => {
    const address = serverExternal.address().address;
    logger.info(`Server external running on http://${address}:${portExternal}`);
});