const Web3 = require("web3");
const winston = require("winston");
const erc20Abi = require("./erc20-abi.js");
const ApiBitfinex = require("./api-bitfinex");
const fs = require("fs");
const { timeout } = require("../utils");
const { stringifyBigInts, unstringifyBigInts } = require("snarkjs");
const chalk = require("chalk");

const TIMEOUT_ERROR = 2000;
const TIMEOUT_NEXT_LOOP = 2000;
const TIMEOUT_LOGGER = 2000;

const lastBlockKey = "last-block-pool";
const tokenKey = "all-tokens-";

class SynchPool {
    constructor(
        db,
        nodeUrl,
        ethAddress,
        rollupAddress,
        rollupABI,
        pool,
        logLevel,
        pathCustomTokens,
    ) {
        this.db = db;
        this.nodeUrl = nodeUrl;
        this.ethAddress = ethAddress;
        this.web3 = new Web3(new Web3.providers.HttpProvider(this.nodeUrl));
        this.rollupAddress = rollupAddress;
        this.contractRollup = new this.web3.eth.Contract(rollupABI, this.rollupAddress);
        this.pool = pool;
        this.tokensList = {};
        this.tokensCustomList = {};
        this._initLogger(logLevel);
        this.apiBitfinex = new ApiBitfinex();
        this.pathCustomTokens = pathCustomTokens;
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

    _toString(val) {
        return JSON.stringify(stringifyBigInts(val));
    }

    _fromString(val) {
        return unstringifyBigInts(JSON.parse(val));
    }

    async _init(){
        // Start logger
        // this.logInterval = setInterval(() => {
        //     this.logger.info(this.info);
        // }, TIMEOUT_LOGGER );
    }

    async synchLoop() {
        this._init();
        // eslint-disable-next-line no-constant-condition
        while(true) {
            try {
                let lastSynchBlock = await this.getLastSynchBlock();
                const currentBlock = await this.web3.eth.getBlockNumber();
                let addedTokens = "";

                // Check if tokens has been added to Rollup
                if ( currentBlock > lastSynchBlock ) {
                    const logs = await this.contractRollup.getPastEvents("AddToken", {
                        fromBlock: lastSynchBlock + 1,
                        toBlock: currentBlock,
                    });
    
                    // Update new tokens and save them to database
                    if (logs.length > 0) {
                        for (let log in logs) {
                            const tokenInfo = await this._addToken(logs[log].returnValues);
                            let info = `${chalk.white.bold(`Symbol: ${tokenInfo.tokenSymbol}`)} | `;
                            info += chalk.white.bold(`Id: ${tokenInfo.tokenId}`);
                            addedTokens += ` | Add Token ==> ${info}`;
                        }
                        // Update token list which is stored on memory
                        await this.getAllTokens();
                    }
                    // Update last block synchronized
                    await this.db.insert(lastBlockKey, this._toString(currentBlock));
                }

                // Check information provided for custom tokens
                if (fs.existsSync(this.pathCustomTokens)) {
                    this.tokensCustomList = JSON.parse(fs.readFileSync(this.pathCustomTokens, "utf-8"));
                }

                // Update price for all tokens
                await this._updateTokensPrice();
                console.log(this.tokensList);
                // Update pool conversion table
                this._setConversion(this.tokensList);
                
                this._fillInfo(lastSynchBlock, currentBlock, addedTokens);

                await timeout(TIMEOUT_NEXT_LOOP);
            } catch (e) {
                this.logger.error(`POOL SYNCH Message error: ${e.message}`);
                this.logger.debug(`POOL SYNCH Message error: ${e.stack}`);

                await timeout(TIMEOUT_ERROR);
            }
        }
    }

    _fillInfo(lastSynchBlock, currentBlock, addedTokens){
        this.info = `${chalk.cyan("POOL SYNCH")} | `;
        this.info += `current block number: ${currentBlock} | `;
        this.info += `last block synched: ${lastSynchBlock}`;
        this.info += addedTokens;

        this.logger.info(this.info);        
    }

    async _updateTokensPrice() {
        for (const id in this.tokensList) {
            const tokenSymbol = this.tokensList[id].tokenSymbol;
            let infoToken;
            infoToken = await this.apiBitfinex.getToken(tokenSymbol);
            if (infoToken) {
                this.tokensList[id].price = infoToken;
            } else {
                console.log("Custom List: ", this.tokensCustomList);
                infoToken = this.tokensCustomList[tokenSymbol];
                if (infoToken) {
                    this.tokensList[id].price = infoToken.price;
                } else {
                    this.tokensList[id].price = 0;
                }
            }
        }
    }

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
            tokenSymbol = tokenId;
        }

        try {
            decimals = Number(await contractToken.methods.decimals()
                .call({from: this.ethAddress}));
        } catch(e) {
            decimals = 18;
        }
        const tokenObject = {tokenSymbol, decimals};

        await this.db.insert(`${tokenKey}${tokenId}`, this._toString(tokenObject));
        return { tokenSymbol, tokenId };
    }

    async getLastSynchBlock() {
        return this._fromString(await this.db.getOrDefault(lastBlockKey, "0"));
    }

    async getAllTokens() {
        const tokensDbKeys =  await this.db.listKeys(`${tokenKey}`);
        const lengthDB = tokensDbKeys.length;
        const lengthTokensList = Object.keys(this.tokensList).length;
        if (lengthDB > lengthTokensList) {
            for (let i = lengthTokensList; i < lengthDB; i++) {
                const tokenObject = this._fromString(await this.db.get(tokensDbKeys[i]));
                const tokenId = tokensDbKeys[i].replace(tokenKey, "");
                this.tokensList[tokenId] = {tokenSymbol: tokenObject.tokenSymbol.toString(), decimals: tokenObject.decimals};
            }
        }
    }

    _setConversion(conversion) {
        this.pool.setConversion(conversion);
    }
}

module.exports = SynchPool;
