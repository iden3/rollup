/* global BigInt */

const Web3 = require("web3");
const RollupABI = require("../../../build/contracts/Rollup.json");

// globsal vars
const lastBlockKey = "last-block-synch";
const lastStateRoot = "last-state-root";
const TIMEOUT_ERROR = 3000;


function timeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

class Synchronizer {
    constructor(db, treeDb, nodeUrl, rollupAddress, creationHash, ethAddress) {
        this.db = db;
        this.nodeUrl = nodeUrl;
        this.rollupAddress = rollupAddress;
        this.creationHash = creationHash;
        this.treeDb = treeDb;
        this.ethAddress = ethAddress;
        this.web3 = new Web3(new Web3.providers.HttpProvider(this.nodeUrl));
        this.rollupContract = new this.web3.eth.Contract(RollupABI.abi, this.rollupAddress);
    }

    async synchLoop() {
        this.creationBlock = 0;
        if (this.creation_hash) {
            const creationTx = await this.web3.eth.getTransaction(this.creationHash);
            this.creationBlock = creationTx.blockNumber;
        }
        
        while (true) {
            try {
                const lastSynchBlock = await this.getLastSynchBlock();
                const currentBlock = await this.web3.eth.getBlockNumber();

                console.log(`last synchronized block: ${lastSynchBlock}`);
                console.log(`current block number: ${currentBlock}`);

                this.batchDepth = await this.contract.getStateDepth().call({from: this.ethAddress}, lastSynchBlock);

                const currentRoot = await this.contract.getStateRoot(this.batchDepth - 1).call({from: this.ethAddress});
                console.log(`current root: ${currentRoot}`);

                const lastRoot = await this.getLastRoot();
                console.log(`saved root: ${JSON.stringify(lastRoot)}`);
                
                
            } catch (e) {
                console.error(`Message error: ${e.message}`);
                console.error(`Error in loop: ${e.stack}`);
                await timeout(TIMEOUT_ERROR);
            }
        }
    }

    async getLastSynchBlock() {
        let lastBlock;
        try {
            lastBlock = this.db.get(lastBlockKey);
        } catch(error) {
            this.db.insert(lastBlockKey, this.creationBlock);
            lastBlock = 0;
        }
        return lastBlock;
    }

    async getLastRoot() {
        return this.db.get(lastStateRoot);
    }
}

module.exports = Synchronizer;
