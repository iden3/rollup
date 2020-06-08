const { stringifyBigInts } = require("ffjavascript").utils;

const utils = require("../utils");

/**
 * Expose http methods to retrieve rollup data
 */
class HttpMethods {

    /**
     * Initialize modules required to start api http methods
     * @param {Object} serverApp - operator server instance
     * @param {Object} rollupSynch - core rollup synchronizer
     * @param {Object} posSynch - PoS rollup synchronizer
     * @param {Object} tokensSynch - token synchronizer
     * @param {Object} logger - logger instance
     */
    constructor(
        serverApp,
        rollupSynch,
        posSynch,
        tokensSynch,
        logger 
    ){
        this.app = serverApp;
        this.rollupSynch = rollupSynch;
        this.posSynch = posSynch;
        this.tokensSynch = tokensSynch;
        this.logger = logger;
    }

    /**
     * Initilize http methods to get general rollup data
     */
    async initStateApi(){
        this.app.get("/state", async (req, res) => {
            try {
                const generalInfo = await utils.getGeneralInfo(this.rollupSynch, this.posSynch); 
                res.status(200).json(generalInfo);
            } catch (error){
                this.logger.error(`Message error: ${error.message}`);
                this.logger.debug(`Message error: ${error.stack}`);
                res.status(400).send("Error getting general information");
            }
        });
    }

    /**
     * Initilize http methods to get list of available operators
     */
    async initOperarorsApi(){
        this.app.get("/operators", async (req, res) => {
            try {
                const operatorList = await this.posSynch.getOperators();
                res.status(200).json(stringifyBigInts(operatorList));
            } catch (error) {
                this.logger.error(`Message error: ${error.message}`);
                this.logger.debug(`Message error: ${error.stack}`);
                res.status(400).send("Error getting operators list");
            }
        });
    }

    /**
     * Initilize http methods to get data regarding tokens
     */
    async initTokensApi(){
        this.app.get("/tokens", async (req, res) => {
            try {
                const infoTokens = await this.tokensSynch.getTokensList();
                if (Object.keys(infoTokens).length === 0)
                    res.status(404).send("Tokens not found");
                else   
                    res.status(200).json(stringifyBigInts(infoTokens));
            } catch (error){
                this.logger.error(`Message error: ${error.message}`);
                this.logger.debug(`Message error: ${error.stack}`);
                res.status(400).send("Error getting token list information");
            }
        });

        this.app.get("/feetokens", async (req, res) => {
            try {
                const feetokens = await this.tokensSynch.getCurrentFee();
                res.status(200).json(stringifyBigInts(feetokens));
            } catch (error){
                this.logger.error(`Message error: ${error.message}`);
                this.logger.debug(`Message error: ${error.stack}`);
                res.status(400).send("Error getting fee token information");
            }
        });
    }

    /**
     * Initilize http methods to get data regarding individual batches
     */
    async initBatchApi(){
        this.app.get("/batch/:numbatch", async (req, res) => {
            const numBatch = req.params.numbatch;
            try {
                const infoTx = await this.rollupSynch.getBatchInfo(numBatch);
                if (infoTx === null)
                    res.status(404).send("Batch not found");
                else   
                    res.status(200).json(stringifyBigInts(infoTx));
            } catch (error){
                this.logger.error(`Message error: ${error.message}`);
                this.logger.debug(`Message error: ${error.stack}`);
                res.status(400).send("Error getting batch information");
            }
        });
    }

    /**
     * Initilize http methods to get data regarding exits information
     */
    async initExitsApi(){
        this.app.get("/exits/:ax/:ay/:coin/:numbatch", async (req, res) => {
            const numBatch = req.params.numbatch;
            const ax = req.params.ax;
            const ay = req.params.ay;
            const coin = req.params.coin;

            try {
                const resFind = await this.rollupSynch.getExitTreeInfo(numBatch, coin, ax, ay);
                if (resFind === null)
                    res.status(404).send("No information was found");    
                else 
                    res.status(200).json(stringifyBigInts(resFind));
                    
            } catch (error) {
                this.logger.error(`Message error: ${error.message}`);
                this.logger.debug(`Message error: ${error.stack}`);
                res.status(400).send("Error getting exit tree information");
            }
        });

        this.app.get("/exits/:ax/:ay/:coin", async (req, res) => {
            const ax = req.params.ax;
            const ay = req.params.ay;
            const coin = req.params.coin;

            try {
                const resFind = await this.rollupSynch.getExitsBatchById(coin, ax, ay);
                if (resFind === null || resFind.length === 0)
                    res.status(404).send("No exits batch found");
                else
                    res.status(200).json(stringifyBigInts(resFind));
            } catch (error) {
                this.logger.error(`Message error: ${error.message}`);
                this.logger.debug(`Message error: ${error.stack}`);
                res.status(400).send("Error getting exit batches");
            }
        });
    }

    /**
     * Initilize http methods to get data regarding rollup accounts
     */
    async initAccountsApi(){
        this.app.get("/accounts/:ax/:ay/:coin", async (req, res) => {
            const ax = req.params.ax;
            const ay = req.params.ay;
            const coin = req.params.coin;
            try {
                const info = await this.rollupSynch.getStateByAccount(coin, ax, ay);
                if (info === null)
                    res.status(404).send("Account not found");
                else   
                    res.status(200).json(stringifyBigInts(info));
            } catch (error){
                this.logger.error(`Message error: ${error.message}`);
                this.logger.debug(`Message error: ${error.stack}`);
                res.status(400).send("Error getting accounts information");
            }
        });
 
        this.app.get("/accounts", async (req, res) => {
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
                        accounts = await this.rollupSynch.getStateByAxAy(ax, ay);
                        if (ethAddr !== undefined && accounts !== null){
                            accounts = accounts.filter(account => {
                                if (account.ethAddress.toLowerCase() == ethAddr.toLowerCase())
                                    return account;
                            });
                        }
                    } else 
                        accounts = await this.rollupSynch.getStateByEthAddr(ethAddr);
            
                    if (accounts === null || accounts.length === 0)
                        res.status(404).send("Accounts not found");    
                    else
                        res.status(200).json(stringifyBigInts(accounts));
                        

                } catch (error) {
                    this.logger.error(`Message error: ${error.message}`);
                    this.logger.debug(`Message error: ${error.stack}`);
                    res.status(400).send("Error getting accounts information");
                }
            }
        });
    }
}

module.exports = {
    HttpMethods,
};