const Web3 = require("web3");
const winston = require("winston");
const tokensABI = require("./tokensABI.js");
const ApiBitfinex = require("./api-bitfinex");
const fs = require("fs");
const { timeout } = require("../utils");
const { stringifyBigInts, unstringifyBigInts } = require("snarkjs");
const path = require("path");
const chalk = require("chalk");

const TIMEOUT_ERROR = 2000;
const TIMEOUT_NEXT_LOOP = 10000;

const lastBlockKey = "last-block-pool";
const tokenKey = "all-tokens-";
const pathCustom = path.join(__dirname,"/custom.json");

class SynchPool {
    constructor(
        db,
        nodeUrl,
        ethAddress,
        rollupAddress,
        rollupABI,
        pool,
        logLevel
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

    async synchLoop() {
        // eslint-disable-next-line no-constant-condition
        while(true) {
            let info = `${chalk.cyan("POOL SYNCH ")}`;
            try {
                let lastSynchBlock = await this.getLastSynchBlock();
                const currentBlock = await this.web3.eth.getBlockNumber();
                const logs = await this.contractRollup.getPastEvents("AddToken", {
                    fromBlock: lastSynchBlock,
                    toBlock: currentBlock - 1,
                });
                info += `INFO | fromBlock: ${lastSynchBlock} | toBlock: ${currentBlock}`;
                info += `| length: ${logs.length}`;
                if (fs.existsSync(pathCustom)) {
                    this.tokensCustomList = JSON.parse(fs.readFileSync(pathCustom, "utf-8"));
                }
                if(logs.length > 0) {
                    for(let log in logs) {
                        const token = await this._addToken(logs[log].returnValues);
                        info += `| ADD TOKEN ${token}`;
                    }
                }
                await this.getAllTokens();
                await this.db.insert(lastBlockKey, this._toString(currentBlock));
                await this._updateTokensPrice();
                console.log("tokenList", this.tokensList);
                this._setConversion(this.tokensList);
                
                this.logger.info(info);

                await timeout(TIMEOUT_NEXT_LOOP);
            } catch (e) {
                this.logger.error(`POOL SYNCH Message error: ${e.message}`);
                this.logger.debug(`POOL SYNCH Message error: ${e.stack}`);

                await timeout(TIMEOUT_ERROR);
            }
        }
        
    }

    async _updateTokensPrice() {
        for (const id in this.tokensList) {
            const token = this.tokensList[id].token;
            let infoToken;
            infoToken = await this.apiBitfinex.getToken(token);
            if(infoToken) {
                this.tokensList[id].price = infoToken;
            } else {
                infoToken = this.tokensCustomList[token];
                if(infoToken) {
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
        const contractToken = new this.web3.eth.Contract(tokensABI, tokenAddress);
        let token;
        let decimals;
        try {
            token = await contractToken.methods.symbol()
                .call({from: this.ethAddress});
        } catch(e) {
            token = tokenId;
        }

        try {
            decimals = await contractToken.methods.decimals()
                .call({from: this.ethAddress});
        } catch(e) {
            decimals = 18;
        }
        const tokenObject = {token, decimals};

        await this.db.insert(`${tokenKey}${tokenId}`, this._toString(tokenObject));
        return token;
       
    }

    async getLastSynchBlock() {
        return this._fromString(await this.db.getOrDefault(lastBlockKey,"0"));
    }

    async getAllTokens() {
        const tokensDB =  await this.db.listKeys(`${tokenKey}`);
        const lengthDB = tokensDB.length;
        const lengthTokensList = Object.keys(this.tokensList).length;
        if(lengthDB > lengthTokensList) {
            for (let i = lengthTokensList; i < lengthDB; i++) {
                const tokenObject = this._fromString(await this.db.get(tokensDB[i]));
                const tokenId = tokensDB[i].replace(tokenKey, "");
                this.tokensList[tokenId] = {token: tokenObject.token.toString(), decimals: tokenObject.decimals};
            }
        }
    }

    _fromString(val) {
        return unstringifyBigInts(JSON.parse(val));
    }

    _setConversion(conversion) {
        this.pool.setConversion(conversion);
    }
}

module.exports = SynchPool;