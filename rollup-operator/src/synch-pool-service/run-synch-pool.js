const fs = require("fs");
const chalk = require("chalk");
const winston = require("winston");

const MemDb = require("../../../rollup-utils/mem-db");
const LevelDb = require("../../../rollup-utils/level-db");
const synchService = require("./synch-pool-service");

// Global vars
let poolSynch;
let logger;

// Log vars
const infoInit = `${chalk.bgCyan.black("LOADING")} ==> `;

(async () => {
    let info;
    // load environment data
    const pathEnvironmentFile = `${__dirname}/config.env`;
    require("dotenv").config({ path: pathEnvironmentFile });

    // load synch pool service configuration file
    let config;
    if (process.env.CONFIG_PATH) {
        config = JSON.parse(fs.readFileSync(process.env.CONFIG_PATH, "utf8"));
    } else {
        config = JSON.parse(fs.readFileSync("./synch-pool-config.json", "utf8"));
    }

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

    ///////////////////
    ///// INIT DATABASE
    ///////////////////
    let db;

    if (config.pathDb == undefined){
        info = infoInit;
        info += chalk.white.bold("memory database");
        logger.info(info);
        db = new MemDb();
    } else {
        info = infoInit;
        info += chalk.white.bold("levelDb database");
        logger.info(info);
        db = new LevelDb(config.pathDb);
    }

    ////////////////////
    ///// SYNCH SERVICE
    ///////////////////
    poolSynch = new synchService(
        db,
        config.ethNodeUrl,
        config.ethAddress,
        config.rollupAddress,
        config.rollupAbi,
        config.logLevel,
        config.pathConversionTable,
        config.pathCustomTokens,
        config.timeouts,
    );
    poolSynch.synchLoop();
})();