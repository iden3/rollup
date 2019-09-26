const Web3 = require("web3");
const abiDecoder = require("abi-decoder");
const rollupUtils = require("../../rollup-utils/rollup-utils");
const SMT = require("circomlib").SMT;
const utils = require("../../js/utils");
const { timeout } = require("../src/utils");
const { stringifyBigInts, unstringifyBigInts, bigInt } = require("snarkjs");

// global vars
const lastBlockKey = "last-block-synch";
const stateRootKey = "last-state-root";
const lastBatchKey = "last-state-batch";
const eventOnChainKey = "onChain";
const eventForgeBatchKey = "forgeBatch";
const separator = "--";
const TIMEOUT_ERROR = 5000;
const TIMEOUT_NEXT_LOOP = 5000;
const maxTx = 10;
const nLevels = 24;
const bytesOffChainTx = 3*2 + 2;

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
        abiDecoder.addABI(rollupABI);
    }

    _toString(val) {
        return JSON.stringify(stringifyBigInts(val));
    }

    _fromString(val) {
        return unstringifyBigInts(JSON.parse(val));
    }

    async synchLoop() {
        this.creationBlock = 0;
        this.totalSynch = 0;
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
                console.log("******************************");
                console.log(`creation block: ${this.creationBlock}`);
                console.log(`last synchronized block: ${lastSynchBlock}`);
                console.log(`current block number: ${currentBlock}\n`);

                if (lastSynchBlock < this.creationBlock) {
                    await this.db.insert(lastBlockKey, this._toString(lastSynchBlock));
                    lastSynchBlock = this.creationBlock;
                }
                const currentBatchDepth = await this.rollupContract.methods.getStateDepth().call({from: this.ethAddress}, currentBlock);
                const lastBatchSaved = Number(await this.getLastBatch());
                this.totalSynch = (currentBatchDepth == 0) ? Number(0).toFixed(2) : ((lastBatchSaved / currentBatchDepth) * 100).toFixed(2);

                console.log(`current batch depth: ${currentBatchDepth}`);
                console.log(`last batch saved: ${lastBatchSaved}`);

                if ((currentBatchDepth != 0) && (lastBatchSaved < currentBatchDepth)) {
                    const targetBlockNumber = Math.min(currentBlock, lastSynchBlock + 10);
                    const logs = await this.rollupContract.getPastEvents("allEvents", {
                        fromBlock: lastSynchBlock + 1,
                        toBlock: targetBlockNumber,
                    });
                    let nextBatchSynched = currentBatchDepth;
                    if (currentBatchDepth != targetBlockNumber){
                        nextBatchSynched = await this.rollupContract.methods.getStateDepth().call({from: this.ethAddress}, targetBlockNumber);
                    }
                    await this._updateEvents(logs, lastBatchSaved, nextBatchSynched, targetBlockNumber);
                    console.log("Events synchronized correctly");
                } else {
                    console.log("No batches has been forged");
                    // update last block synched
                    await this.db.insert(lastBlockKey, this._toString(currentBlock));
                }
                console.log(`Total Synched: ${this.totalSynch} %`);
                console.log("******************************\n");
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
        return this._fromString(await this.db.getOrDefault(`${stateRootKey}${separator}${numBatch}`, "0"));
    }

    async getLastBatch(){
        return this._fromString(await this.db.getOrDefault(lastBatchKey, "0"));
    }

    async _updateEvents(logs, lastBatchSaved, currentBatchDepth, blockNumber){
        // save events on database
        logs.forEach((elem, index )=> {
            this._saveEvents(elem, index);
        });
        // Update rollupTree and last batch synched
        for (let i = lastBatchSaved + 1; i <= currentBatchDepth; i++) {
            const eventForge = [];
            const eventOnChain = [];
            // add off-chain tx
            const keysForge = await this.db.listKeys(`${eventForgeBatchKey}${separator}${i-1}`);
            for (const key of keysForge) eventForge.push(this._fromString(await this.db.get(key)));
            // add on-chain tx
            const keysOnChain = await this.db.listKeys(`${eventOnChainKey}${separator}${i-2}`);
            for (const key of keysOnChain) eventOnChain.push(this._fromString(this.db.get(key)));
            // Add events to rollup-tree
            await this._updateTree(eventForge, eventOnChain);
        }
        await this.db.insert(lastBlockKey, this._toString(blockNumber));
        await this.db.insert(lastBatchKey, this._toString(currentBatchDepth));
    }

    async _saveEvents(event, index) {
        if (event.event == "OnChainTx") {
            const batchNumber = event.returnValues.batchNumber;
            await this.db.insert(`${eventOnChainKey}${separator}${batchNumber}${separator}${index}`,
                this._toString(event.returnValues));
        } else if(event.event == "ForgeBatch") {
            const batchNumber = event.returnValues.batchNumber;
            await this.db.insert(`${eventForgeBatchKey}${separator}${batchNumber}${separator}${index}`,
                this._toString(event.returnValues));
        }
    }

    async _updateTree(offChain, onChain) {
        const block = await this.treeDb.buildBlock(maxTx, nLevels);
        for (const event of offChain) {
            const offChainTxs = await this._getTxOffChain(event);
            for (const tx of offChainTxs) block.addTx(tx);
        }
        for (const event of onChain) {
            block.addTx(await this._getTxOnChain(event));
        }
        await block.build();
        await this.treeDb.consolidate(block);
    }

    async _getTxOnChain(event) {
        const txData = rollupUtils.decodeTxData(event.txData);
        return {
            fromIdx: txData.fromId,
            toIdx: txData.toId,
            amount: txData.amount,
            loadAmount: bigInt(event.loadAmount),
            coin: txData.tokenId,
            ax: bigInt(event.Ax).toString(16),
            ay: bigInt(event.Ay).toString(16),
            ethAddress: bigInt(event.ethAddress).toString(),
            onChain: true
        };
    }

    async _getTxOffChain(event) {
        const transaction = await this.web3.eth.getTransactionFromBlock(event.blockNumber.toString(), 0);
        const decodedData = abiDecoder.decodeMethod(transaction.input);
        let compressedTxs;
        for (const elem of decodedData.params) {
            if (elem.name == "compressedTxs") compressedTxs = elem.value;
        }
        const txs = [];
        if (compressedTxs != null){
            const buffTxs = Buffer.from(compressedTxs.slice(2), "hex");
            const nTx = buffTxs.length / bytesOffChainTx;
            for (let i = 0; i < nTx; i++) {
                const tx = {
                    fromIdx: buffTxs.readUIntBE(8*i, 3),
                    toIdx: buffTxs.readUIntBE(8*i + 3, 3),
                    amount: buffTxs.readUIntBE(8*i + 6, 2),
                };
                txs.push(tx);
            }
        }
        return txs;
    }

    async getState() {
        return this.treeDb.db.nodes;
    }

    async getIdInfo(id) {
        const stateTree = new SMT(this.treeDb.db, this.treeDb.stateRoot);
        const resFind = await stateTree.find(id);
        if (resFind.found) {
            return utils.array2state(await this.treeDb.db.get(resFind.foundValue));
        }
        return resFind;
    }

    async getSynchPercentage() {
        return this.totalSynch;
    }
}

module.exports = Synchronizer;
