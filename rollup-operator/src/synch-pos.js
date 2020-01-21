const Web3 = require("web3");
const winston = require("winston");
const chalk = require("chalk");
const { timeout } = require("../src/utils");
const { stringifyBigInts, unstringifyBigInts, bigInt } = require("snarkjs");

// db keys
const lastEraKey = "last-era-synch";
const opCreateKey = "operator-create";
const opRemoveKey = "operator-remove";
const separator = "--";

class SynchPoS {
    constructor(
        db,
        nodeUrl,
        rollupPoSAddress,
        rollupPoSABI,
        creationHash,
        ethAddress,
        logLevel,
        timeouts
    ) {
        this.info = "";
        this.db = db;
        this.nodeUrl = nodeUrl;
        this.rollupPoSAddress = rollupPoSAddress;
        this.creationHash = creationHash;
        this.ethAddress = ethAddress;
        this.web3 = new Web3(new Web3.providers.HttpProvider(this.nodeUrl));
        this.contractPoS = new this.web3.eth.Contract(rollupPoSABI, this.rollupPoSAddress);
        this.winners = [];
        this.slots = [];
        this.operators = {};

        this._initTimeouts(timeouts);
        this._initLogger(logLevel);
    }

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
        // Initialize class variables
        this.genesisBlock = 0;
        this.totalSynch = 0;
        this.blocksPerSlot = Number(await this.contractPoS.methods.BLOCKS_PER_SLOT()
            .call({from: this.ethAddress}));
        this.slotsPerEra = Number(await this.contractPoS.methods.SLOTS_PER_ERA()
            .call({from: this.ethAddress}));
        this.slotDeadline = Number(await this.contractPoS.methods.SLOT_DEADLINE()
            .call({from: this.ethAddress}));
        this.blocksNextInfo = this.blocksPerSlot*this.slotsPerEra;
        
        if (this.creationHash) {
            this.genesisBlock = Number(await this.contractPoS.methods.genesisBlock()
                .call({from: this.ethAddress}));
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

        // Start logger
        this.logInterval = setInterval(() => {
            this.logger.info(this.info);
        }, this.timeouts.LOGGER );
    }

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

                if (currentBlock > blockNextUpdate){
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

    _fillInfo(currentBlock, blockNextUpdate, currentEra, lastSynchEra){
        this.info = `${chalk.magenta("POS SYNCH")} | `;
        this.info += `current block number: ${currentBlock} | `;
        this.info += `next block update: ${blockNextUpdate} | `;
        this.info += `current era: ${currentEra} | `;
        this.info += `last synchronized era: ${lastSynchEra} | `;
        this.info += `Synched: ${chalk.white.bold(`${this.totalSynch} %`)}`;
    }

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

    _getRegOperatorsData(operatorData){
        return {
            controllerAddress: operatorData.controllerAddress,
            operatorId: operatorData.operatorId,
            url: operatorData.url,
        };
    }

    _getUnregOperatorsData(operatorData){
        return {
            controllerAddress: operatorData.controllerAddress,
            operatorId: operatorData.operatorId
        };
    }

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
        // console.log(this.winners);
        // console.log(this.slots);
    }

    async getLastSynchEra() {
        return this._fromString(await this.db.getOrDefault(lastEraKey, "0"));
    }

    async getCurrentSlot(){
        const currentSlot = await this.contractPoS.methods.currentSlot()
            .call({from: this.ethAddress});
        return Number(currentSlot);
    }

    async getCurrentEra(){
        const currentEra = await this.contractPoS.methods.currentEra()
            .call({from: this.ethAddress});
        return Number(currentEra);
    }

    async getOperators(){
        return this.operators;
    }

    async getOperatorById(opId){
        return this.operators[(bigInt(opId).toString())];
    }

    async getRaffleWinners(){
        return this.winners;
    }

    async getSlotWinners(){
        return this.slots;
    }

    async getBlockBySlot(numSlot){
        return (this.genesisBlock + numSlot*this.blocksPerSlot);
    }

    async getCurrentBlock() {
        return await this.web3.eth.getBlockNumber();
    }

    async isSynched() {
        if (this.totalSynch != Number(100).toFixed(2)) return false;
        const currentEra = await this.getCurrentEra();
        const lastEraSaved = Number(await this.getLastSynchEra());
        if (lastEraSaved <= currentEra) return false;
        return true;
    }

    async getSynchPercentage() {
        return this.totalSynch;
    }

    async getLastCommitedHash(opId) {
        const opInfo = await this.contractPoS.methods.operators(opId)
            .call({from: this.ethAddress});
        return opInfo.rndHash;
    }

    async getSlotDeadline(){
        if (this.slotDeadline) return this.slotDeadline;
        else {
            return Number(await this.contractPoS.methods.SLOT_DEADLINE()
                .call({from: this.ethAddress}));
        }
    }
}

module.exports = SynchPoS;