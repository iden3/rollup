const fs = require("fs");
const ethers = require("ethers");
const morgan = require("morgan");
const winston = require("winston");
const chalk = require("chalk");
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const rmRf = require("rimraf");

const SMTMemDB = require("circomlib/src/smt_memdb");
const { SMTLevelDb } = require("../../../rollup-utils/smt-leveldb");
const RollupDB = require("../../../js/rollupdb");
const { stringifyBigInts, unstringifyBigInts } = require("snarkjs");
const MemDb = require("../../../rollup-utils/mem-db");
const LevelDb = require("../../../rollup-utils/level-db");

const Synchronizer = require("../synch");
const SynchPoS = require("../synch-pos");
const SynchPool = require("../synch-pool");
const Pool = require("../../../js/txpool");
const OperatorManager = require("../operator-manager");
const CliServerProof = require("../cli-proof-server");
const LoopManager = require("../loop-manager");
const Constants = require("../constants");
const utils = require("../../../rollup-utils/rollup-utils");

const { argv } = require("yargs")
    .usage(`
operator <options>

options
=======
    operator <options>
        start operator with passphrase

    --passphrase or -p <passphrase string>
        Passphrase to decrypt the wallet
    
    --clear [true | false]
        Erase persistent databases
        Default: false
    `)
    .alias("p", "passphrase")
    .epilogue("Rollup operator");

// Log vars
const infoInit = `${chalk.bgCyan.black("LOADING")} ==> `;

// Global vars
let posSynch;
let rollupSynch;
let poolSynch;
let loopManager;
let opManager;
let logger;
let pool;

(async () => {
    let info;
    // load environment data
    const pathEnvironmentFile = `${__dirname}/config.env`;
    require("dotenv").config({ path: pathEnvironmentFile });

    // config mode
    const operatorMode = Constants.mode[process.env.OPERATOR_MODE];

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

    logger = winston.createLogger({
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
    let poolConfig;

    if (process.env.CONFIG_POOL) {
        poolConfig = JSON.parse(fs.readFileSync(process.env.CONFIG_POOL, "utf8"));
    } else {
        poolConfig = JSON.parse(fs.readFileSync("./pool-config.json", "utf8"));
    }

    // delete database folders if `--clear true`
    const clearFlag = (argv.clear) ? argv.clear : false;

    if (clearFlag === "true"){
        if (synchConfig.rollup.synchDb)
            rmRf.sync(synchConfig.rollup.synchDb);
        if (synchConfig.rollup.treeDb)
            rmRf.sync(synchConfig.rollup.treeDb);
        if (synchConfig.rollupPoS.synchDb)
            rmRf.sync(synchConfig.rollupPoS.synchDb);
    }

    ///////////////////
    ///// ROLLUP SYNCH
    ///////////////////
    let db;
    let rollupSynchDb;

    if (synchConfig.rollup.synchDb == undefined){
        info = infoInit;
        info += "Rollup data synchronizer: ";
        info += chalk.white.bold("memory database");
        logger.info(info);
        rollupSynchDb = new MemDb();
    } else {
        info = infoInit;
        info += "Rollup data synchronizer: ";
        info += chalk.white.bold("levelDb database");
        logger.info(info);
        rollupSynchDb = new LevelDb(synchConfig.rollup.synchDb);
    }

    if (synchConfig.rollup.treeDb == undefined){
        info = infoInit;
        info += "Rollup balance tree: ";
        info += chalk.white.bold("memory database");
        logger.info(info);
        db = new SMTMemDB();
    } else {
        info = infoInit;
        info += "Rollup balance tree: ";
        info += chalk.white.bold("levelDb database");
        logger.info(info);
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
        loggerLevel,
        operatorMode,
        synchConfig.rollup.timeouts,
    );

    ////////////////
    ///// POS SYNCH
    ///////////////
    let posDb;

    if (synchConfig.rollupPoS.synchDb == undefined) {
        info = infoInit;
        info += "Rollup PoS synchronizer: ";
        info += chalk.white.bold("memory database");
        logger.info(info);
        posDb = new MemDb();
    } else {
        info = infoInit;
        info += "Rollup PoS synchronizer: ";
        info += chalk.white.bold("levelDb database");
        logger.info(info);
        posDb = new LevelDb(synchConfig.rollupPoS.synchDb);
    }

    posSynch = new SynchPoS(
        posDb,
        synchConfig.ethNodeUrl,
        synchConfig.rollupPoS.address,
        synchConfig.rollupPoS.abi,
        synchConfig.rollupPoS.creationHash,
        synchConfig.ethAddressCaller,
        loggerLevel,
        synchConfig.rollupPoS.timeouts,
    );

    /////////////////
    ///// LOAD WALLET
    /////////////////

    // Load wallet ( if specified ) and check if password provided is correct
    info = infoInit;
    info += "Initialize operator as: ";
    const walletPath = process.env.WALLET_PATH;
    let wallet = undefined;
    if (walletPath !== undefined) {
        const passString = (argv.passphrase) ? argv.passphrase : "nopassphrase";
        if (!fs.existsSync(walletPath) || !fs.lstatSync(walletPath).isFile()) {
            logger.error("Wallet path provided does not work\n");
            process.exit(0);
        }

        try {
            const readWallet = fs.readFileSync(walletPath, "utf8");
            wallet = await ethers.Wallet.fromEncryptedJson(readWallet, passString);
        } catch (err) {
            logger.error("Passphrase provided is not correct");
            process.exit(0);
        }

        info += chalk.bgWhite.black("FORGER AND SYNCHRONIZER");
        info += " | Operator public address: ";
        info += chalk.white.bold(wallet.address);
    } else {
        info += chalk.bgWhite.black("SYNCHRONIZER");
    }
    logger.info(info);

    // Initilaize classes if wallet is loaded
    if (wallet !== undefined) {

        //////////////////////
        ///// OPERATOR MANAGER
        //////////////////////
        opManager = new OperatorManager(
            synchConfig.ethNodeUrl,
            synchConfig.rollupPoS.address,
            synchConfig.rollupPoS.abi,
            wallet,
            process.env.GAS_MULTIPLIER,
            process.env.GAS_LIMIT);

        /////////////////////////
        ///// CLIENT PROOF SERVER
        /////////////////////////

        const cliServerProof = new CliServerProof(process.env.URL_SERVER_PROOF);

        //////////
        ///// POOL
        //////////
        const conversion = {};
        pool = await Pool(initRollupDb, conversion, poolConfig);

        ////////////////
        ///// SYNCH POOL
        ////////////////
        poolSynch = new SynchPool(
            pool,
            poolConfig.pathConversionTable,
            loggerLevel,
            poolConfig.timeouts,
        );

        ////////////////////
        ///// LOOP MANAGER
        ///////////////////
        loopManager = new LoopManager(
            rollupSynch,
            posSynch,
            pool, 
            opManager,
            cliServerProof,
            loggerLevel,
            synchConfig.ethNodeUrl,
            synchConfig.rollup.timeouts);
        
        const seed = utils.getSeedFromPrivKey(wallet.privateKey);
        await loopManager.loadSeedHashChain(seed);
        info = infoInit;
        info += "Start Rollup PoS manager";
        logger.info(info);
        loopManager.startLoop();
    }

    startRollup();
    startRollupPoS();
    startPool();
    loadServer();
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

function startRollupPoS(){
    // start synchronizer loop
    let info = infoInit;
    info += "Start Rollup PoS synchronizer";
    logger.info(info);
    posSynch.synchLoop();
}

function startRollup(){
    // start synchronizer loop
    let info = infoInit;
    info += "Start Rollup synchronizer";
    logger.info(info);
    rollupSynch.synchLoop();
}

function startPool(){
    // start synchronizer loop
    let info = infoInit;
    info += "Start Pool synchronizer";
    logger.info(info);
    poolSynch.synchLoop();
}

function loadServer(){
    /////////////////
    ///// LOAD SERVER
    /////////////////
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

    appExternal.get("/exits/:id/:numbatch", async (req, res) => {
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

    appExternal.get("/exits/:id", async (req, res) => {
        const id = req.params.id;
        try {
            const resFind = await rollupSynch.getExitsBatchById(id);
            res.status(200).json(stringifyBigInts(resFind));
        } catch (error) {
            logger.error(`Message error: ${error.message}`);
            logger.debug(`Message error: ${error.stack}`);
            res.status(400).send("Error getting exit batches");
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
        let infoHttp = infoInit;
        infoHttp += `Server external running on http://${address}:${portExternal}`;
        logger.http(infoHttp);
    });
}