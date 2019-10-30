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
const { stringifyBigInts, unstringifyBigInts } = require("snarkjs");
const MemDb = require("../../../rollup-utils/mem-db");
const LevelDb = require("../../../rollup-utils/level-db");

const Synchronizer = require("../synch");
const SynchPoS = require("../synch-pos");
const Pool = require("../../../js/txpool");
const OperatorManager = require("../operator-manager");
const CliServerProof = require("../cli-proof-server");
const LoopManager = require("../loop-manager");

// load environment data
const pathEnvironmentFile = `${__dirname}/config.env`;
require("dotenv").config({ path: pathEnvironmentFile });

// config winston
const loggerLevel = process.env.LOG_LEVEL;

var options = {
    console: {
        level: loggerLevel,
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
    logger.debug("Start PoS synch with memory database");
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
    synchConfig.ethAddressCaller,
    loggerLevel);

// start synchronizer loop
logger.info("Start synchronizer forge batch mechanism PoS");
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

(async () => {
    if((synchConfig.rollup.synchDb == undefined) || (synchConfig.rollup.treeDb == undefined)){
        logger.debug("Start Rollup synch with memory database");
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
        synchConfig.ethAddress,
        loggerLevel);

    // start synchronizer loop
    logger.info("Start synchronizer rollup");
    rollupSynch.synchLoop();

    // Intantiate pool
    const conversion = {};
    pool = await Pool(initRollupDb, conversion, poolConfig);

    ////////////////////
    ///// LOOP MANAGER
    ///////////////////
    loopManager = new LoopManager(rollupSynch, posSynch, pool, 
        opManager, cliServerProof, loggerLevel);
    
    logger.info("Start manager PoS");
    loopManager.startLoop();
})();

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
    try {
        const wallet = await ethers.Wallet.fromEncryptedJson(walletObj, req.body.pass);
        opManager.loadWallet(wallet);
        res.sendStatus(200);
    } catch (error) {
        logger.error(`Message error: ${error.message}`);
        logger.debug(`Message error: ${error.stack}`);
        res.send(400).status("Error loading wallet");
    }
});

appAdmin.post("/register/:stake", async (req, res) => {
    const stakeValue = req.params.stake;
    const url = req.body.url;
    const seed = req.body.seed;
    try {
        await loopManager.loadSeedHashChain(seed);
        const resManager = await loopManager.register(stakeValue, url);
        if (resManager) res.sendStatus(200);
        else res.status(500).send("Register cannot be done");
    } catch (error) {
        logger.error(`Message error: ${error.message}`);
        logger.debug(`Message error: ${error.stack}`);
        res.send(400).status("Error at the time to register operator");
    }
});

appAdmin.post("/unregister/:opId", async (req, res) => {
    const opId = req.params.opId;
    try {
        await opManager.unregister(opId);
        res.sendStatus(200);
    } catch (error) {
        logger.error(`Message error: ${error.message}`);
        logger.debug(`Message error: ${error.stack}`);
        res.send(400).status("Error at the time to unregister operator");
    }
});

appAdmin.post("/withdraw/:opId", async (req, res) => {
    const opId = req.params.opId;
    try {
        await opManager.withdraw(opId);
        res.sendStatus(200);
    } catch (error) {
        logger.error(`Message error: ${error.message}`);
        logger.debug(`Message error: ${error.stack}`);
        res.send(400).status("Error at the time to withdraw funds");
    }
});

appAdmin.post("/pool/conversion", async (req, res) => {
    try {
        await pool.setConversion(req.body.conversion);
        res.sendStatus(200);
    } catch (error) {
        logger.error(`Message error: ${error.message}`);
        logger.debug(`Message error: ${error.stack}`);
        res.send(400).status("Error setting pool conversion table");
    }
});

const serverAdmin = appAdmin.listen(portAdmin, "127.0.0.1", () => {
    const address = serverAdmin.address().address;
    logger.http(`Server admin running on http://${address}:${portAdmin}`);
});

///// API EXTERNAL
const appExternal = express();
appExternal.use(bodyParser.json());
appExternal.use(cors());
appExternal.use(morgan("dev"));
const portExternal = process.env.OPERATOR_PORT_EXTERNAL;

appExternal.get("/accounts/:id", async (req, res) => {
    const id = req.params.id;
    try {
        const info = await rollupSynch.getStateById(id);
        res.status(200).json(stringifyBigInts(info));
    } catch (error){
        logger.error(`Message error: ${error.message}`);
        logger.debug(`Message error: ${error.stack}`);
        res.status(400).send("Error getting accounts information");
    }
});
 
appExternal.get("/accounts", async (req, res) => {
    const ax = req.query.ax;
    const ay = req.query.ay;
    const ethAddr = req.query.ethAddr; 

    let accounts;

    if (ax === undefined && ay === undefined && ethAddr === undefined )
        res.status(400).send("No filters has been submitted");

    // Filter first by AxAy or/and ethAddress
    if ((ax !== undefined && ay === undefined) || (ax === undefined && ay !== undefined)){
        res.status(400).send("Babyjub key is not completed. Please provide both Ax and Ay");
    } else {
        try {
            if (ax !== undefined && ay !== undefined) {
                accounts = await rollupSynch.getStateByAxAy(ax, ay);
                if (ethAddr !== undefined){
                    accounts = accounts.filter(account => {
                        if (account.ethAddress.toLowerCase() == ethAddr.toLowerCase())
                            return account;
                    });
                }
            } else {
                accounts = await rollupSynch.getStateByEthAddr(ethAddr);
            }
            if (accounts.length > 0)
                res.status(200).json(stringifyBigInts(accounts));
            else
                res.status(400).send("No account has been found");

        } catch (error) {
            logger.error(`Message error: ${error.message}`);
            logger.debug(`Message error: ${error.stack}`);
            res.status(400).send("Error getting accounts information");
        }
    }
});

appExternal.get("/state", async (req, res) => {
    try {
        const generalInfo = await getGeneralInfo(); 
        res.status(200).json(generalInfo);
    } catch (error){
        logger.error(`Message error: ${error.message}`);
        logger.debug(`Message error: ${error.stack}`);
        res.status(400).send("Error getting general information");
    }
});

appExternal.get("/operators", async (req, res) => {
    try {
        const operatorList = await posSynch.getOperators();
        res.status(200).json(stringifyBigInts(operatorList));
    } catch (error) {
        logger.error(`Message error: ${error.message}`);
        logger.debug(`Message error: ${error.stack}`);
        res.status(400).send("Error getting operators list");
    }
});

appExternal.get("/exits/:numbatch/:id", async (req, res) => {
    const numBatch = req.params.numbatch;
    const id = req.params.id;
    try {
        const resFind = await rollupSynch.getExitTreeInfo(numBatch, id);
        res.status(200).json(stringifyBigInts(resFind));
    } catch (error) {
        logger.error(`Message error: ${error.message}`);
        logger.debug(`Message error: ${error.stack}`);
        res.status(400).send("Error getting exit tree information");
    }
});

appExternal.post("/pool", async (req, res) => {
    const tx = unstringifyBigInts(req.body);
    try {
        const isAdded = await pool.addTx(tx);
        if (isAdded === false)
            res.status(400).send("Error adding transaction to pool");   
        else
            res.sendStatus(200);
    } catch (error) {
        logger.error(`Message error: ${error.message}`);
        logger.debug(`Message error: ${error.stack}`);
        res.status(400).send("Error receiving off-chain transaction");
    }
});

const serverExternal = appExternal.listen(portExternal, "127.0.0.1", () => {
    const address = serverExternal.address().address;
    logger.http(`Server external running on http://${address}:${portExternal}`);
});