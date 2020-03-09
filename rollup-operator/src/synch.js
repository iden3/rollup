const Web3 = require("web3");
const abiDecoder = require("abi-decoder");
const winston = require("winston");
const chalk = require("chalk");
const { stringifyBigInts, unstringifyBigInts, bigInt } = require("snarkjs");

const rollupUtils = require("../../rollup-utils/rollup-utils");
const { float2fix } = require("../../js/utils");
const { timeout } = require("../src/utils");
const Constants = require("./constants");

// offChainTx --> From | To | Amount |
//            -->   3  | 3  |    2   | bytes 
const bytesOffChainTx = 3*2 + 2;

const offChainHashInput = 3;
const feePlanCoinsInput = 6;
const feePlanFeesInput = 7;

// db keys
const batchStateKey = "batch-state";

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
                // get last block synched, current block, last batch synched
                let totalSynch = 0;
                let lastBatchSaved = await this.getLastBatch();
                const currentBlock = await this.web3.eth.getBlockNumber();
                const currentBatchDepth = await this.rollupContract.methods.getStateDepth()
                    .call({from: this.ethAddress}, currentBlock);

                // get last state saved
                const stateSaved = await this.getStateFromBatch(lastBatchSaved);

                // check last batch number matches. Last state saved should match state in contract
                const stateDepth = parseInt(await this.rollupContract.methods.getStateDepth()
                    .call({from: this.ethAddress}, stateSaved.blockNumber));

                if (stateSaved.root && stateDepth !== lastBatchSaved){
                    // clear database
                    await this._clearRollback(lastBatchSaved);
                    this._infoRollback(lastBatchSaved - 1, "Contract State depth does not match last state depth saved");
                    await this._rollback(lastBatchSaved);
                    continue;
                }
                    
                // Check root matches with the one saved
                const stateRoot = bigInt(await this.rollupContract.methods.getStateRoot(stateDepth)
                    .call({ from: this.ethAddress }, stateSaved.blockNumber));
                    
                const stateRootHex = `0x${bigInt(stateRoot).toString(16)}`;

                if (stateSaved.root && (stateRootHex !== stateSaved.root)) {
                    // clear database
                    await this._clearRollback(lastBatchSaved);
                    this._infoRollback(lastBatchSaved - 1, "Contract root does not match last root saved");
                    await this._rollback(lastBatchSaved);
                    continue;
                }

                // Check current mining onChain hash
                const stateMiningOnChainHash = bigInt(await this.rollupContract.methods.miningOnChainTxsHash()
                    .call({ from: this.ethAddress }, stateSaved.blockNumber));

                const stateMiningOnChainHashHex = `0x${bigInt(stateMiningOnChainHash).toString(16)}`;
                if (stateSaved.root && (stateMiningOnChainHashHex !== stateSaved.miningOnChainHash)) {
                    // clear database
                    await this._clearRollback(lastBatchSaved);
                    this._infoRollback(lastBatchSaved - 1, "Contract miningOnChainHash does not match with the saved one");
                    await this._rollback(lastBatchSaved);
                    continue;
                }

                if (currentBatchDepth > lastBatchSaved) {
                    const targetBlockNumber = await this._getTargetBlock(lastBatchSaved + 1, stateSaved.blockNumber);
                    // If no event is found, tree is not updated
                    if (!targetBlockNumber) continue;
                    // get all logs from last batch
                    const logsForge = await this.rollupContract.getPastEvents("ForgeBatch", {
                        fromBlock: stateSaved.blockNumber + 1,
                        toBlock: targetBlockNumber,
                    });
                    const logsOnChain = await this.rollupContract.getPastEvents("OnChainTx", {
                        fromBlock: stateSaved.blockNumber,
                        toBlock: targetBlockNumber,
                    });
                    // update events
                    const updateFlag = await this._updateEvents([...logsForge,...logsOnChain], lastBatchSaved + 1, targetBlockNumber);
                    if (!updateFlag) continue;
                    lastBatchSaved = await this.getLastBatch();
                }

                totalSynch = (currentBatchDepth == 0) ? 100 : ((lastBatchSaved / currentBatchDepth) * 100);
                this.totalSynch = totalSynch.toFixed(2);

                this._fillInfo(currentBlock, stateSaved.blockNumber, currentBatchDepth, lastBatchSaved);

                if (lastBatchSaved >= currentBatchDepth) await timeout(this.timeouts.NEXT_LOOP);
            } catch (e) {
                this.logger.error(`SYNCH Message error: ${e.message}`);
                this.logger.debug(`SYNCH Message error: ${e.stack}`);
                await timeout(this.timeouts.ERROR);
            }
        }
    }

    _infoRollback(numBatch, message){
        let info = `${chalk.blue("STATE SYNCH".padEnd(12))} | `;
        info += `${chalk.bgYellow.black("rollback info")}`;
        info += ` ==> Rollback to batch ${numBatch} | `;
        info += `${message}`;
        this.logger.info(info);
    }

    _fillInfo(currentBlock, lastSynchBlock, currentBatchDepth, lastBatchSaved){
        this.info = `${chalk.blue("STATE SYNCH".padEnd(12))} | `;
        this.info += `current block number: ${currentBlock} | `;
        this.info += `last block synched: ${lastSynchBlock} | `;
        this.info += `current batch depth: ${currentBatchDepth} | `;
        this.info += `last batch synched: ${lastBatchSaved} | `;
        this.info += `Synched: ${chalk.white.bold(`${this.totalSynch} %`)}`;
    }

    _logError(message){
        let info = `${chalk.blue("STATE SYNCH".padEnd(12))} | `;
        info += `${chalk.bgRed.black("error info")}`;
        info += ` ==> ${message}`;
        this.logger.info(info);
    }

    async _getTargetBlock(batchToSynch, lastSynchBlock){
        let targetBlockNumber = undefined;
        const logsForge = await this.rollupContract.getPastEvents("ForgeBatch", {
            fromBlock: lastSynchBlock + 1,
            toBlock: "latest",
        });

        for (const log of logsForge){
            const batchNumber = Number(log.returnValues.batchNumber);
            if (batchNumber === batchToSynch){
                targetBlockNumber = Number(log.returnValues.blockNumber);
                break;
            }
        }
        return targetBlockNumber;
    }

    async _clearRollback(batchNumber) {
        // clear last batch saved
        await this.db.delete(`${batchStateKey}${separator}${batchNumber}`);
        // clear onChain events
        await this.db.delete(`${eventOnChainKey}${separator}${batchNumber-1}`);
        // clear forge events
        await this.db.delete(`${eventForgeBatchKey}${separator}${batchNumber}`);
    }

    async _rollback(batchNumber) {
        const rollbackBatch = batchNumber - 1;
        const state = await this.getStateFromBatch(rollbackBatch);
        if (state) {
            await this.treeDb.rollbackToBatch(rollbackBatch);
            await this.db.insert(lastBatchKey, this._toString(rollbackBatch));
        } else
            throw new Error("can not rollback to a non-existent state");
    }

    async getStateFromBatch(numBatch) {
        const key = `${batchStateKey}${separator}${numBatch}`;
        return this._fromString(await this.db.getOrDefault(key, this._toString({root: false, blockNumber: this.creationBlock, miningOnChainHash: false})));
    }

    async getLastSynchBlock() {
        return this._fromString(await this.db.getOrDefault(lastBlockKey, this.creationBlock.toString()));
    }

    async getLastBatch(){
        return Number(this._fromString(await this.db.getOrDefault(lastBatchKey, "0")));
    }

    async _updateEvents(logs, nextBatchSynched, blockNumber){
        try {
            // save events on database
            const numBatchesToSynch = await this._saveEvents(logs, nextBatchSynched);
            for (const batchSynch of numBatchesToSynch){
                const tmpForgeArray = await this.db.getOrDefault(`${eventForgeBatchKey}${separator}${batchSynch}`);
                const tmpOnChainArray = await this.db.getOrDefault(`${eventOnChainKey}${separator}${batchSynch-2}`);

                let eventOnChain = [];
                let eventForge = [];
                if (tmpForgeArray)
                    eventForge = this._fromString(tmpForgeArray);
                if (tmpOnChainArray)
                    eventOnChain = this._fromString(tmpOnChainArray);

                // Update rollupTree
                // Add events to rollup-tree
                if (eventForge.length > 0){
                    await this._updateTree(eventForge, eventOnChain);
                    const miningOnChainHash = await this._getMiningOnChainHash(batchSynch);
                    const root = `0x${this.treeDb.getRoot().toString(16)}`;
                    const batchToSave = this.treeDb.lastBatch;
                    await this.db.insert(`${batchStateKey}${separator}${batchToSave}`, this._toString({root, blockNumber, miningOnChainHash}));
                    await this.db.insert(lastBlockKey, this._toString(blockNumber));
                    await this.db.insert(lastBatchKey, this._toString(batchSynch));
                }
            }
            if (this.mode !== Constants.mode.archive)
                await this._purgeEvents(nextBatchSynched + numBatchesToSynch.length - 1);
            return true;
        } catch (error) {
            this._logError(`error updating batch number: ${nextBatchSynched}`);
            this._logError("Events are not saved. Retry in the next synchronization loop");
            return false;
        }
    }

    async _purgeEvents(batchKey){
        // purge all events which are already used to update account balance tree
        const lastEventPurged = Number(await this.db.getOrDefault(lastPurgedEventKey, "0"));
        // purge off-chain
        for (let i = batchKey; i > lastEventPurged; i--) {
            await this.db.delete(`${eventForgeBatchKey}${separator}${i}`);
        }
        // purge on-chain
        for (let i = (batchKey - 2); i > (lastEventPurged - 2); i--) {
            await this.db.delete(`${eventOnChainKey}${separator}${i}`);
        }
        // update last batch purged
        await this.db.insert(lastPurgedEventKey, this._toString(batchKey));
    }

    async _saveEvents(logs, nextBatchSynched) {
        let batchesForged = [];
        const eventsOnChain = {};

        for(const event of logs){
            // Add onChain events
            if (event.event == "OnChainTx"){
                const eventOnChainData = this._getOnChainEventData(event.returnValues);
                const numBatchForged = Number(event.returnValues.batchNumber);
                if (numBatchForged >= nextBatchSynched - 1){
                    if (!eventsOnChain[numBatchForged])
                        eventsOnChain[numBatchForged] = [];
                    eventsOnChain[numBatchForged].push(eventOnChainData);
                }
            }

            // Save forge batch
            if (event.event == "ForgeBatch"){
                const eventForge = [];
                const numBatchForged = Number(event.returnValues.batchNumber);
                if (numBatchForged >= nextBatchSynched){
                    batchesForged.push(numBatchForged);
                    eventForge.push(event.transactionHash);
                    await this.db.insert(`${eventForgeBatchKey}${separator}${numBatchForged}`,
                        this._toString(eventForge));
                }
            }
        }
        // Save onChain events
        for (const batchNumber of Object.keys(eventsOnChain)){
            const arrayOnChain = eventsOnChain[batchNumber];
            await this.db.insert(`${eventOnChainKey}${separator}${batchNumber}`,
                this._toString(arrayOnChain));
        }

        // return forge events to save
        return batchesForged;
    }

    async _getMiningOnChainHash(batchNumber){
        const tmpOnChainArray = await this.db.getOrDefault(`${eventOnChainKey}${separator}${batchNumber-1}`);
        let eventsOnChain = [];
        if (tmpOnChainArray)
            eventsOnChain = this._fromString(tmpOnChainArray);
        const bb = await this.treeDb.buildBatch(this.maxTx, this.nLevels);
        for (const event of eventsOnChain) {
            const tx = await this._getTxOnChain(event);
            bb.addTx(tx);
        }
        await bb.build();
        return `0x${bb.getOnChainHash().toString(16)}`;
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
            await this._setUserFee(offChainTxs.txs);
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
            const newAccount = tx.newAccount;
            if (this.mode !== Constants.mode.light)
                if ((Number(tx.toIdx) === 0) && (newAccount == false) && tx.amount !== 0 && tx.loadAmount === 0) 
                    await this._addExitEntry(tx, batch.batchNumber);
        }
        await batch.build();
        await this.treeDb.consolidate(batch);
        return true;
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
            onChain: true,
            newAccount: txData.newAccount,
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
        const inputOffChainHash = inputRetrieved[offChainHashInput];
        const inputFeePlanCoin = inputRetrieved[feePlanCoinsInput];
        const inputFeePlanFee = inputRetrieved[feePlanFeesInput];

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
                amount: float2fix(txsBuff.readUIntBE(8*i + 6, 2)),
                step,
            };
            txs.push(tx);
        }
        return {txs, inputFeePlanCoin, inputFeePlanFee};
    }

    async _addFeePlan(bb, feePlanCoins, feePlanFee) {
        const tmpCoins = bigInt(feePlanCoins);
        const tmpFeeF = bigInt(feePlanFee);
        for (let i = 0; i < 16; i++){
            const coin = tmpCoins.shr(16*i).and(bigInt(1).shl(16).sub(bigInt(1)));
            const fee = float2fix(tmpFeeF.shr(16*i).and(bigInt(1).shl(16).sub(bigInt(1))).toJSNumber());
            await bb.addCoin(coin, fee);
        }
    }

    async _setUserFee(txs){
        for (const tx of txs) {
            const stateId = await this.getStateById(tx.fromIdx);
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
        let eventsOnChain = [];
        const tmpEventsOnChain = await this.db.getOrDefault(`${eventOnChainKey}${separator}${currentBatchDepth-1}`);
        if (tmpEventsOnChain)
            eventsOnChain = this._fromString(tmpEventsOnChain);

        for (const event of eventsOnChain) {
            bb.addTx(await this._getTxOnChain(event));
        }
        return bb;
    }

    async getOffChainTxByBatch(numBatch) {
        const res = [];
        // add off-chain tx
        if (this.mode === Constants.mode.archive){
            const bb = await this.treeDb.buildBatch(this.maxTx, this.nLevels);
            const tmpForgeArray = await this.db.getOrDefault(`${eventForgeBatchKey}${separator}${numBatch}`);
            let eventForge = [];
            if (tmpForgeArray) 
                eventForge = this._fromString(tmpForgeArray);

            for (const hashTx of eventForge) {
                const offChainTxs = await this._getTxOffChain(hashTx);
                await this._addFeePlan(bb, offChainTxs.inputFeePlanCoin, offChainTxs.inputFeePlanFee);
                await this._setUserFee(offChainTxs.txs);
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
        if (lastBatchSaved < currentBatch) return false;
        return true;
    }

    async getCurrentStateRoot() {
        const lastBatch = await this.rollupContract.methods.getStateDepth()
            .call({from: this.ethAddress});
        return await this.rollupContract.methods.getStateRoot(lastBatch)
            .call({from: this.ethAddress});
    }

    async getMiningOnchainHash() {
        return await this.rollupContract.methods.miningOnChainTxsHash()
            .call({from: this.ethAddress});
    }
}

module.exports = Synchronizer;
