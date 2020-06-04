const fs = require("fs");
const ethers = require("ethers");
const morgan = require("morgan");
const winston = require("winston");
const chalk = require("chalk");
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const rmRf = require("rimraf");
const ip = require("ip");
const SMTMemDB = require("circomlib/src/smt_memdb");
const { unstringifyBigInts } = require("ffjavascript").utils;

const { SMTLevelDb } = require("../../../../rollup-utils/smt-leveldb");
const RollupDB = require("../../../../js/rollupdb");
const MemDb = require("../../../../rollup-utils/mem-db");
const LevelDb = require("../../../../rollup-utils/level-db");
const { HttpMethods } = require("./http-methods-pos");

const Synchronizer = require("../../synch");
const SynchPoS = require("../../proof-of-stake/synch-pos");
const SynchPool = require("../../synch-pool");
const SynchTokens = require("../../synch-tokens");
const Pool = require("../../../../js/txpool");
const OperatorManager = require("../../proof-of-stake/interface-pos");
const CliServerProof = require("../../cli-proof-server");
const LoopManager = require("../../proof-of-stake/loop-manager-pos");
const Constants = require("../../constants");
const utils = require("../../../../rollup-utils/rollup-utils");
const { checkEnvVariables, checkPassEnv, getPassword } = require("../utils");

const { argv } = require("yargs")
    .usage(`
operator <options>

options
=======
    operator <options>
        start operator with passphrase
    
    --clear or -c [true | false]
        Erase persistent databases
        Default: false
    
    --pathconfig or --pc <path>
        Path to configuration environment file
        Default: ./config.env
    
    --onlysynch [true | false]
        Start operator in synch mode
        Default: false
    `)
    .alias("pc", "pathconfig")
    .alias("c", "clear")
    .epilogue("Rollup operator");

// Log vars
const infoInit = `${chalk.bgCyan.black("LOADING")} ==> `;

// Global vars
const pathEnvFileDefault = `${__dirname}/config.env`;

let posSynch;
let rollupSynch;
let tokenSynch;
let poolSynch;
let loopManager;
let opManager;
let logger;
let pool;

(async () => {
    let info;

    // Parse client command arguments
    // const passString = (argv.passphrase) ? argv.passphrase : "nopassphrase";
    const pathEnvFile = (argv.pathconfig) ? argv.pathconfig : pathEnvFileDefault;
    const clearFlag = (argv.clear === "true") ? true : false;
    const onlySynch = (argv.onlysynch === "true") ? true : false;

    // Check if environment mandatory data already exist
    if (checkEnvVariables()){
        // load environment data from configuration file
        if (fs.existsSync(pathEnvFile))
            require("dotenv").config({ path: pathEnvFile });
        else {
            console.error("Missing environment file");
            process.exit(0);
        }   
    }

    // Check again environment mandatory data
    if (checkEnvVariables()){
        console.error("Missing environment variables");
        process.exit(0);
    }

    // Check if password is on environment variables
    // skip it if synch mode is ON
    let passString;
    if (!onlySynch){
        if (checkPassEnv()){
            // ask password by console
            passString = await getPassword();
        } else {
            passString = process.env.PASSWORD;
        }
    }

    // Set default environment data if it is not specified
    const loggerLevel = (process.env.LOG_LEVEL) ? process.env.LOG_LEVEL : "info";
    const envExpose = (process.env.EXPOSE_API_SERVER === "false") ? false : true;
    const envOpMode = (process.env.OPERATOR_MODE) ? process.env.OPERATOR_MODE : "archive";
    const envGasMul = (process.env.GAS_MULTIPLIER) ? process.env.GAS_MULTIPLIER : 1;
    const envGasLimit = (process.env.GAS_LIMIT) ? process.env.GAS_LIMIT : "default";
    const flagLAN = (process.env.LAN === "true") ? true : false;
    const pollingTimeout = (process.env.POLLING_TIMEOUT) ? process.env.POLLING_TIMEOUT : 60;

    // config winston
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

    // config mode
    const operatorMode = Constants.mode[envOpMode];

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
    if (clearFlag){
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
        synchConfig.rollup.creationHash,
        synchConfig.ethAddress,
        loggerLevel,
        operatorMode,
        synchConfig.rollup.timeouts,
    );

    ///////////////////
    ///// TOKENS SYNCH
    ///////////////////
    if ( operatorMode === Constants.mode.archive ){
        tokenSynch = new SynchTokens(
            rollupSynchDb,
            synchConfig.ethNodeUrl,
            synchConfig.ethAddress,
            synchConfig.rollup.address,
            synchConfig.rollup.abi,
            loggerLevel,
            synchConfig.rollup.timeouts);
    }

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
    let flagForge = false;
    info = infoInit;
    info += "Initialize operator as: ";
    const walletPath = process.env.WALLET_PATH;
    let wallet = undefined;
    if (walletPath !== undefined && !onlySynch) {
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

        flagForge = true;
        info += chalk.bgWhite.black("FORGER AND SYNCHRONIZER");
        info += " | Operator public address: ";
        info += chalk.white.bold(wallet.address);
    } else {
        info += chalk.bgWhite.black("SYNCHRONIZER");
    }
    logger.info(info);

    // Initilaize classes if wallet is loaded
    if (flagForge) {

        //////////////////////
        ///// OPERATOR MANAGER
        //////////////////////
        opManager = new OperatorManager(
            synchConfig.ethNodeUrl,
            synchConfig.rollupPoS.address,
            synchConfig.rollupPoS.abi,
            wallet,
            envGasMul,
            envGasLimit);

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
            synchConfig.rollup.timeouts,
            pollingTimeout);
        
        const seed = utils.getSeedFromPrivKey(wallet.privateKey);
        await loopManager.loadSeedHashChain(seed);
    }

    startRollup(operatorMode);
    startRollupPoS();
    loadServer(flagForge, envExpose, flagLAN, operatorMode);

    if (flagForge) {
        startLoopManager();
        startPool();
    }
})();

// start synchronizer PoS loop
function startRollupPoS(){
    let info = infoInit;
    info += "Start Rollup PoS synchronizer";
    logger.info(info);
    posSynch.synchLoop();
}

// start synchronizer Rollup loop
function startRollup(operatorMode){
    let info = infoInit;
    info += "Start Rollup state synchronizer";
    logger.info(info);
    rollupSynch.synchLoop();
    if (operatorMode === Constants.mode.archive)
        tokenSynch.synchLoop();
}

// start synchronizer Manager loop
function startLoopManager(){
    let info = infoInit;
    info += "Start Rollup PoS manager";
    logger.info(info);
    loopManager.startLoop();
}

// start synchronizer Pool loop
function startPool(){
    let info = infoInit;
    info += "Start Pool synchronizer";
    logger.info(info);
    poolSynch.synchLoop();
}

/**
 * Load operator API http server
 * @param {Bool} flagForge - flag if the operator is forging. Activates POST method to get transactions 
 * @param {Bool} expose - flag to expose public API
 * @param {Bool} flagLAN - flag to expose operator on LAN. Localhost is always exposed 
 */
function loadServer(flagForge, expose, flagLAN, operatorMode){
    // Get server environment variables
    const portExternal = process.env.OPERATOR_PORT_EXTERNAL;

    /////////////////
    ///// LOAD SERVER
    /////////////////
    if (flagForge || expose) {
        const appExternal = express();
        appExternal.use(bodyParser.json());
        appExternal.use(cors());
        appExternal.use(morgan("dev"));

        const apiMethods = new HttpMethods(
            appExternal,
            rollupSynch,
            posSynch,
            tokenSynch,
            logger
        );

        if (expose){
            let infoHttpPost = infoInit;
            infoHttpPost += "Load external http GET methods";
            logger.http(infoHttpPost);

            apiMethods.initStateApi();
            apiMethods.initOperarorsApi();
            apiMethods.initExitsApi();
            apiMethods.initAccountsApi();

            if (operatorMode === Constants.mode.archive){
                apiMethods.initTokensApi();
                apiMethods.initBatchApi();
            }
        }

        if (flagForge){
            let infoHttpPost = infoInit;
            infoHttpPost += "Load external http POST method";
            logger.http(infoHttpPost);

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
        }

        const serverLocalHost = appExternal.listen(portExternal, "127.0.0.1", () => {
            const address = serverLocalHost.address().address;
            let infoHttp = infoInit;
            infoHttp += `Server external running on http://${address}:${portExternal}`;
            logger.http(infoHttp);
        });

        if (flagLAN){
            const serverLAN = appExternal.listen(portExternal, ip.address(), () => {
                const address = serverLAN.address().address;
                let infoHttp = infoInit;
                infoHttp += `Server running on http://${address}:${portExternal}`;
                logger.http(infoHttp);
            });
        }
    }
}
