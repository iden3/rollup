const winston = require("winston");
const fs = require("fs");
const chalk = require("chalk");

const { timeout } = require("./utils");

/**
 * Synchronize pool file
 * Pool file has all conversions for tokens
 * Conversion meaning of its value in $
 */
class SynchPool {
    /**
     * Initilize pool synchronizer
     * @param {Object} pool - Represents the transaction pool 
     * @param {String} pathConversionTable - Path to conversion table 
     * @param {String} logLevel - Logger level 
     * @param {Object} timeouts - Configure timeouts
     */
    constructor(
        pool,
        pathConversionTable,
        logLevel,
        timeouts,
    ) {
        this.pool = pool;
        this.pathConversionTable = pathConversionTable;
        
        this._initTimeouts(timeouts);
        this._initLogger(logLevel);
    }

    /**
     * Initilaize all timeouts
     * @param {Object} timeouts 
     */
    _initTimeouts(timeouts){
        const errorDefault = 5000;
        const nextLoopDefault = 10000;

        let timeoutError = errorDefault;
        let timeoutNextLoop = nextLoopDefault;

        if (timeouts !== undefined) {
            timeoutError = timeouts.ERROR || errorDefault;
            timeoutNextLoop = timeouts.NEXT_LOOP || nextLoopDefault;
        }

        this.timeouts = {
            ERROR: timeoutError,
            NEXT_LOOP: timeoutNextLoop,
        };
    }

    /**
     * Initilaize logger
     * @param {String} logLevel 
     */
    _initLogger(logLevel) {
        // config winston
        var options = {
            console: {
                level: logLevel,
                format: winston.format.combine(
                    winston.format.colorize(),
                    winston.format.simple(),
                )
            },
        };

        this.logger = winston.createLogger({
            transports: [
                new winston.transports.Console(options.console)
            ]
        });
    }

    /**
     * Get tokens conversion table
     * Update new tokens - Dollar price
     * Update pool conversion rate
     */
    async synchLoop() {
        // eslint-disable-next-line no-constant-condition
        while(true) {
            try {
                
                let flagRead = false;

                if (fs.existsSync(this.pathConversionTable)){
                    
                    // read table conversion from json
                    const tableConversion = JSON.parse(fs.readFileSync(this.pathConversionTable));
                
                    // update conversion table
                    this._setConversion(tableConversion.conversion);
                    this._setEthPrice(tableConversion.ethPrice);

                    flagRead = true;
                }

                // print info synch-pool
                this._fillInfo(flagRead);

                await timeout(this.timeouts.NEXT_LOOP);
            } catch (e) {
                this.logger.error(`POOL SYNCH Message error: ${e.message}`);
                this.logger.debug(`POOL SYNCH Message error: ${e.stack}`);
                await timeout(this.timeouts.ERROR);
            }
        }
    }

    /**
     * Send general information to logger
     * @param {Bool} flagRead - true if file was loaded successfully, false otherwise
     */
    _fillInfo(flagRead){
        this.info = `${chalk.cyan("POOL SYNCH".padEnd(12))} | `;
        this.info += flagRead ? "Success" : "Fail";
        this.info += " loading pool conversion table"; 

        this.logger.info(this.info);        
    }

    /**
     * Sets conversion rate to pool
     * @param {Object} conversion - tokens conversion rate
     */
    _setConversion(conversion) {
        this.pool.setConversion(conversion);
    }

    /**
     * Sets ether price to pool
     * @param {Number} ethPrice - Ethereum price in Dollars
     */
    _setEthPrice(ethPrice) {
        this.pool.setEthPrice(ethPrice);
    }
}

module.exports = SynchPool;
