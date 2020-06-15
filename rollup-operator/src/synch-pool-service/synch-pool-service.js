const Web3 = require("web3");
const winston = require("winston");
const { stringifyBigInts, unstringifyBigInts } = require("ffjavascript").utils;
const fs = require("fs");
const chalk = require("chalk");

const erc20Abi = require("./erc20-abi");
const ApiBitfinex = require("./api-bitfinex");
const { timeout } = require("../utils");

// Database keys
const lastBlockKey = "last-block-pool";
const tokenKey = "all-tokens-";

// Symbol not found 
const symbolNotFound = "NOT_FOUND";

/**
 * Synchronize tokens prices
 * - detect when a token is added to Rollup core contract
 * - gets automatically its value in Dollars if possible
 * - update token conversion table ( external file )- Logger level
 * - if token is not found, its value is look on custom tokens file
 * - if any of the above trading pairs is not found, vlaue is set to 0
 */
class SynchPool {
    /**
     * Initialize synchronizer
     * @param {Object} db - synchronizer database 
     * @param {String} nodeUrl - Ethereum node url
     * @param {String} ethAddress - Address to make pure/view calls
     * @param {String} rollupAddress - Rollup core address
     * @param {Object} rollupABI - Rollup core ABI interface
     * @param {String} logLevel - Logger level
     * @param {String} pathConversionTable - Path to conversion table
     * @param {String} pathCustomTokens - Path to custom tokens trading values
     * @param {Object} timeouts - Configure timeouts
     */
    constructor(
        db,
        nodeUrl,
        ethAddress,
        rollupAddress,
        rollupABI,
        logLevel,
        pathConversionTable,
        pathCustomTokens,
        timeouts,
    ) {
        this.db = db;
        this.nodeUrl = nodeUrl;
        this.ethAddress = ethAddress;
        this.web3 = new Web3(new Web3.providers.HttpProvider(this.nodeUrl));
        this.rollupAddress = rollupAddress;
        this.rollupABI = rollupABI;
        this.contractRollup = new this.web3.eth.Contract(rollupABI, this.rollupAddress);
        this.tokensList = {};
        this.tokensCustomList = {};
        this.apiBitfinex = new ApiBitfinex();
        this.pathConversionTable = pathConversionTable;
        this.pathCustomTokens = pathCustomTokens;
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
     * normally used ti get from database
     * @param {String} - string to parse
     * @returns {Any} 
     */
    _fromString(val) {
        return unstringifyBigInts(JSON.parse(val));
    }

    /**
     * Main looop
     * - synchronize new tokens
     * - gets its price
     * - update table conversion
     */
    async synchLoop() {
        // eslint-disable-next-line no-constant-condition
        while(true) {
            try {
                let lastSynchBlock = await this.getLastSynchBlock();
                const currentBlock = await this.web3.eth.getBlockNumber();
                let addedTokens = "";
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
                            let info = `${chalk.white.bold(`Address: ${tokenInfo.tokenAddress}`)} | `;
                            info += `${chalk.white.bold(`Symbol: ${tokenInfo.tokenSymbol}`)} | `;
                            info += chalk.white.bold(`Id: ${tokenInfo.tokenId}`);
                            addedTokens += ` | Add Token ==> ${info}`;
                        }
                    }
                    // Update last block synchronized
                    await this.db.insert(lastBlockKey, this._toString(currentBlock));
                }

                // Update token list which is stored on memory
                await this.getAllTokens();

                // Check information provided for custom tokens
                if (fs.existsSync(this.pathCustomTokens))
                    this.tokensCustomList = JSON.parse(fs.readFileSync(this.pathCustomTokens, "utf-8"));
                else
                    this.tokensCustomList = {};

                // Update price for all tokens
                await this._updateTokensPrice();

                // Update ethereum price
                const ethPrice = await this._getEtherPrice();

                // Update pool conversion table
                this._setConversionTable(this.tokensList, ethPrice);
                
                // Log information
                this._fillInfo(lastSynchBlock, currentBlock, addedTokens);

                await timeout(this.timeouts.NEXT_LOOP);
            } catch (e) {
                this.logger.error(`POOL SYNCH Message error: ${e.message}`);
                this.logger.debug(`POOL SYNCH Message error: ${e.stack}`);
                await timeout(this.timeouts.ERROR);
            }
        }
    }

    /**
     * Update general synchronizer information
     * logger prints this information on logger main loop
     * @param {Number} lastSynchBlock - last synchronized ethereum block 
     * @param {Number} currentBlock - current ethereum block
     * @param {String} addedTokens - message with all tokens that has been added 
     */
    _fillInfo(lastSynchBlock, currentBlock, addedTokens){
        this.info = `${chalk.cyan("POOL SYNCH")} | `;
        this.info += `current block number: ${currentBlock} | `;
        this.info += `last block synched: ${lastSynchBlock}`;
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
     * Update price for all tokens
     * - try to get price from public Api
     * - otherwise get price from custom tokens file
     * - otherwise sets the price to 0
     */
    async _updateTokensPrice() {
        let listMarkets;
        try {
            listMarkets = await this.apiBitfinex.getTraddingPairs();
        } catch (error) {
            this._logError("api to get tokens price is not responding");
            listMarkets = null;
        }

        for (const id in this.tokensList) {
            const tokenSymbol = this.tokensList[id].tokenSymbol;
            let infoToken = undefined;
            // get api information
            if (listMarkets)
                infoToken = await this._getInfoToken(tokenSymbol, listMarkets);
            if (infoToken) {
                this.tokensList[id].price = infoToken;
            } else {
                // get token information on custom table
                const tokenAddress = this.tokensList[id].tokenAddress;
                infoToken = this.tokensCustomList[tokenAddress];
                if (infoToken) {
                    this.tokensList[id].price = infoToken.price;
                    this.tokensList[id].decimals = infoToken.decimals;
                } else {
                    this.tokensList[id].price = 0;
                    this.tokensList[id].decimals = 18;
                }
            }
        }
    }

    /**
     * Get token price from Bitfinex public API
     * @param {String} tokenSymbol - token symbol 
     * @param {Array} listMarkets - list of tradding pairs
     * @param {Number | undefined} - returns price if found, undefined otherwise
     */
    async _getInfoToken(tokenSymbol, listMarkets){
        try {
            let price = undefined;
            let marketFound = undefined;
            for (const market of listMarkets) {
                if (market.includes(tokenSymbol)){
                    marketFound = market;
                    break;
                }
            }

            if (marketFound) {
                const base = marketFound.replace(tokenSymbol, "");
                if (base === "USD") {
                    price = await this.apiBitfinex.getTokenLastPrice(tokenSymbol, "USD");
                } else if (base === "BTC" || base === "ETH"){
                    const conversionRate = await this.apiBitfinex.getTokenLastPrice(base, "USD"); 
                    const priceToken = await this.apiBitfinex.getTokenLastPrice(tokenSymbol, base);
                    price = conversionRate*priceToken;
                }
            }
            return price;
        } catch (error){
            return undefined;
        }
    }

    /**
     * Add basic ERC20 token information to database
     * @param {Object} eventValues - ethereum events
     * @returns {Object} - token basic information 
     */
    async _addToken(eventValues) {
        const tokenId = eventValues.tokenId;
        const tokenAddress = eventValues.tokenAddress;
        const contractToken = new this.web3.eth.Contract(erc20Abi, tokenAddress);
        let tokenSymbol;
        let decimals;
        try {
            tokenSymbol = await contractToken.methods.symbol()
                .call({from: this.ethAddress});
        } catch(e) {
            tokenSymbol = symbolNotFound;
        }

        try {
            decimals = Number(await contractToken.methods.decimals()
                .call({from: this.ethAddress}));
        } catch(e) {
            decimals = 18;
        }
        const tokenObject = {tokenSymbol, decimals, tokenAddress};

        await this.db.insert(`${tokenKey}${tokenId}`, this._toString(tokenObject));
        return { tokenSymbol, tokenId, tokenAddress };
    }

    /**
     * Get ethereum price in USD
     * @returns {Number} Ethereum price
     */
    async _getEtherPrice(){
        let ethPrice;
        try {
            ethPrice = await this.apiBitfinex.getTokenLastPrice("ETH", "USD");
        } catch (e){
            ethPrice = null;
        }

        return ethPrice;
    }

    /**
     * Retrieve last block synched from database
     * @return {Number} - last block
     */
    async getLastSynchBlock() {
        return this._fromString(await this.db.getOrDefault(lastBlockKey, "0"));
    }

    /**
     * Update token list with database tokens
     */
    async getAllTokens() {
        const tokensDbKeys =  await this.db.listKeys(`${tokenKey}`);
        const lengthDb = tokensDbKeys.length;
        const lengthTokensList = Object.keys(this.tokensList).length;
        if (lengthDb > lengthTokensList) {
            for (let i = lengthTokensList; i < lengthDb; i++) {
                const tokenObject = this._fromString(await this.db.get(tokensDbKeys[i]));
                const tokenId = tokensDbKeys[i].replace(tokenKey, "");
                this.tokensList[tokenId] = { tokenSymbol: tokenObject.tokenSymbol.toString(),
                    decimals: tokenObject.decimals, tokenAddress: tokenObject.tokenAddress };
            }
        }
    }

    /**
     * Writes conversion file with conversion and ethreum price
     * @param {Object} table - conversion table
     * @param {Number} ethPrice - ethereum price 
     */
    _setConversionTable(table, ethPrice) {
        const tableConversion = {};

        tableConversion.conversion = table;
        tableConversion.ethPrice = ethPrice;

        fs.writeFileSync(this.pathConversionTable, JSON.stringify(tableConversion));
    }
}

module.exports = SynchPool;
