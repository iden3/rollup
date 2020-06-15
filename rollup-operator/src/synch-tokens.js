const Web3 = require("web3");
const winston = require("winston");
const { stringifyBigInts, unstringifyBigInts } = require("ffjavascript").utils;
const Scalar = require("ffjavascript").Scalar;
const chalk = require("chalk");

const { timeout } = require("../src/utils");

// Database keys
const lastBlockKey = "last-block-tokens";
const tokenKey = "token-";

/**
 * Synchronize tokens added to rollup
 * - detect when a token is added to Rollup core contract
 */
class SynchTokens {
    /**
     * Initialize synchronizer
     * @param {Object} db - synchronizer database 
     * @param {String} nodeUrl - Ethereum node url
     * @param {String} ethAddress - Address to make pure/view calls
     * @param {String} rollupAddress - Rollup core address
     * @param {Object} rollupABI - Rollup core ABI interface
     * @param {String} logLevel - Logger level
     * @param {Object} timeouts - Configure timeouts
     */
    constructor(
        db,
        nodeUrl,
        ethAddress,
        rollupAddress,
        rollupABI,
        logLevel,
        timeouts,
    ) {
        this.db = db;
        this.nodeUrl = nodeUrl;
        this.ethAddress = ethAddress;
        this.web3 = new Web3(new Web3.providers.HttpProvider(this.nodeUrl));
        this.rollupAddress = rollupAddress;
        this.rollupABI = rollupABI;
        this.contractRollup = new this.web3.eth.Contract(rollupABI, this.rollupAddress);
        this._initLogger(logLevel);
        this._initTimeouts(timeouts);
    }

    /**
     * Initilaize all timeouts
     * @param {Object} timeouts 
     */
    _initTimeouts(timeouts){
        const errorDefault = 5000;
        const nextLoopDefault = 60000;

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
     * Init variables from database
     */
    async _init(){
        this.tokensList = {};
        this._loadTokens();
        this.feeAddToken = Scalar.e(await this.contractRollup.methods.feeAddToken()
            .call({from: this.ethAddress}));
    }

    /**
     * Convert to string
     * normally used in order to add it to database
     * @param {Any} - any input parameter
     * @returns {String}
     */
    _toString(val) {
        return JSON.stringify(stringifyBigInts(val));
    }

    /**
     * Get from string
     * normally used to get from database
     * @param {String} - string to parse
     * @returns {Any} 
     */
    _fromString(val) {
        return unstringifyBigInts(JSON.parse(val));
    }

    /**
     * Main loop
     * - synchronize new tokens
     * - store them on database
     */
    async synchLoop() {
        await this._init();

        // eslint-disable-next-line no-constant-condition
        while(true) {
            try {
                let lastSynchBlock = await this.getLastSynchBlock();
                const currentBlock = await this.web3.eth.getBlockNumber();

                // Check if tokens has been added to Rollup
                if (currentBlock > lastSynchBlock) {
                    const logs = await this.contractRollup.getPastEvents("AddToken", {
                        fromBlock: lastSynchBlock + 1,
                        toBlock: currentBlock,
                    });
                    // Update new tokens and save them to database
                    if (logs.length > 0) {
                        for (let log in logs) {
                            // Save tokens on database
                            const tokenInfo = await this._addToken(logs[log].returnValues);
                            // Print tokens information
                            let info = `${chalk.white.bold(`Address: ${tokenInfo.tokenAddress}`)} | `;
                            info += chalk.white.bold(`Id: ${tokenInfo.tokenId}`);
                            this._fillInfo(info);
                        }
                        // Update last token price
                        this.feeAddToken = Scalar.e(await this.contractRollup.methods.feeAddToken()
                            .call({from: this.ethAddress}));
                    }
                    // Update tokens list
                    this._loadTokens();
                    // Update last block synchronized
                    await this.db.insert(lastBlockKey, this._toString(currentBlock));
                }

                await timeout(this.timeouts.NEXT_LOOP);
            } catch (e) {
                this.logger.error(`SYNCH TOKENS Message error: ${e.message}`);
                this.logger.debug(`SYNCH TOKENS Message error: ${e.stack}`);
                await timeout(this.timeouts.ERROR);
            }
        }
    }

    /**
     * Triggers log message if token is added to rollup
     * @param {String} addedTokens - message with token added 
     */
    _fillInfo(addedTokens){
        this.info = `${chalk.cyan("SYNCH TOKENS")} | `;
        this.info += addedTokens;
        this.logger.info(this.info);
    }

    /**
     * Sends message directly to logger
     * specifically for error messages
     * @param {String} message - message to print 
     */
    _logError(message){
        let info = `${chalk.cyan("POOL SYNCH")} | `;
        info += "info ==>  ";
        info += chalk.white.bold(message);
        this.logger.info(info); 
    }

    /**
     * Add token information to database
     * @param {Object} eventValues - ethereum events
     * @returns {Object} - token basic information 
     */
    async _addToken(eventValues) {
        const tokenId = eventValues.tokenId;
        const tokenAddress = eventValues.tokenAddress;
        await this.db.insert(`${tokenKey}${tokenId}`, this._toString(tokenAddress));
        return { tokenId, tokenAddress };
    }

    /**
     * Update token list with database tokens
     */
    async _loadTokens() {
        const tokensDbKeys =  await this.db.listKeys(`${tokenKey}`);
        const lengthDb = tokensDbKeys.length;
        const lengthTokensList = Object.keys(this.tokensList).length;
        if (lengthDb > lengthTokensList) {
            for (let i = lengthTokensList; i < lengthDb; i++) {
                const tokenAddress = this._fromString(await this.db.get(tokensDbKeys[i]));
                const tokenId = tokensDbKeys[i].replace(tokenKey, "");
                this.tokensList[tokenId] = tokenAddress;
            }
        }
    }

    /**
     * Retrieve last block synched from database
     * @return {Number} - last block
     */
    async getLastSynchBlock() {
        return this._fromString(await this.db.getOrDefault(lastBlockKey, "0"));
    }

    /**
     * Retrieve tokens list
     * @return {Object} - list of all tokens added to zkRollup
     */
    getTokensList() {
        return this.tokensList;
    }

    /**
     * Retrieve current fee to add tokens
     * @return {String} - BigInt encoded as String
     */
    getCurrentFee() {
        return this.feeAddToken.toString();
    }
}

module.exports = SynchTokens;
