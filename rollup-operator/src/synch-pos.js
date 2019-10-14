const Web3 = require("web3");
const { timeout } = require("../src/utils");
const { stringifyBigInts, unstringifyBigInts, bigInt } = require("snarkjs");

// global vars
const blocksPerSlot = 100;
const slotsPerEra = 20;
const blocksNextInfo = blocksPerSlot*slotsPerEra; 
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
        ethAddress
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
        if (this.creationHash) {
            this.genesisBlock = Number(await this.contractPoS.methods.genesisBlock()
                .call({from: this.ethAddress}));
            const creationTx = await this.web3.eth.getTransaction(this.creationHash);
            this.creationBlock = creationTx.blockNumber;
        }

        // eslint-disable-next-line no-constant-condition
        while(true) {
            try {
                // get last block synched and current blockchain block
                let lastSynchEra = await this.getLastSynchEra();
                const currentBlock = await this.web3.eth.getBlockNumber();
                const currentEra = await this.getCurrentEra();
                console.log("******************************");
                console.log(`genesis block: ${this.genesisBlock}`);
                console.log(`last synchronized era: ${lastSynchEra}`);
                console.log(`current era: ${currentEra}`);
                console.log(`current block number: ${currentBlock}`);

                const blockNextUpdate = this.genesisBlock + lastSynchEra*blocksNextInfo;
                if (currentBlock > blockNextUpdate){
                    const logs = await this.contractPoS.getPastEvents("allEvents", {
                        fromBlock: lastSynchEra ? (blockNextUpdate - blocksNextInfo) : this.creationBlock,
                        toBlock: blockNextUpdate - 1,
                    });
                    // Update operators
                    await this._updateOperators(logs, lastSynchEra);
                    // update raffle winners
                    await this._updateWinners(lastSynchEra);
                    // update era
                    await this.db.insert(lastEraKey, this._toString(lastSynchEra + 1));
                    console.log(`Synchronized era ${lastSynchEra+1} correctly`);
                }
                lastSynchEra = await this.getLastSynchEra();
                this.totalSynch = ((lastSynchEra / (currentEra + 1)) * 100).toFixed(2);
                console.log(`Total Synched: ${this.totalSynch} %`);
                console.log("******************************\n");
                await timeout(TIMEOUT_NEXT_LOOP);
            } catch (e) {
                // console.error(`Message error: ${e.message}`);
                // console.error(`Error in loop: ${e.stack}`);
                await timeout(TIMEOUT_ERROR);
            }
        }
    }

    async _updateOperators(logs, era) {
        // save operators on database
        logs.forEach((elem, index )=> {
            this._saveOperators(elem, index, era);
        });
        // update list operators
        this._updateListOperators(era);
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
        for (let i = 0; i < 2*slotsPerEra; i++){
            const slot = slotsPerEra*eraUpdate + i;
            if(eraUpdate && (i < slotsPerEra)){
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
        return (this.genesisBlock + numSlot*blocksPerSlot);
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
}

module.exports = SynchPoS;