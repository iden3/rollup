const Web3 = require("web3");
const winston = require("winston");
const chalk = require("chalk");
const { stringifyBigInts, unstringifyBigInts } = require("ffjavascript").utils;
const Scalar = require("ffjavascript").Scalar;

const { timeout } = require("../../src/utils");

// db keys
const lastEraKey = "last-era-synch";
const opCreateKey = "operator-create";
const opRemoveKey = "operator-remove";
const separator = "--";

/**
* Synchronize Rollup proof-of-stake (PoS) smart contract 
*/
class SynchPoS {
    /**
     * Initialize Synchronizer parameters
     * @param {Object} db - Synchronizer PoS database
     * @param {String} nodeUrl - Ethereum node url
     * @param {String} rollupPoSAddress - Rollup PoS address
     * @param {Object} rollupPoSABI - Rollup PoS ABI interface
     * @param {String} rollupPoSCreationHash - Rollup PoS creation hash 
     * @param {String} ethAddress - Address to make pure/view calls
     * @param {String} logLevel - Logger level
     * @param {Object} timeouts - Configure timeouts
     */
    constructor(
        db,
        nodeUrl,
        rollupPoSAddress,
        rollupPoSABI,
        rollupPoSCreationHash,
        ethAddress,
        logLevel,
        timeouts
    ) {
        this.info = "";
        this.db = db;
        this.nodeUrl = nodeUrl;
        this.rollupPoSAddress = rollupPoSAddress;
        this.creationHash = rollupPoSCreationHash;
        this.ethAddress = ethAddress;
        this.web3 = new Web3(new Web3.providers.HttpProvider(this.nodeUrl));
        this.contractPoS = new this.web3.eth.Contract(rollupPoSABI, this.rollupPoSAddress, {handleRevert: true});
        this.winners = [];
        this.slots = [];
        this.operators = {};

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
        this.genesisBlock = Number(await this.contractPoS.methods.genesisBlock()
            .call({from: this.ethAddress}));
        this.blocksPerSlot = Number(await this.contractPoS.methods.BLOCKS_PER_SLOT()
            .call({from: this.ethAddress}));
        this.slotsPerEra = Number(await this.contractPoS.methods.SLOTS_PER_ERA()
            .call({from: this.ethAddress}));
        this.slotDeadline = Number(await this.contractPoS.methods.SLOT_DEADLINE()
            .call({from: this.ethAddress}));
        this.minStake = Scalar.e(await this.contractPoS.methods.MIN_STAKE()
            .call({from: this.ethAddress}));
        this.blocksNextInfo = this.blocksPerSlot*this.slotsPerEra;
        
        if (this.creationHash) {
            const creationTx = await this.web3.eth.getTransaction(this.creationHash);
            this.creationBlock = creationTx.blockNumber;
        }

        // Initialize winners / slots with proper length
        for (let i = 0; i < 2*this.slotsPerEra; i++) {
            this.winners.push(-1);
            if (i < this.slotsPerEra) this.slots.push(-1);
            else this.slots.push(i - this.slotsPerEra);
        }

        // Update from persistent database 
        const lastSynchEra = await this.getLastSynchEra();
        if (lastSynchEra){
            // update operators list from database
            for (let i = 0; i < lastSynchEra; i++)
                await this._updateListOperators(i);
            // update last two eras for winners and slots
            if (lastSynchEra > 1)
                await this._updateWinners(lastSynchEra - 2);
            await this._updateWinners(lastSynchEra - 1);
        }

        // Init info message
        this.info = `${chalk.magenta("POS SYNCH".padEnd(12))} | `;
        this.info += "Initializing data";

        // Start logger
        this.logInterval = setInterval(() => {
            this.logger.info(this.info);
        }, this.timeouts.LOGGER );
    }

    /**
     * Main loop
     * Synchronize Rollup PoS contract
     * Maintain Rollup PoS database
     */
    async synchLoop() {
        await this._init();

        // eslint-disable-next-line no-constant-condition
        while(true) {
            try {
                let totalSynch = 0;
                let lastSynchEra = await this.getLastSynchEra();
                const currentBlock = await this.web3.eth.getBlockNumber();
                const currentEra = await this.getCurrentEra();
                const blockNextUpdate = this.genesisBlock + lastSynchEra*this.blocksNextInfo;
                

                if (currentEra === 0 && lastSynchEra === 0){
                    totalSynch = 100; // never updated since first era block has not been achieved
                } else {
                    totalSynch = (((lastSynchEra) / (currentEra + 1)) * 100);
                }

                if (currentBlock >= blockNextUpdate){
                    const logs = await this.contractPoS.getPastEvents("allEvents", {
                        fromBlock: lastSynchEra ? (blockNextUpdate - this.blocksNextInfo) : this.creationBlock,
                        toBlock: blockNextUpdate - 1,
                    });

                    // update total synch
                    lastSynchEra += 1;
                    totalSynch = (((lastSynchEra) / (currentEra + 1)) * 100);

                    // update operators
                    await this._updateOperators(logs, lastSynchEra - 1);

                    // skip update winners allows fast synching
                    if (lastSynchEra >= currentEra) await this._updateWinners(lastSynchEra - 1);

                    // update era
                    await this.db.insert(lastEraKey, this._toString(lastSynchEra));
                }

                // update global totalSynch variable
                this.totalSynch = totalSynch.toFixed(2);

                // fill logger information
                this._fillInfo(currentBlock, blockNextUpdate, currentEra, lastSynchEra);

                // wait for next iteration to update, only if it is fully synch
                if (totalSynch === 100) await timeout(this.timeouts.NEXT_LOOP);

            } catch (e) {
                this.logger.error(`POS SYNCH Message error: ${e.message}`);
                this.logger.debug(`POS SYNCH Message error: ${e.stack}`);
                await timeout(this.timeouts.ERROR);
            }
        }
    }

    /**
     * Update general synchronizer information
     * logger prints this information on logger main loop
     * @param {Number} currentBlock - current etehreum block 
     * @param {Number} blockNextUpdate - next ethereum block to do an update
     * @param {Number} currentEra - current rollup PoS era
     * @param {Number} lastSynchEra - last rollup PoS era synched
     */
    _fillInfo(currentBlock, blockNextUpdate, currentEra, lastSynchEra){
        this.info = `${chalk.magenta("POS SYNCH".padEnd(12))} | `;
        this.info += `current block number: ${currentBlock} | `;
        this.info += `next block update: ${blockNextUpdate} | `;
        this.info += `current era: ${currentEra} | `;
        this.info += `last synchronized era: ${lastSynchEra} | `;
        this.info += `Synched: ${chalk.white.bold(`${this.totalSynch} %`)}`;
    }

    /**
     * Maintain operators list
     * @param {Array} logs - ethereum events
     * @param {Number} era - era updated 
     */
    async _updateOperators(logs, era) {
        // save operators on database
        let index = 0;
        for (const event of logs) {
            await this._saveOperators(event, index, era);
            index += 1;
        }
        // update list operators
        await this._updateListOperators(era);
    }

    /**
     * Save/Remove events on database
     * @param {Object} event - ethereum event 
     * @param {Number} index - index to store on database
     * @param {Number} era - era on which the events has been triggered 
     */
    async _saveOperators(event, index, era) {
        if (event.event == "createOperatorLog") {
            const operatorData = this._getRegOperatorsData(event.returnValues);
            await this.db.insert(`${opCreateKey}${separator}${era}${separator}${index}`,
                this._toString(operatorData));
        } else if(event.event == "removeOperatorLog") {
            const operatorData = this._getUnregOperatorsData(event.returnValues);
            await this.db.insert(`${opRemoveKey}${separator}${era+2}${separator}${index}`,
                this._toString(operatorData));
        }
    }

    /**
     * Retrieve useful register operator data from event data
     * @param {Object} operatorData - ethereum event data  
     * @returns {Object} - useful register operator data 
     */
    _getRegOperatorsData(operatorData){
        return {
            controllerAddress: operatorData.controllerAddress,
            beneficiaryAddress: operatorData.beneficiaryAddress,
            operatorId: operatorData.operatorId,
            url: operatorData.url,
        };
    }

    /**
     * Retrieve useful unregister operator data from event data
     * @param {Object} operatorData - ethereum event data  
     * @returns {Object} - useful unregister operator data 
     */
    _getUnregOperatorsData(operatorData){
        return {
            controllerAddress: operatorData.controllerAddress,
            operatorId: operatorData.operatorId
        };
    }

    /**
     * Update active operators list
     * @param {Number} era - era to update 
     */
    async _updateListOperators(era) {
        // Add operators
        const keysAddOp = await this.db.listKeys(`${opCreateKey}${separator}${era}`);
        for (const opKey of keysAddOp) {
            const opValue = this._fromString(await this.db.get(opKey));
            this.operators[opValue.operatorId.toString()] = opValue;
        }
        // Remove operators
        const keysRemoveOp = await this.db.listKeys(`${opRemoveKey}${separator}${era}`);
        for (const opKey of keysRemoveOp) {
            const opValue = this._fromString(await this.db.get(opKey));
            delete this.operators[opValue.operatorId.toString()];
        }
    }

    /**
     * Update array of winners
     * Retrieve data from contract regarding winners
     * @param {Number} eraUpdate - era to update 
     */
    async _updateWinners(eraUpdate) {
        // update next era winners
        for (let i = 0; i < 2*this.slotsPerEra; i++){
            const slot = this.slotsPerEra*eraUpdate + i;
            
            if (i < this.slotsPerEra){
                this.winners.shift(); // remove first era winners
                this.slots.shift();
            } else {
                let winner;
                try {
                    winner = await this.contractPoS.methods.getRaffleWinner(slot)
                        .call({from: this.ethAddress});
                } catch (error) {
                    if ((error.message).includes("Must be stakers")) winner = -1;
                }
                this.winners.push(Number(winner));
                this.slots.push(slot);
            }
        }
    }

    /**
     * Get last era synchronized from database
     * @returns {Number} last era synchronized
     */
    async getLastSynchEra() {
        return this._fromString(await this.db.getOrDefault(lastEraKey, "0"));
    }

    /**
     * Get current slot from rollup PoS contract
     * @returns {Number} current slot
     */
    async getCurrentSlot(){
        const currentSlot = await this.contractPoS.methods.currentSlot()
            .call({from: this.ethAddress});
        return Number(currentSlot);
    }

    /**
     * Get current era from rollup PoS contract
     * @returns {Number} current era
     */
    async getCurrentEra(){
        const currentEra = await this.contractPoS.methods.currentEra()
            .call({from: this.ethAddress});
        return Number(currentEra);
    }

    /**
     * Get operators list
     * @returns {Object} List of operators
     */
    async getOperators(){
        return this.operators;
    }

    /**
     * Get single operators by its identifier
     * @returns {Object} operator data
     */
    async getOperatorById(opId){
        return this.operators[(Scalar.e(opId).toString())];
    }

    /**
     * Get array with all raffle winners
     * @returns {Array} - raffle winners
     */
    async getRaffleWinners(){
        return this.winners;
    }

    /**
     * Get array with all slot numbers
     * @returns {Array} - slot numbers
     */
    async getSlotWinners(){
        return this.slots;
    }

    /**
     * Get ethereum block from slot number
     * @param {Number} numSlot - slot number
     * @returns {Number} - ethereum block 
     */
    async getBlockBySlot(numSlot){
        return (this.genesisBlock + numSlot*this.blocksPerSlot);
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
     * @returns {Bool} - true id PoS is fully synchronized, otherwise false
     */
    async isSynched() {
        if (this.totalSynch != Number(100).toFixed(2)) return false;
        const currentEra = await this.getCurrentEra();
        const lastEraSaved = Number(await this.getLastSynchEra());
        if (lastEraSaved <= currentEra) return false;
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
     * Get last commited hash by an operator
     * @param {String} opId - operator identifier
     */
    async getLastCommitedHash(opId) {
        const opInfo = await this.contractPoS.methods.operators(opId)
            .call({from: this.ethAddress});
        return opInfo.rndHash;
    }

    /**
     * Get slot deadline parameter
     * @returns {Number} - slot deadline measured in ethereum blocks
     */
    async getSlotDeadline(){
        if (this.slotDeadline) return this.slotDeadline;
        else {
            return Number(await this.contractPoS.methods.SLOT_DEADLINE()
                .call({from: this.ethAddress}));
        }
    }

    /**
     * Get static data 
     * @returns {Object} - static data info  
     */
    async getStaticData() {
        return {
            contractAddress: this.rollupPoSAddress,
            blocksPerSlot: this.blocksPerSlot,
            slotsPerEra: this.slotsPerEra,
            slotDeadline: this.slotDeadline,
            genesisBlock: this.genesisBlock,
            minStake: this.minStake,
        };
    }
}

module.exports = SynchPoS;