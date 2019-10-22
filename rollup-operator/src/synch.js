const Web3 = require("web3");
const abiDecoder = require("abi-decoder");
const winston = require("winston");

const rollupUtils = require("../../rollup-utils/rollup-utils");
const { timeout } = require("../src/utils");
const { stringifyBigInts, unstringifyBigInts, bigInt } = require("snarkjs");

// config winston
var options = {
    console: {
        level: "verbose",
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple(),
        )
    },
};

const logger = winston.createLogger({
    transports: [
        new winston.transports.Console(options.console)
    ]
});

// global vars
const TIMEOUT_ERROR = 2000;
const TIMEOUT_NEXT_LOOP = 5000;
const maxTx = 10;
const nLevels = 24;
const bytesOffChainTx = 3*2 + 2;
const blocksPerSlot = 100;

// db keys
const lastBlockKey = "last-block-synch";
const lastBatchKey = "last-state-batch";
const eventOnChainKey = "onChain";
const eventForgeBatchKey = "forgeBatch";
const separator = "--";

class Synchronizer {
    constructor(
        db,
        treeDb,
        nodeUrl,
        rollupAddress,
        rollupABI,
        rollupPoSAddress,
        rollupPoSABI,
        creationHash,
        ethAddress
    ) {
        this.db = db;
        this.nodeUrl = nodeUrl;
        this.rollupAddress = rollupAddress;
        this.rollupPoSAddress = rollupPoSAddress;
        this.creationHash = creationHash;
        this.treeDb = treeDb;
        this.ethAddress = ethAddress;
        this.web3 = new Web3(new Web3.providers.HttpProvider(this.nodeUrl));
        this.rollupContract = new this.web3.eth.Contract(rollupABI, this.rollupAddress);
        abiDecoder.addABI(rollupABI);
        this.rollupPoSContract = new this.web3.eth.Contract(rollupPoSABI, this.rollupPoSAddress);
        abiDecoder.addABI(rollupPoSABI);
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
                let info = "SYNCH | ";
                // get last block synched and current blockchain block
                let lastSynchBlock = await this.getLastSynchBlock();
                const currentBlock = await this.web3.eth.getBlockNumber();

                if (lastSynchBlock < this.creationBlock) {
                    await this.db.insert(lastBlockKey, this._toString(lastSynchBlock));
                    lastSynchBlock = this.creationBlock;
                }
                const currentBatchDepth = await this.rollupContract.methods.getStateDepth().call({from: this.ethAddress}, currentBlock);
                let lastBatchSaved = await this.getLastBatch();

                info += `current block number: ${currentBlock} | `;
                info += `last block synched: ${lastSynchBlock} | `;
                info += `current batch depth: ${currentBatchDepth} | `;

                if (currentBatchDepth - 1 > lastBatchSaved) {
                    // Get target block number from forgeBatch event
                    //TODO: Could be improved inserting a cache memory
                    let targetBlockNumber = "latest";
                    const logsForge = await this.rollupContract.getPastEvents("ForgeBatch", {
                        fromBlock: lastSynchBlock + 1,
                        toBlock: targetBlockNumber,
                    });
                    
                    for (const log of logsForge) {
                        if (log.returnValues.batchNumber == lastBatchSaved + 1){
                            targetBlockNumber = Number(log.returnValues.blockNumber);
                            break;
                        }
                    }

                    // get all logs from last batch
                    const logs = await this.rollupContract.getPastEvents("allEvents", {
                        fromBlock: lastSynchBlock + 1,
                        toBlock: targetBlockNumber,
                    });
                    await this._updateEvents(logs, lastBatchSaved + 1, targetBlockNumber);
                }

                lastBatchSaved = await this.getLastBatch();

                this.totalSynch = (currentBatchDepth == 0) ? Number(100).toFixed(2) : (((lastBatchSaved + 1) / currentBatchDepth) * 100).toFixed(2);
                
                info += `last batch saved: ${lastBatchSaved} | `;
                info += `Synched: ${this.totalSynch} % | `;
                logger.info(info);

                await timeout(TIMEOUT_NEXT_LOOP);
            } catch (e) {
                logger.error(`Message error: ${e.message}`);
                await timeout(TIMEOUT_ERROR);
            }
        }
    }

    async getLastSynchBlock() {
        return this._fromString(await this.db.getOrDefault(lastBlockKey, this.creationBlock.toString()));
    }

    async getLastBatch(){
        return Number(this._fromString(await this.db.getOrDefault(lastBatchKey, "-1")));
    }

    async _updateEvents(logs, nextBatchSynched, blockNumber){
        // save events on database
        logs.forEach((elem, index )=> {
            this._saveEvents(elem, index);
        });
        // Update rollupTree and last batch synched
        const batchKey = nextBatchSynched + 1;
        const eventForge = [];
        const eventOnChain = [];
        // add off-chain tx
        const keysForge = await this.db.listKeys(`${eventForgeBatchKey}${separator}${batchKey-1}`);
        for (const key of keysForge) eventForge.push(this._fromString(await this.db.get(key)));
        // add on-chain tx
        const keysOnChain = await this.db.listKeys(`${eventOnChainKey}${separator}${batchKey-2}`);
        for (const key of keysOnChain) eventOnChain.push(this._fromString(await this.db.get(key)));
        // Add events to rollup-tree
        if ((eventForge.length > 0) || (eventOnChain.length > 0)) 
            await this._updateTree(eventForge, eventOnChain);
        
        await this.db.insert(lastBlockKey, this._toString(blockNumber));
        await this.db.insert(lastBatchKey, this._toString(nextBatchSynched));
    }

    async _saveEvents(event, index) {
        if (event.event == "OnChainTx") {
            const batchNumber = event.returnValues.batchNumber;
            await this.db.insert(`${eventOnChainKey}${separator}${batchNumber}${separator}${index}`,
                this._toString(event.returnValues));
        } else if(event.event == "ForgeBatch") {
            const batchNumber = event.returnValues.batchNumber;
            await this.db.insert(`${eventForgeBatchKey}${separator}${batchNumber}${separator}${index}`,
                this._toString(event.transactionHash));
        }
    }

    async _updateTree(offChain, onChain) {
        const block = await this.treeDb.buildBatch(maxTx, nLevels);
        for (const event of offChain) {
            const offChainTxs = await this._getTxOffChain(event);
            await this._addFeePlan(block, offChainTxs.inputFeePlanCoin, offChainTxs.inputFeePlanFee);
            await this._setUserFee(block, offChainTxs.txs);
            for (const tx of offChainTxs.txs) {
                block.addTx(tx);
            }
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
            ethAddress: event.ethAddress,
            onChain: true
        };
    }

    async _getTxOffChain(event) {
        const txForge = await this.web3.eth.getTransaction(event);
        const decodedData = abiDecoder.decodeMethod(txForge.input);
        let inputRetrieved;
        decodedData.params.forEach(elem => {
            if (elem.name == "input") {
                inputRetrieved = elem.value;
            }
        });
        const inputOffChainHash = inputRetrieved[4];
        const inputFeePlanCoin = inputRetrieved[5];
        const inputFeePlanFee = inputRetrieved[6];

        const fromBlock = txForge.blockNumber - blocksPerSlot;
        const toBlock = txForge.blockNumber;
        const logs = await this.rollupPoSContract.getPastEvents("dataCommitted", {
            fromBlock: fromBlock, // previous slot
            toBlock: toBlock, // current slot
        });
        let txHash;
        for (const log of logs) {
            if ( log.returnValues.hashOffChain == inputOffChainHash){
                txHash = log.transactionHash;
                break;
            }
        }
        const txDataCommitted = await this.web3.eth.getTransaction(txHash);
        const decodedData2 = abiDecoder.decodeMethod(txDataCommitted.input);
        let compressedTx;
        decodedData2.params.forEach(elem => {
            if (elem.name == "compressedTx") {
                compressedTx = elem.value;
            }
        });

        const headerBytes = Math.ceil(maxTx/8);
        const txs = [];
        const buffCompressedTxs = Buffer.from(compressedTx.slice(2), "hex");
        const headerBuff = buffCompressedTxs.slice(0, headerBytes);
        const txsBuff = buffCompressedTxs.slice(headerBytes, buffCompressedTxs.length);
        const nTx = txsBuff.length / bytesOffChainTx;
        for (let i = 0; i < nTx; i++) {
            const step = ( headerBuff[Math.floor(i/8)] & 0x80 >> (i%8)) ? 1 : 0;
            const tx = {
                fromIdx: txsBuff.readUIntBE(8*i, 3),
                toIdx: txsBuff.readUIntBE(8*i + 3, 3),
                amount: txsBuff.readUIntBE(8*i + 6, 2),
                step,
            };
            txs.push(tx);
        }
        return {txs, inputFeePlanCoin, inputFeePlanFee};
    }

    async _addFeePlan(bb, feePlanCoins, feePlanFee) {
        const tmpCoins = bigInt(feePlanCoins);
        const tmpFee = bigInt(feePlanFee);
        for (let i = 0; i < 16; i++){
            const coin = tmpCoins.shr(16*i).and(bigInt(1).shl(16).sub(bigInt(1)));
            const fee = tmpFee.shr(16*i).and(bigInt(1).shl(16).sub(bigInt(1)));
            await bb.addCoin(coin, fee);
        }
    }

    async _setUserFee(bb, txs){
        for (const tx of txs) {
            const stateId = await this.getStateById(tx.fromIdx);
            const userFee = await bb.getOperatorFee(stateId.coin, tx.step);
            tx.userFee = Number(userFee);
        }
    }

    async getState() {
        return this.treeDb.db.nodes;
    }

    async getStateById(id) {
        return this.treeDb.getStateByIdx(id);
    }

    // ax, ay encoded as hexadecimal string (whitout '0x')
    async getStateByAxAy(ax, ay) {
        return this.treeDb.getStateByAxAy(ax, ay);
    }

    async getStateByEthAddr(ethAddress) {
        return this.treeDb.getStateByEthAddr(ethAddress);
    }

    async getSynchPercentage() {
        return this.totalSynch;
    }

    async getBatchBuilder() {
        const bb = await this.treeDb.buildBatch(maxTx, nLevels);
        const currentBlock = await this.web3.eth.getBlockNumber();
        const currentBatchDepth = await this.rollupContract.methods.getStateDepth().call({from: this.ethAddress}, currentBlock);
        // add on-chain txs
        const keysOnChain = await this.db.listKeys(`${eventOnChainKey}${separator}${currentBatchDepth-1}`);
        for (const key of keysOnChain) {
            bb.addTx(await this._getTxOnChain(this._fromString(await this.db.get(key))));
        }
        return bb;
    }

    async getOffChainTxByBatch(numBatch) {
        const res = [];
        // add off-chain tx
        const bb = await this.treeDb.buildBatch(maxTx, nLevels); 
        const keysForge = await this.db.listKeys(`${eventForgeBatchKey}${separator}${numBatch}`);
        for (const key of keysForge) {
            const tmp = this._fromString(await this.db.get(key));
            const offChainTxs = await this._getTxOffChain(tmp);
            await this._addFeePlan(bb, offChainTxs.inputFeePlanCoin, offChainTxs.inputFeePlanFee);
            await this._setUserFee(bb, offChainTxs.txs);
            for (const tx of offChainTxs.txs) res.push(tx);
        }
        return res;
    }

    async isSynched() {
        if (this.totalSynch != Number(100).toFixed(2)) return false;
        const currentBlock = await this.web3.eth.getBlockNumber();
        const currentBatch = await this.rollupContract.methods.getStateDepth().call({from: this.ethAddress}, currentBlock);
        const lastBatchSaved = await this.getLastBatch();
        if ((lastBatchSaved + 1) < currentBatch) return false;
        return true;
    }
}

module.exports = Synchronizer;
