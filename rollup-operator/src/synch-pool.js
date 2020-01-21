const winston = require("winston");
const fs = require("fs");
const { timeout } = require("./utils");
const chalk = require("chalk");

class SynchPool {
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

    async synchLoop() {
        // eslint-disable-next-line no-constant-condition
        while(true) {
            try {
                
                let flagRead = false;

                if (fs.existsSync(this.pathConversionTable)){
                    
                    // read table conversion from json
                    const tableConversion = JSON.parse(fs.readFileSync(this.pathConversionTable));
                
                    // update conversion table
                    this._setConversion(tableConversion);

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

    _fillInfo(flagRead){
        this.info = `${chalk.cyan("POOL SYNCH")} | `;
        this.info += flagRead ? "Success" : "Fail";
        this.info += " loading pool conversion table"; 

        this.logger.info(this.info);        
    }

    _setConversion(conversion) {
        this.pool.setConversion(conversion);
    }
}

module.exports = SynchPool;
