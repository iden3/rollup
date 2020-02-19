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
const { checkEnvVariables } = require("./utils");

const { argv } = require("yargs")
    .usage(`
operator <options>

options
=======
    operator <options>
        start operator with passphrase

    --passphrase or -p <passphrase string>
        Passphrase to decrypt the wallet
    
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
    .alias("p", "passphrase")
    .alias("pc", "pathconfig")
    .alias("c", "clear")
    .epilogue("Rollup operator");

// Log vars
const infoInit = `${chalk.bgCyan.black("LOADING")} ==> `;

// Global vars
const pathEnvFileDefault = `${__dirname}/config.env`;

let posSynch;
let rollupSynch;
let poolSynch;
let loopManager;
let opManager;
let logger;
let pool;

(async () => {
    let info;

    // Parse client command arguments
    const passString = (argv.passphrase) ? argv.passphrase : "nopassphrase";
    const pathEnvFile = (argv.pathconfig) ? argv.pathconfig : pathEnvFileDefault;
    const clearFlag = (argv.clear) ? argv.clear : false;
    const onlySynch = (argv.onlysynch) ? argv.onlysynch : false;

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
        synchConfig.rollup.creationHash,
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

    startRollup();
    startRollupPoS();
    loadServer(flagForge, envExpose, flagLAN);

    if (flagForge) {
        startLoopManager();
        startPool();
    }
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
    // start synchronizer PoS loop
    let info = infoInit;
    info += "Start Rollup PoS synchronizer";
    logger.info(info);
    posSynch.synchLoop();
}

function startRollup(){
    // start synchronizer Rollup loop
    let info = infoInit;
    info += "Start Rollup state synchronizer";
    logger.info(info);
    rollupSynch.synchLoop();
}

function startLoopManager(){
    // start synchronizer Manager loop
    let info = infoInit;
    info += "Start Rollup PoS manager";
    logger.info(info);
    loopManager.startLoop();
}

function startPool(){
    // start synchronizer Pool loop
    let info = infoInit;
    info += "Start Pool synchronizer";
    logger.info(info);
    poolSynch.synchLoop();
}

function loadServer(flagForge, expose, flagLAN){
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

        if (expose){
            let infoHttpPost = infoInit;
            infoHttpPost += "Load external http GET methods";
            logger.http(infoHttpPost);

            appExternal.get("/accounts/:id", async (req, res) => {
                const id = req.params.id;
                try {
                    const info = await rollupSynch.getStateById(id);
                    if (info === null)
                        res.status(404).send("Account not found");
                    else   
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
    
                if (ax === undefined && ay === undefined && ethAddr === undefined ){
                    res.status(400).send("No filters has been submitted");
                    return;
                }
                    
    
                // Filter first by AxAy or/and ethAddress
                if ((ax !== undefined && ay === undefined) || (ax === undefined && ay !== undefined)){
                    res.status(400).send("Babyjub key is not completed. Please provide both Ax and Ay");
                } else {
                    try {
                        if (ax !== undefined && ay !== undefined) {
                            accounts = await rollupSynch.getStateByAxAy(ax, ay);
                            if (ethAddr !== undefined && accounts !== null){
                                accounts = accounts.filter(account => {
                                    if (account.ethAddress.toLowerCase() == ethAddr.toLowerCase())
                                        return account;
                                });
                            }
                        } else 
                            accounts = await rollupSynch.getStateByEthAddr(ethAddr);
                
                        if (accounts === null || accounts.length === 0)
                            res.status(404).send("Accounts not found");    
                        else
                            res.status(200).json(stringifyBigInts(accounts));
                            
    
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
                    if (resFind === null)
                        res.status(404).send("No information was found");    
                    else 
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
                    if (resFind.length > 0)
                        res.status(200).json(stringifyBigInts(resFind));
                    else
                        res.status(404).send("No exits batch found");
                } catch (error) {
                    logger.error(`Message error: ${error.message}`);
                    logger.debug(`Message error: ${error.stack}`);
                    res.status(400).send("Error getting exit batches");
                }
            });
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
