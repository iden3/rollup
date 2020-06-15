const Web3 = require("web3");
const winston = require("winston");
const chalk = require("chalk");
const { stringifyBigInts, unstringifyBigInts } = require("ffjavascript").utils;

const { timeout } = require("../utils");

// db keys
const lastSlotKey = "last-slot-synch";

const winnerStruct = {
    FORGER: 0,
    BENEFICIARY: 1,
    URL: 2,
    AMOUNT: 3,
};

/**
* Synchronize Rollup proof-of-burn (PoB) smart contract 
*/
class SynchPoB {
    /**
     * Initialize Synchronizer parameters
     * @param {Object} db - Synchronizer PoB database
     * @param {String} nodeUrl - Ethereum node url
     * @param {String} rollupPoBAddress - Rollup PoB address
     * @param {Object} rollupPoBABI - Rollup PoB ABI interface
     * @param {String} rollupPoBCreationHash - Rollup PoB creation hash 
     * @param {String} ethAddress - Address to make pure/view calls
     * @param {String} logLevel - Logger level
     * @param {Object} timeouts - Configure timeouts
     * @param {String} burnAddress - Burn Address
     */
    constructor(
        db,
        nodeUrl,
        rollupPoBAddress,
        rollupPoBABI,
        rollupPoBCreationHash,
        ethAddress,
        logLevel,
        timeouts,
        burnAddress
    ) {
        this.info = "";
        this.db = db;
        this.nodeUrl = nodeUrl;
        this.rollupPoBAddress = rollupPoBAddress;
        this.creationHash = rollupPoBCreationHash;
        this.ethAddress = ethAddress;
        this.web3 = new Web3(new Web3.providers.HttpProvider(this.nodeUrl));
        this.contractPoB = new this.web3.eth.Contract(rollupPoBABI, this.rollupPoBAddress, burnAddress, {handleRevert: true});
        this.winners = [];
        this.currentWinners = [];
        this.slots = [];
        this.bids = [];

        this._initTimeouts(timeouts);
        this._initLogger(logLevel);
    }

    /**
     * Initilaize all timeouts
     * @param {Object} timeouts 
     */
    _initTimeouts(timeouts){
        const errorDefault = 5000;
        const nextLoopDefault = 5000;
        const loggerDefault = 5000;

        let timeoutError = errorDefault;
        let timeoutNextLoop = nextLoopDefault;
        let timeoutLogger = loggerDefault;

        if (timeouts !== undefined) {
            timeoutError = timeouts.ERROR || errorDefault;
            timeoutNextLoop = timeouts.NEXT_LOOP || nextLoopDefault;
            timeoutLogger = timeouts.LOGGER || loggerDefault;
        }

        this.timeouts = {
            ERROR: timeoutError,
            NEXT_LOOP: timeoutNextLoop,
            LOGGER: timeoutLogger,
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
     * Get public contract variables
     * Initialize array winners/slots
     * Start logger
     */
    async _init(){
        // Initialize class variables
        this.genesisBlock = 0;
        this.totalSynch = 0;
        this.blocksPerSlot = Number(await this.contractPoB.methods.BLOCKS_PER_SLOT()
            .call({from: this.ethAddress}));
        this.slotDeadline = Number(await this.contractPoB.methods.SLOT_DEADLINE()
            .call({from: this.ethAddress}));
        this.maxTx = Number(await this.contractPoB.methods.MAX_TX()
            .call({from: this.ethAddress}));
        this.minBid = Number(await this.contractPoB.methods.MIN_BID()
            .call({from: this.ethAddress}));
        this.blocksNextInfo = this.blocksPerSlot;
        
        if (this.creationHash) {
            this.genesisBlock = Number(await this.contractPoB.methods.genesisBlock()
                .call({from: this.ethAddress}));
            const creationTx = await this.web3.eth.getTransaction(this.creationHash);
            this.creationBlock = creationTx.blockNumber;
        }

        // Initialize currentWinners / currentBids / currentSlots with proper length
        this.winners = ["-1", "-1"];
        this.currentWinners = ["-1", "-1", "-1"];
        for (let i = 0; i < 10; i++) {
            if (i > 2) {
                const winnerRes = await this.contractPoB.methods.getWinner(i).call({from: this.ethAddress});
                const winner = winnerRes[winnerStruct.FORGER];
                this.currentWinners.push(winner);
            }
            this.bids.push("-1");
            if (i === 0) this.slots.push(-1);
            else this.slots.push(i-1);
        }

        const currentSlot = await this.getCurrentSlot();
        if(currentSlot > 0) {
            for(let i = currentSlot; i <= currentSlot + 9; i++) {
                this._shiftVars();
                await this._addBid(i);
            }
            // update slot
            await this.db.insert(lastSlotKey, this._toString(currentSlot + 1));
        }

        // Start logger
        this.logInterval = setInterval(() => {
            this.logger.info(this.info);
        }, this.timeouts.LOGGER );
    }

    /**
     * Main loop
     * Synchronize Rollup PoB contract
     * Maintain Rollup PoB database
     */
    async synchLoop() {
        await this._init();

        // eslint-disable-next-line no-constant-condition
        while(true) {
            try {
                let totalSynch = 0;
                let lastSynchSlot = await this.getLastSynchSlot();
                const currentBlock = await this.web3.eth.getBlockNumber();
                const currentSlot = await this.getCurrentSlot();
                const blockNextUpdate = this.genesisBlock + lastSynchSlot*this.blocksNextInfo;
                if (currentSlot === 0 && lastSynchSlot === 0){
                    totalSynch = 100;
                } else {
                    totalSynch = (((lastSynchSlot) / (currentSlot + 1)) * 100);
                }

                if (currentBlock >= blockNextUpdate){
                    const logs = await this.contractPoB.getPastEvents("allEvents", {
                        fromBlock: lastSynchSlot ? (blockNextUpdate - this.blocksNextInfo) : this.creationBlock,
                        toBlock: blockNextUpdate - 1,
                    });

                    // update total synch
                    lastSynchSlot += 1;
                    totalSynch = (((lastSynchSlot) / (currentSlot + 1)) * 100);

                    // update winners
                    await this._updateWinners(logs, currentSlot);

                    // update new bids
                    if (lastSynchSlot >= currentSlot) await this._updateBids(lastSynchSlot - 1);

                    // update slot
                    await this.db.insert(lastSlotKey, this._toString(lastSynchSlot));
                }

                // update global totalSynch variable
                this.totalSynch = totalSynch.toFixed(2);

                // fill logger information
                this._fillInfo(currentBlock, blockNextUpdate, currentSlot, lastSynchSlot);

                // wait for next iteration to update, only if it is fully synch
                if (totalSynch === 100) await timeout(this.timeouts.NEXT_LOOP);

            } catch (e) {
                this.logger.error(`POB SYNCH Message error: ${e.message}`);
                this.logger.debug(`POB SYNCH Message error: ${e.stack}`);
                await timeout(this.timeouts.ERROR);
            }
        }
    }

    /**
     * Update general synchronizer information
     * logger prints this information on logger main loop
     * @param {Number} currentBlock - current etehreum block 
     * @param {Number} blockNextUpdate - next ethereum block to do an update
     * @param {Number} currentSlot - current rollup PoB slot
     * @param {Number} lastSynchSlot - last rollup PoB slot synched
     */
    _fillInfo(currentBlock, blockNextUpdate, currentSlot, lastSynchSlot){
        this.info = `${chalk.magenta("POB SYNCH".padEnd(12))} | `;
        this.info += `current block number: ${currentBlock} | `;
        this.info += `next block update: ${blockNextUpdate} | `;
        this.info += `current slot: ${currentSlot} | `;
        this.info += `last synchronized slot: ${lastSynchSlot} | `;
        this.info += `Synched: ${chalk.white.bold(`${this.totalSynch} %`)}`;
    }

    /**
     * Update array of winners / bids for current auctions
     * @param {Object} logs - events RollupPoB contract
     * @param {Number} currentSlot - current rollup PoB slot
     */
    async _updateWinners(logs, currentSlot) {
        for (const event of logs) {
            const slot = event.returnValues.slot;
            if (slot <= this.slots[this.slots.length-1] && currentSlot < slot) {
                this.currentWinners[slot - currentSlot + 1] = event.returnValues.operator;
                this.bids[slot - currentSlot + 1] = event.returnValues.amount;
            }
        }
    }

    /**
     * Update array of winners / currentWinners / bids
     * Retrieve data from contract regarding winners
     */
    async _updateBids(slotUpdate) {
        this._shiftVars();
        await this._addBid(slotUpdate + 9);
    }

    _shiftVars() {
        this.currentWinners.shift();
        this.slots.shift();
        this.bids.shift();
        this.winners.shift();
        this.winners.push(this.currentWinners[1]);
    }

    async _addBid(slot){
        const winnerRes = await this.contractPoB.methods.getWinner(slot).call({from: this.ethAddress});
        const winner = winnerRes[winnerStruct.FORGER];
        const amount = winnerRes[winnerStruct.AMOUNT];
        this.currentWinners.push(winner);
        this.slots.push(slot);
        this.bids.push(amount);
    }

    /**
     * Get last slot synchronized from database
     * @returns {Number} last slot synchronized
     */
    async getLastSynchSlot() {
        return this._fromString(await this.db.getOrDefault(lastSlotKey, "0"));
    }

    /**
     * Get current slot from rollup PoB contract
     * @returns {Number} current slot
     */
    async getCurrentSlot(){
        const currentSlot = await this.contractPoB.methods.currentSlot()
            .call({from: this.ethAddress});
        return Number(currentSlot);
    }

    /**
     * Get array with winners
     * @returns {Array} - winners
     */
    getWinners(){
        return this.winners;
    }

    /**
     * Get array with winners
     * @returns {Array} - winners
     */
    async getOperatorsWinners(){
        const opWinner0data = await this.contractPoB.methods.getWinner(this.slots[0])
            .call({from: this.ethAddress});
        const opWinner0 = {
            slot: this.slots[0],
            forger: opWinner0data[winnerStruct.FORGER],
            beneficiary: opWinner0data[winnerStruct.BENEFICIARY],
            url: opWinner0data[winnerStruct.URL],
            amount: opWinner0data[winnerStruct.AMOUNT],
        };
        const opWinner1data = await this.contractPoB.methods.getWinner(this.slots[1])
            .call({from: this.ethAddress});
        const opWinner1 = {
            slot: this.slots[1],
            forger: opWinner1data[winnerStruct.FORGER],
            beneficiary: opWinner1data[winnerStruct.BENEFICIARY],
            url: opWinner1data[winnerStruct.URL],
            amount: opWinner1data[winnerStruct.AMOUNT],
        };
        const opWinners = [opWinner0, opWinner1];
        return opWinners;
    }

    /**
     * Get array with winners
     * @returns {Array} - current winners
     */
    getCurrentWinners(){
        return this.currentWinners;
    }

    /**
     * Get array with all slot numbers
     * @returns {Array} - slot numbers
     */
    getSlotWinners(){
        return this.slots;
    }

    /**
     * Get array with bids
     * @returns {Array} - bids
     */
    getCurrentBids(){
        return this.bids;
    }

    /**
     * Get ethereum block from slot number
     * @param {Number} numSlot - slot number
     * @returns {Number} - ethereum block 
     */
    getBlockBySlot(numSlot){
        return (this.genesisBlock + numSlot*this.blocksPerSlot);
    }

    /**
     * Get slot number from ethereum block
     * @param {Number} numBlock - ethereum block number
     * @returns {Number} - slot number
     */
    getSlotByBlock(numBlock){
        if (numBlock < this.genesisBlock) return 0;
        return Math.trunc((numBlock - this.genesisBlock) / (this.blocksPerSlot));
    }

    /**
     * Get current ethereum block
     * @returns {Number} - current block
     */
    async getCurrentBlock() {
        return await this.web3.eth.getBlockNumber();
    }

    /**
     * Get if synchronizer is fully synched
     * @returns {Bool} - true id PoB is fully synchronized, otherwise false
     */
    async isSynched() {
        if (this.totalSynch != Number(100).toFixed(2)) return false;
        const currentSlot = await this.getCurrentSlot();
        const lastSlotSaved = Number(await this.getLastSynchSlot());
        if (lastSlotSaved <= currentSlot) return false;
        return true;
    }

    /**
     * Get percentatge of synchronization
     * @returns {String} - 0.00% format
     */
    async getSynchPercentage() {
        return this.totalSynch;
    }

    /**
     * Get slot deadline parameter
     * @returns {Number} - slot deadline measured in ethereum blocks
     */
    async getSlotDeadline(){
        if (this.slotDeadline) return this.slotDeadline;
        else {
            return Number(await this.contractPoB.methods.SLOT_DEADLINE()
                .call({from: this.ethAddress}));
        }
    }

    /**
     * Get if the slot has been forged
     * @returns {Boolean}
     */
    async getFullFilledSlot(slot){
        return await this.contractPoB.methods.fullFilledSlot(slot)
            .call({from: this.ethAddress});
    }

    /**
     * Get default operator PoB
     * @returns {Number}
     */
    async getDefaultOperator(){
        return await this.contractPoB.methods.opDefault()
            .call({from: this.ethAddress});
    }

    /**
     * Get maximum rollup transactions
     * @returns {Number}
     */
    getMaxTx(){
        return this.maxTx;
    }

    /**
     * Get Min Bid
     * @returns {Number} - minimum bid (ether)
     */
    getMinBid(){
        return this.minBid;
    }

    /**
     * Get static data 
     * @returns {Object} - static data info  
     */
    async getStaticData() {
        return {
            contractAddress: this.rollupPoBAddress,
            blocksPerSlot: this.blocksPerSlot,
            slotDeadline: this.slotDeadline,
            genesisBlock: this.genesisBlock,
            minBid: this.minBid,
        };
    }
}

module.exports = SynchPoB;