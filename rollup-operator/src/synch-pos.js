const Web3 = require("web3");
const winston = require("winston");
const { timeout } = require("../src/utils");
const { stringifyBigInts, unstringifyBigInts, bigInt } = require("snarkjs");

// global vars
const TIMEOUT_ERROR = 2000;
const TIMEOUT_NEXT_LOOP = 5000;

// db keys
const lastEraKey = "last-era-synch";
const opCreateKey = "operator-create";
const opRemoveKey = "operator-remove";
// const opListKey = "operator-list";
const separator = "--";

class SynchPoS {
    constructor(
        db,
        nodeUrl,
        rollupPoSAddress,
        rollupPoSABI,
        creationHash,
        ethAddress,
        logLevel
    ) {
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
        this._initLogger(logLevel);
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

    async synchLoop() {
        this.genesisBlock = 0;
        this.totalSynch = 0;
        this.blocksPerSlot = Number(await this.contractPoS.methods.BLOCKS_PER_SLOT()
            .call({from: this.ethAddress}));
        this.slotsPerEra = Number(await this.contractPoS.methods.SLOTS_PER_ERA()
            .call({from: this.ethAddress}));
        this.blocksNextInfo = this.blocksPerSlot*this.slotsPerEra;
        
        if (this.creationHash) {
            this.genesisBlock = Number(await this.contractPoS.methods.genesisBlock()
                .call({from: this.ethAddress}));
            const creationTx = await this.web3.eth.getTransaction(this.creationHash);
            this.creationBlock = creationTx.blockNumber;
        }

        // eslint-disable-next-line no-constant-condition
        while(true) {
            try {
                let info = "POS SYNCH | ";
                // get last block synched and current blockchain block
                let lastSynchEra = await this.getLastSynchEra();
                const currentBlock = await this.web3.eth.getBlockNumber();
                const currentEra = await this.getCurrentEra();
                const blockNextUpdate = this.genesisBlock + lastSynchEra*this.blocksNextInfo;
                
                info += `current block number: ${currentBlock} | `;
                info += `next block update: ${blockNextUpdate} | `;
                info += `current era: ${currentEra} | `;

                if (currentBlock > blockNextUpdate){
                    const logs = await this.contractPoS.getPastEvents("allEvents", {
                        fromBlock: lastSynchEra ? (blockNextUpdate - this.blocksNextInfo) : this.creationBlock,
                        toBlock: blockNextUpdate - 1,
                    });
                    // Update operators
                    await this._updateOperators(logs, lastSynchEra);
                    // update raffle winners
                    await this._updateWinners(lastSynchEra);
                    // update era
                    await this.db.insert(lastEraKey, this._toString(lastSynchEra + 1));
                }

                lastSynchEra = await this.getLastSynchEra();
                this.totalSynch = ((lastSynchEra / (currentEra + 1)) * 100).toFixed(2);

                info += `last synchronized era: ${lastSynchEra} | `;
                info += `Synched: ${this.totalSynch} % | `;
                this.logger.info(info);

                await timeout(TIMEOUT_NEXT_LOOP);
            } catch (e) {
                this.logger.error(`POS SYNCH Message error: ${e.message}`);
                this.logger.debug(`POS SYNCH Message error: ${e.stack}`);
                await timeout(TIMEOUT_ERROR);
            }
        }
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
            await this.db.insert(`${opCreateKey}${separator}${era}${separator}${index}`,
                this._toString(event.returnValues));
        } else if(event.event == "removeOperatorLog") {
            await this.db.insert(`${opRemoveKey}${separator}${era+2}${separator}${index}`,
                this._toString(event.returnValues));
        }
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
            if(eraUpdate && (i < this.slotsPerEra)){
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
}

module.exports = SynchPoS;