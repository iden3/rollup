const Web3 = require("web3");
const { performance } = require("perf_hooks");
const winston = require("winston");
const chalk = require("chalk");
const Scalar = require("ffjavascript").Scalar;

const { timeout } = require("../../src/utils"); 

// Logging state information
const strState = [
    "Synchronizing",
    "Checking bids",
    "Bidding",
    "Mining",
];

// Enum states for loop bids
const state = {
    SYNCHRONIZING: 0,
    CHECK_BIDS: 1,
    BIDDING: 2,
    MINING: 3,
};

const winnerStruct = {
    FORGER: 0,
    BENEFICIARY: 1,
    URL: 2,
    AMOUNT: 3,
};

class LoopBids {

    constructor(
        rollupPoBAddress,
        rollupPoBABI,
        rollupSynch,
        pobSynch,
        poolTx,
        opManager,
        opUrl,
        nextBidPercent,
        nextBidSlot,
        logLevel,
        nodeUrl,
        timeouts,
        burnAddress
    ) {
        this.rollupSynch = rollupSynch;
        this.poolTx = poolTx;
        this.pobSynch = pobSynch;
        this.opManager = opManager;
        this.opUrl = opUrl;
        this.nextBidPercent = nextBidPercent;
        this.nextBidSlot = nextBidSlot;
        this.nodeUrl = nodeUrl;
        this.web3 = new Web3(new Web3.providers.HttpProvider(this.nodeUrl));
        this.contractPoB = new this.web3.eth.Contract(rollupPoBABI, rollupPoBAddress, burnAddress, {handleRevert: true});
        this.minBid = Number(this.web3.utils.fromWei(this.pobSynch.getMinBid().toString(), "ether"));

        this.state = state.SYNCHRONIZING;
        this.infoCurrentBid = {};
        this.currentTx = {};

        this._initTimeouts(timeouts);
        this._initLogger(logLevel);
    }


    /**
     * Initilaize all timeouts
     * @param {Object} timeouts 
     */
    _initTimeouts(timeouts){
        const errorDefault = 5000;
        const nextStateInit = 5000;

        let timeoutError = errorDefault;
        if (timeouts !== undefined) 
            timeoutError = timeouts.ERROR || errorDefault;  

        this.timeouts = {
            ERROR: timeoutError,
            NEXT_STATE: nextStateInit,
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
     * Main loop
     * Detect in which state is the manager
     * Each state has its own action to be triggered
     */
    async startBidsLoop() {
        
        // eslint-disable-next-line no-constant-condition
        while(true) {

            let info = `${chalk.cyanBright("BIDS STATE: ")}${chalk.white(strState[this.state])}`.padEnd(20);
            let currentSlot = 0;
            let timeTx = 0;

            // Fill log information depending on the state
            switch(this.state) {

            case state.CHECK_BIDS:
                currentSlot = await this.pobSynch.getCurrentSlot();
                info += " | check bid slot : ";
                info += `${chalk.white.bold(`${currentSlot + this.nextBidSlot}`)}`;
                break;
    
            case state.MINING:
                info += " | info ==> Transaction hash: ";
                info += chalk.white.bold(this.currentTx.txHash);
                timeTx = performance.now();
                if (this.currentTx.attempts)
                    info += `| ${this.currentTx.attempts} attempts`;
                info += " | transaction pending: ";
                info += `${chalk.white.bold(`${((timeTx - this.currentTx.startTx)/1000).toFixed(2)} s`)}`;
                break;
            }

            this.logger.info(info);

            try {
                switch(this.state) {

                // check all is fully synched
                case state.SYNCHRONIZING:
                    await this._fullySynch();
                    break;
                
                // check if operator is the winner
                case state.CHECK_BIDS: 
                    await this._checkBids();
                    break;

                // send bid
                case state.BIDDING:
                    await this._bidding();
                    break;
            
                // wait to mining transaction
                case state.MINING:
                    await this._monitorTx();
                    this.timeouts.NEXT_STATE = 10000;
                    break;
                }
                if (this.timeouts.NEXT_STATE) await timeout(this.timeouts.NEXT_STATE);

            } catch (e) {
                this.logger.error(`BIDS STATE Message error: ${e.message}`);
                this.logger.debug(`BIDS STATE Message error: ${e.stack}`);
                await timeout(this.timeouts.ERROR);
            }
        }
    }

    /**
     * Checks if synchronizers, either rollup core and rollup PoB,
     * are fully synchronized
     */
    async _fullySynch() {
        this.timeouts.NEXT_STATE = 5000;
        // check rollup is fully synched
        const rollupSynched = await this.rollupSynch.isSynched();
        // check PoB is fully synched
        const pobSynched = await this.pobSynch.isSynched();
        if (rollupSynched & pobSynched) { // Both 100% synched
            this.timeouts.NEXT_STATE = 0;
            this.state = state.CHECK_BIDS;
        }
    }

    async _checkBids() {
        const currentSlot = Number(await this.contractPoB.methods.currentSlot()
            .call({from: this.pobSynch.ethAddress}));
        const nextWinnerInfo = await this.contractPoB.methods.getWinner(currentSlot + this.nextBidSlot)
            .call({from: this.pobSynch.ethAddress});
        const nextWinner = nextWinnerInfo[winnerStruct.FORGER];
        if(this.opManager.wallet && nextWinner === this.opManager.wallet.address) {
            this.timeouts.NEXT_STATE = 5000;
            this.state = state.SYNCHRONIZING;
        } else {
            const nextBid = nextWinnerInfo[winnerStruct.AMOUNT];
            const maxTx = this.pobSynch.getMaxTx();
            const txs = await this.poolTx.getForgedTx(maxTx);
            let fee = 0;
            for (let i = 0; i < txs.length; i++) {
                if(txs[i].normalizedFee) {
                    fee+= txs[i].normalizedFee;
                }
            }
            let nextMinBid;
            if(nextBid === "0") {
                nextMinBid = this.minBid;
            } else {
                nextMinBid = nextBid + nextBid*this.nextBidPercent;
            }
            if(fee > nextMinBid) {
                this.infoCurrentBid.slotBid = currentSlot + this.nextBidSlot;
                this.infoCurrentBid.bid = nextMinBid;
                this.infoCurrentBid.startTime = performance.now();
                this.timeouts.NEXT_STATE = 0;
                this.state = state.BIDDING;
            } else {
                this.timeouts.NEXT_STATE = 5000;
                this.state = state.SYNCHRONIZING;
            }
        }
    }

    async _bidding() {
        let txSign;
        let tx;
        [txSign, tx] = await this.opManager.getTxBid(this.infoCurrentBid.slotBid, this.opUrl, this.infoCurrentBid.bid);

        this._setInfoTx(tx, txSign.transactionHash);

        this.state = state.MINING;
        this.timeouts.NEXT_STATE = 1000;
        const self = this;
        try { // sanity check
            await this.web3.eth.call(this.currentTx.tx);
        } catch (error) { // error evm transaction
            this._errorTx(error.message); 
            return;
        }
        this.web3.eth.sendSignedTransaction(txSign.rawTransaction)
            .then( receipt => {
                if (receipt.status == true) {
                    self._logTxOK();
                    self.timeouts.NEXT_STATE = 5000;
                    self.state = state.SYNCHRONIZING;
                    self._resetInfoTx();
                    self._resetInfoBid();
                } else { // unreachable code
                    self._errorTx("unreachable code loop-bids bidding: should be OK like the .call() sanity check");
                }
            })
            .catch( async (error) => {
                if (error.message.includes("Transaction was not mined within")) { //polling timeout
                    self.overwriteTx = true;
                    self._logTxOverwrite();
                } else { 
                    if(error.receipt) { // EVM error
                        await self.web3.eth.call(this.currentTx.tx, error.receipt.blocknumber) //catch the error
                            .then( () => {
                                self._errorTx("unreachable code loop-bids bidding: should be an error as the signed transaction, could run out of gas"); 
                            })
                            .catch( error => {
                                self._errorTx(error.message);
                            });
                    } else { //no EVM error
                        self._errorTx(error.message); 
                    }
                }
            });
    }

    /**
     * Monitors `bid` transaction
     */
    async _monitorTx(){

        if (!this.overwriteTx)
            return; 

        this.overwriteTx = false;
        if (this.currentTx.attempts > 5) {
            this._errorTx("it has been overwritten more than 5 times");
            return; 
        }
        const dataTx = await this.web3.eth.getTransaction(this.currentTx.txHash);
        if (!dataTx) {
            this._errorTx();
            return;
        }
        if (dataTx.blocknumber) { //already mined!
            this.timeouts.NEXT_STATE = 5000;
            this.state = state.SYNCHRONIZING;
            this._logTxOK();
            this._resetInfoTx();
            this._resetInfoBid();
            return;
        }
        this._updateTx(txSign.transactionHash);
        const txSign = await this.opManager.signTransaction(this.currentTx.tx);
        this._logResendTx();
        const self = this;

        try { //sanity check
            await this.web3.eth.call(this.currentTx.tx);
        } catch (error) { //error EVM transaction
            this._errorTx(error.message);
            return;
        }
        this.web3.eth.sendSignedTransaction(txSign.rawTransaction)
            .then( receipt => {
                if (receipt.status == true) {
                    self.timeouts.NEXT_STATE = 5000;
                    self.state = state.SYNCHRONIZING;
                    self._logTxOK();
                    self._resetInfoTx();
                    self._resetInfoBid();
                } else { //unreachable code
                    self._errorTx("unreachable code loop-bids monitor: should be OK like the .call() sanity check");
                }   
            })
            .catch( async (error) => {
                if (error.message.includes("Transaction was not mined within")) { // polling timeout
                    self.overwriteTx = true;
                    self._logTxOverwrite();
                } else { 
                    if (error.receipt) { // EVM error
                        await self.web3.eth.call(this.currentTx.tx, error.receipt.blocknumber) // catch the error
                            .then( () => {
                                self._errorTx("unreachable code loop-bids monitor: should be an error as the signed transaction, could run out of gas");
                            })
                            .catch( error => {
                                self._errorTx(error.message);
                            });
                    } else { // another error no EVM
                        self._errorTx(error.message); 
                    }
                }
            });
    }

    /**
     * Update ethereum transaction
     * @param {String} transactionHash - new transaction hash
     */
    _updateTx(transactionHash){
        // set double gas price 
        this.currentTx.tx.gasPrice = Scalar.mul(this.currentTx.tx.gasPrice, 2).toString(); 
        this.currentTx.startTx = performance.now();
        this.currentTx.attempts += 1;
        this.currentTx.txHash = transactionHash;
    }


    _setInfoTx(tx, transactionHash){
        this.currentTx.startTx = performance.now();
        this.currentTx.txHash = transactionHash;
        this.currentTx.tx = tx;
        this.currentTx.attempts = 0;
    }

    /**
     * Actions due to error:
     * - log error message
     * - reset transaction and bid
     * - go to SYNCH state
     * @param {String} reason - Error message 
     */
    _errorTx(reason) { 
        this._logTxKO(reason); 
        this._resetInfoTx();
        this._resetInfoBid();
        this.timeouts.NEXT_STATE = 5000;
        this.state = state.SYNCHRONIZING;
    }

    /**
     * Sends directly to logger information regarding successful mined transaction
     */
    _logTxOK(){
        this.timeouts.NEXT_STATE = 3200;
        let info = `${chalk.cyanBright("BID STATE: ")}${chalk.white(strState[this.state])}`;
        info += " | info ==> ";
        info += `${chalk.white.bold("Transaction mined succesfully")}`;
        this.logger.info(info);
    }


    /**
     * Sends directly to logger information regarding error mined transaction
     * @param {String} reason 
     */
    _logTxKO(reason){
        let info = `${chalk.cyanBright("BID STATE: ")}${chalk.white(strState[this.state])} | `;
        info += `${chalk.bgRed.black("transaction info")}`;
        if (reason)
            info += `${chalk.white.bold(` ==> Error at transaction: ${reason}`)}`;
        else   
            info += `${chalk.white.bold(" ==> Error at transaction, try to forge batch again")}`;
        this.logger.info(info);
    }

    /**
     * Reset transaction information
     */
    _resetInfoTx(){
        this.currentTx = {};
    }

    /**
     * Reset batch information
     */
    _resetInfoBid(){
        this.infoCurrentBid = {};
    }

    /**
     * Sends directly to logger information regarding resend ethereum transaction
     */
    _logResendTx(){
        let info = `${chalk.cyanBright("BID STATE: ")}${chalk.white(strState[this.state])}`;
        info += " | info ==> ";
        info += `${chalk.white.bold("Overwrite previous transaction doubling the gas price")}`;
        this.logger.info(info);
    }

}

module.exports = LoopBids;