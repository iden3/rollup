const Web3 = require("web3");
const { stringifyBigInts, unstringifyBigInts } = require("snarkjs");

// globsal vars
const lastBlockKey = "last-block-synch";
const stateRootKey = "last-state-root";
const lastBatchKey = "last-state-batch";
const TIMEOUT_ERROR = 3000;
const TIMEOUT_NEXT_LOOP = 3000;


function timeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

class Synchronizer {
    constructor(db, treeDb, nodeUrl, rollupAddress, rollupABI, creationHash, ethAddress) {
        this.db = db;
        this.nodeUrl = nodeUrl;
        this.rollupAddress = rollupAddress;
        this.creationHash = creationHash;
        this.treeDb = treeDb;
        this.ethAddress = ethAddress;
        this.web3 = new Web3(new Web3.providers.HttpProvider(this.nodeUrl));
        this.rollupContract = new this.web3.eth.Contract(rollupABI, this.rollupAddress);
    }

    _toString(val) {
        return JSON.stringify(stringifyBigInts(val));
    }

    _fromString(val) {
        return unstringifyBigInts(JSON.parse(val));
    }

    async synchLoop() {
        this.creationBlock = 0;
        if (this.creationHash) {
            const creationTx = await this.web3.eth.getTransaction(this.creationHash);
            this.creationBlock = creationTx.blockNumber;
        }
        
        // eslint-disable-next-line no-constant-condition
        while (true) {
            try {
                // get last block synched and current blockchain block
                let lastSynchBlock = await this.getLastSynchBlock();
                const currentBlock = await this.web3.eth.getBlockNumber();

                console.log(`last synchronized block: ${lastSynchBlock}`);
                console.log(`current block number: ${currentBlock}`);

                if (lastSynchBlock <= this.creationBlock) {
                    await this.db.insert(lastBlockKey, this._toString(lastSynchBlock));
                    lastSynchBlock = this.creationBlock;
                }
                
                const batchDepth = await this.rollupContract.methods.getStateDepth().call({from: this.ethAddress}, currentBlock);
                const lastBatchSaved = await this.getLastBatch();

                if (batchDepth != 0 &&  lastBatchSaved < batchDepth) {
                    // const stateRoot = await this.rollupContract.methods.getStateRoot(this.batchDepth).call({from: this.ethAddress}, lastSynchBlock);
                    // const lastRoot = await this.getStateRoot(batchDepth);

                    const targetBlockNumber = Math.min(currentBlock, lastSynchBlock + 10);
                    const logs = await this.rollupContract.getPastEvents("allEvents", {
                        fromBlock: lastSynchBlock + 1,
                        toBlock: targetBlockNumber,
                    });
                    console.log(logs);
                } else{
                    console.log("No batches has been forged");
                }
                await timeout(TIMEOUT_NEXT_LOOP);
            } catch (e) {
                console.error(`Message error: ${e.message}`);
                console.error(`Error in loop: ${e.stack}`);
                await timeout(TIMEOUT_ERROR);
            }
        }
    }

    async getLastSynchBlock() {
        return this._fromString(await this.db.getOrDefault(lastBlockKey, this.creationBlock.toString()));
    }

    async getBatchRoot(numBatch) {
        return this._fromString(await this.db.getOrDefault(`${stateRootKey}-${numBatch}`, ""));
    }

    async getLastBatch(){
        return this._fromString(await this.db.getOrDefault(lastBatchKey, "0"));
    }
}

module.exports = Synchronizer;
