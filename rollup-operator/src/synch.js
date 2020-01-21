const Web3 = require("web3");
const abiDecoder = require("abi-decoder");
const winston = require("winston");
const chalk = require("chalk");
const { stringifyBigInts, unstringifyBigInts, bigInt } = require("snarkjs");

const rollupUtils = require("../../rollup-utils/rollup-utils");
const { timeout } = require("../src/utils");
const Constants = require("./constants");

// offChainTx --> From | To | Amount |
//            -->   3  | 3  |    2   | bytes 
const bytesOffChainTx = 3*2 + 2;

// db keys
const lastBlockKey = "last-block-synch";
const lastBatchKey = "last-state-batch";
const exitInfoKey = "exit";
const eventOnChainKey = "onChain";
const eventForgeBatchKey = "forgeBatch";
const separator = "--";
const lastPurgedEventKey = "last-purged-event";

// cache keys
const lastPurgedKey = "last-purged";

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
        ethAddress,
        logLevel,
        mode,
        timeouts,
    ) {
        this.info = "";
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
        this.forgeEventsCache = new Map();
        this.mode = mode;
        
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
        this.creationBlock = 0;
        this.totalSynch = 0;
        this.forgeEventsCache.set(lastPurgedKey, await this.getLastBatch());
        this.blocksPerSlot = Number(await this.rollupPoSContract.methods.BLOCKS_PER_SLOT()
            .call({from: this.ethAddress}));
        this.maxTx = Number(await this.rollupPoSContract.methods.MAX_TX()
            .call({from: this.ethAddress}));
        this.nLevels = Number(await this.rollupContract.methods.NLevels()
            .call({from: this.ethAddress}));

        if (this.creationHash) {
            const creationTx = await this.web3.eth.getTransaction(this.creationHash);
            this.creationBlock = creationTx.blockNumber;
        }

        // Start logger
        this.logInterval = setInterval(() => {
            this.logger.info(this.info);
        }, this.timeouts.LOGGER );
    }

    async synchLoop() {
        await this._init();

        // eslint-disable-next-line no-constant-condition
        while (true) {
            try {
                // get last block synched and current blockchain block
                let totalSynch = 0;
                let lastSynchBlock = await this.getLastSynchBlock();
                const currentBlock = await this.web3.eth.getBlockNumber();

                if (lastSynchBlock < this.creationBlock) {
                    await this.db.insert(lastBlockKey, this._toString(lastSynchBlock));
                    lastSynchBlock = this.creationBlock;
                }

                const currentBatchDepth = await this.rollupContract.methods.getStateDepth()
                    .call({from: this.ethAddress}, currentBlock);
                let lastBatchSaved = await this.getLastBatch();

                if (currentBatchDepth - 1 > lastBatchSaved) {
                    const targetBlockNumber = await this._getTargetBlock(lastBatchSaved, lastSynchBlock);
                    // get all logs from last batch
                    const logs = await this.rollupContract.getPastEvents("allEvents", {
                        fromBlock: lastSynchBlock + 1,
                        toBlock: targetBlockNumber,
                    });
                    // update events
                    await this._updateEvents(logs, lastBatchSaved + 1, targetBlockNumber);
                    lastBatchSaved = await this.getLastBatch();
                }

                totalSynch = (currentBatchDepth == 0) ? 100 : (((lastBatchSaved + 1) / currentBatchDepth) * 100);
                this.totalSynch = totalSynch.toFixed(2);

                this._fillInfo(currentBlock, lastSynchBlock, currentBatchDepth, lastBatchSaved);

                if (totalSynch === 100) await timeout(this.timeouts.NEXT_LOOP);
            } catch (e) {
                this.logger.error(`SYNCH Message error: ${e.message}`);
                this.logger.debug(`SYNCH Message error: ${e.stack}`);
                await timeout(this.timeouts.ERROR);
            }
        }
    }

    _fillInfo(currentBlock, lastSynchBlock, currentBatchDepth, lastBatchSaved){
        this.info = `${chalk.blue("SYNCH")} | `;
        this.info += `current block number: ${currentBlock} | `;
        this.info += `last block synched: ${lastSynchBlock} | `;
        this.info += `current batch depth: ${currentBatchDepth} | `;
        this.info += `last batch saved: ${lastBatchSaved} | `;
        this.info += `Synched: ${chalk.white.bold(`${this.totalSynch} %`)}`;
    }

    async _getTargetBlock(lastBatchSaved, lastSynchBlock){
        // Check if next target block number is in cache memory
        let targetBlockNumber = this.forgeEventsCache.get(lastBatchSaved + 1);
        if (!targetBlockNumber){
            // read events to get block number for each batch forged
            const logsForge = await this.rollupContract.getPastEvents("ForgeBatch", {
                fromBlock: lastSynchBlock + 1,
                toBlock: "latest",
            });
            for (const log of logsForge) {
                const key = Number(log.returnValues.batchNumber);
                const value = Number(log.returnValues.blockNumber);
                this.forgeEventsCache.set(key, value);
            }
        }
        // purge cache memory
        const lastEventPurged = this.forgeEventsCache.get(lastPurgedKey);
        for (let i = lastBatchSaved; i > lastEventPurged; i--) {
            this.forgeEventsCache.delete(i);
        }
        this.forgeEventsCache.set(lastPurgedKey, lastBatchSaved);
        // return block number according batch forged
        return this.forgeEventsCache.get(lastBatchSaved + 1);
    }


    async getLastSynchBlock() {
        return this._fromString(await this.db.getOrDefault(lastBlockKey, this.creationBlock.toString()));
    }

    async getLastBatch(){
        return Number(this._fromString(await this.db.getOrDefault(lastBatchKey, "-1")));
    }

    async _updateEvents(logs, nextBatchSynched, blockNumber){
        // save events on database
        let index = 0;

        for (const event of logs){
            await this._saveEvents(event, index);
            index += 1;
        }
        // Update rollupTree and last batch synched
        const eventForge = [];
        const eventOnChain = [];
        // add off-chain tx
        const keysForge = await this.db.listKeys(`${eventForgeBatchKey}${separator}${nextBatchSynched}`);
        for (const key of keysForge) {
            eventForge.push(this._fromString(await this.db.get(key)));
        }
        // add on-chain tx
        const keysOnChain = await this.db.listKeys(`${eventOnChainKey}${separator}${nextBatchSynched-1}`);
        for (const key of keysOnChain) {
            eventOnChain.push(this._fromString(await this.db.get(key)));
        }
        // Add events to rollup-tree
        if ((eventForge.length > 0) || (eventOnChain.length > 0)) 
            await this._updateTree(eventForge, eventOnChain);
        
        if (this.mode !== Constants.mode.archive)
            await this._purgeEvents(nextBatchSynched);

        await this.db.insert(lastBlockKey, this._toString(blockNumber));
        await this.db.insert(lastBatchKey, this._toString(nextBatchSynched));
    }

    async _purgeEvents(batchKey){
        // purge all events which are already used to update account balance tree
        const lastEventPurged = Number(await this.db.getOrDefault(lastPurgedEventKey, "-1"));
        // purge off-chain
        for (let i = batchKey; i > lastEventPurged; i--) {
            const keysForge = await this.db.listKeys(`${eventForgeBatchKey}${separator}${i}`);
            for (const key of keysForge) {
                await this.db.delete(key);
            }
        }
        // purge on-chain
        for (let i = (batchKey - 1); i > (lastEventPurged - 1); i--) {
            const keysOnChain = await this.db.listKeys(`${eventOnChainKey}${separator}${i}`);
            for (const key of keysOnChain) {
                await this.db.delete(key);
            }
        }
        // update last batch purged
        await this.db.insert(lastPurgedEventKey, this._toString(batchKey));
    }

    async _saveEvents(event, index) {
        if (event.event == "OnChainTx") {
            const eventOnChainData = this._getOnChainEventData(event.returnValues);
            const batchNumber = eventOnChainData.batchNumber;
            await this.db.insert(`${eventOnChainKey}${separator}${batchNumber}${separator}${index}`,
                this._toString(eventOnChainData));
        } else if (event.event == "ForgeBatch") {
            const batchNumber = event.returnValues.batchNumber;
            await this.db.insert(`${eventForgeBatchKey}${separator}${batchNumber}${separator}${index}`,
                this._toString(event.transactionHash));
        }
    }

    _getOnChainEventData(onChainData) {
        return {
            batchNumber: onChainData.batchNumber,
            txData: onChainData.txData,
            loadAmount: onChainData.loadAmount,
            ethAddress: onChainData.ethAddress,
            Ax: onChainData.Ax,
            Ay: onChainData.Ay
        };
    }

    async _deleteRedundantEvents(event) {
        const keys = Object.keys(event.returnValues);
        for (const keyCheck of keys) {
            if (Number.isInteger(Number(keyCheck))) {
                let redundant = false;
                const valueCheck = event.returnValues[keyCheck];
                for (const key of keys) {
                    if (key !== keyCheck) {
                        if (valueCheck === event.returnValues[key]){
                            redundant = true;
                            break;
                        }
                    }
                }
                if (redundant) delete event.returnValues[keyCheck];
            }
        }
    }

    async _updateTree(offChain, onChain) {
        const batch = await this.treeDb.buildBatch(this.maxTx, this.nLevels);
        for (const event of offChain) {
            const offChainTxs = await this._getTxOffChain(event);
            await this._addFeePlan(batch, offChainTxs.inputFeePlanCoin, offChainTxs.inputFeePlanFee);
            await this._setUserFee(batch, offChainTxs.txs);
            for (const tx of offChainTxs.txs) {
                batch.addTx(tx);
                if (this.mode !== Constants.mode.light){
                    if (Number(tx.toIdx) === 0) {
                        await this._addExitEntry(tx, batch.batchNumber);
                    }
                }
                    
            }
        }

        for (const event of onChain) {
            const tx = await this._getTxOnChain(event);
            batch.addTx(tx);
            const newAccount = rollupUtils.decodeTxData(event.txData).newAccount;
            if (this.mode !== Constants.mode.light)
                if ((Number(tx.toIdx) === 0) && (newAccount == false) && tx.amount !== 0 && tx.loadAmount === 0) 
                    await this._addExitEntry(tx, batch.batchNumber);
        }
        await batch.build();
        await this.treeDb.consolidate(batch);
    }

    async _addExitEntry(tx, batch){
        const key = `${exitInfoKey}${separator}${tx.fromIdx}`;
        const exitIdValue = await this.db.getOrDefault(key, "");
    
        if (exitIdValue === "")
            await this.db.insert(key, `${batch}`);
        else
            await this.db.insert(key, `${exitIdValue}${separator}${batch}`);
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

        const fromBlock = txForge.blockNumber - this.blocksPerSlot;
        const toBlock = txForge.blockNumber;
        const logs = await this.rollupPoSContract.getPastEvents("dataCommitted", {
            fromBlock: fromBlock, // previous slot
            toBlock: toBlock, // current slot
        });
        let txHash;
        for (const log of logs) {
            if (log.returnValues.hashOffChain == inputOffChainHash){
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

        const headerBytes = Math.ceil(this.maxTx/8);
        const txs = [];
        const buffCompressedTxs = Buffer.from(compressedTx.slice(2), "hex");
        const headerBuff = buffCompressedTxs.slice(0, headerBytes);
        const txsBuff = buffCompressedTxs.slice(headerBytes, buffCompressedTxs.length);
        const nTx = txsBuff.length / bytesOffChainTx;
        for (let i = 0; i < nTx; i++) {
            const step = (headerBuff[Math.floor(i/8)] & 0x80 >> (i%8)) ? 1 : 0;
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
            tx.coin = Number(stateId.coin);
        }
    }

    async getStateById(id) {
        return await this.treeDb.getStateByIdx(id);
    }

    // ax, ay encoded as hexadecimal string (whitout '0x')
    async getStateByAxAy(ax, ay) {
        return await this.treeDb.getStateByAxAy(ax, ay);
    }

    async getStateByEthAddr(ethAddress) {
        return await this.treeDb.getStateByEthAddr(ethAddress);
    }

    async getExitTreeInfo(numBatch, id) {
        return await this.treeDb.getExitTreeInfo(numBatch, id);
    }

    getSynchPercentage() {
        return this.totalSynch;
    }

    async getBatchBuilder() {
        const bb = await this.treeDb.buildBatch(this.maxTx, this.nLevels);
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
        if (this.mode === Constants.mode.archive){
            const bb = await this.treeDb.buildBatch(this.maxTx, this.nLevels); 
            const keysForge = await this.db.listKeys(`${eventForgeBatchKey}${separator}${numBatch}`);
            for (const key of keysForge) {
                const tmp = this._fromString(await this.db.get(key));
                const offChainTxs = await this._getTxOffChain(tmp);
                await this._addFeePlan(bb, offChainTxs.inputFeePlanCoin, offChainTxs.inputFeePlanFee);
                await this._setUserFee(bb, offChainTxs.txs);
                for (const tx of offChainTxs.txs) res.push(tx);
            }
        }
        return res;
    }

    async getExitsBatchById(idx){
        const exitsBatches = [];
        if (this.mode !== Constants.mode.light) {
            const key = `${exitInfoKey}${separator}${idx}`;
            const value = await this.db.getOrDefault(key, "");
            if (value !== ""){
                const numBatches = value.split(`${separator}`);
                for (const batch of numBatches) exitsBatches.push(Number(batch));
            }
        }
        return exitsBatches;
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
