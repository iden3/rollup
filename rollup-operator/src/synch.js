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

                // get last state saved
                const stateSaved = await this.getStateFromBatch(lastBatchSaved);

                // check last batch number matches. Last state saved should match state in contract.
                const stateDepth = parseInt(await this.rollupContract.methods.getStateDepth()
                    .call({from: this.ethAddress}, stateSaved.blockNumber));

                // console.log("last batch saved: ", lastBatchSaved);
                // console.log("state depth - 1: ", stateDepth - 1);
                // console.log("stateSaved:", stateSaved);
                
                if (stateSaved.root && (stateDepth - 1) !== lastBatchSaved){
                    console.log("+++++++++++ROLL BACK 1");
                    await this._rollback(lastBatchSaved);
                    continue;
                }
                
                // Check root matches with the one saved
                const stateRoot = bigInt(await this.rollupContract.methods.getStateRoot(stateDepth)
                    .call({ from: this.ethAddress }, stateSaved.blockNumber));
                
                const stateRootHex = `0x${bigInt(stateRoot).toString(16)}`;
                
                if (stateSaved.root && (stateRootHex !== stateSaved.root)) {
                    console.log("+++++++++++ROLL BACK 2");
                    await this._rollback(lastBatchSaved);
                    continue;
                }

                const currentBatchDepth = await this.rollupContract.methods.getStateDepth()
                    .call({from: this.ethAddress}, currentBlock);

                if (currentBatchDepth - 1 > lastBatchSaved) {
                    const targetBlockNumber = await this._getTargetBlock(lastBatchSaved, stateSaved.blockNumber);
                    // If no event is found, no tree is updated
                    if (!targetBlockNumber) {
                        console.log("Undefined targetBlockNumber");
                        continue;
                    }
                    // get all logs from last batch
                    const logs = await this.rollupContract.getPastEvents("allEvents", {
                        fromBlock: stateSaved.blockNumber + 1,
                        toBlock: targetBlockNumber,
                    });
                    // update events
                    await this._updateEvents(logs, lastBatchSaved + 1, targetBlockNumber);
                    lastBatchSaved = await this.getLastBatch();
                }

                totalSynch = (currentBatchDepth == 0) ? 100 : (((lastBatchSaved + 1) / currentBatchDepth) * 100);
                this.totalSynch = totalSynch.toFixed(2);

                this._fillInfo(currentBlock, stateSaved.blockNumber, currentBatchDepth, lastBatchSaved);

                if (lastBatchSaved >= currentBatchDepth - 1) await timeout(this.timeouts.NEXT_LOOP);
            } catch (e) {
                this.logger.error(`SYNCH Message error: ${e.message}`);
                this.logger.debug(`SYNCH Message error: ${e.stack}`);
                await timeout(this.timeouts.ERROR);
            }
        }
    }

    _fillInfo(currentBlock, lastSynchBlock, currentBatchDepth, lastBatchSaved){
        this.info = `${chalk.blue("STATE SYNCH".padEnd(12))} | `;
        this.info += `current block number: ${currentBlock} | `;
        this.info += `last block synched: ${lastSynchBlock} | `;
        this.info += `current batch depth: ${currentBatchDepth} | `;
        this.info += `last batch saved: ${lastBatchSaved} | `;
        this.info += `Synched: ${chalk.white.bold(`${this.totalSynch} %`)}`;
    }

    async _getTargetBlock(lastBatchSaved, lastSynchBlock){
        // read events to get block number for each batch forged
        let targetBlockNumber = undefined;
        const logsForge = await this.rollupContract.getPastEvents("ForgeBatch", {
            fromBlock: lastSynchBlock + 1,
            toBlock: "latest",
        });

        for (const log of logsForge){
            const batchNumber = Number(log.returnValues.batchNumber);
            if (batchNumber === lastBatchSaved + 1){
                targetBlockNumber = Number(log.returnValues.blockNumber);
                break;
            }
        }
        return targetBlockNumber;
    }

    async _rollback(batchNumber) {
        const rollbackBatch = batchNumber - 1;
        const state = this.getStateFromBatch(rollbackBatch);
        if (state) {
            await this.treeDb.rollbackToBatch(batchNumber);
            await this.db.insert(lastBatchKey, this._toString(rollbackBatch));
        } else
            throw new Error("can not rollback to a non-existent state");
    }

    async getStateFromBatch(numBatch) {
        const key = `${batchStateKey}${separator}${numBatch}`;
        return this._fromString(await this.db.getOrDefault(key, this._toString({root: false, blockNumber: this.creationBlock})));
    }

    async getLastSynchBlock() {
        return this._fromString(await this.db.getOrDefault(lastBlockKey, this.creationBlock.toString()));
    }

    async getLastBatch(){
        return Number(this._fromString(await this.db.getOrDefault(lastBatchKey, "-1")));
    }

    async _updateEvents(logs, nextBatchSynched, blockNumber){
        // save events on database
        await this._saveEvents(logs, nextBatchSynched);

        const tmpForgeArray = await this.db.getOrDefault(`${eventForgeBatchKey}${separator}${nextBatchSynched}`);
        const tmpOnChainArray = await this.db.getOrDefault(`${eventOnChainKey}${separator}${nextBatchSynched-1}`);

        let eventOnChain = [];
        let eventForge = [];
        if (tmpForgeArray) 
            eventForge = this._fromString(tmpForgeArray);
        if (tmpOnChainArray) 
            eventOnChain = this._fromString(tmpOnChainArray); 

        // Update rollupTree and last batch synched
        // Add events to rollup-tree
        if ((eventForge.length > 0) || (eventOnChain.length > 0)) 
            await this._updateTree(eventForge, eventOnChain);
        
        if (this.mode !== Constants.mode.archive)
            await this._purgeEvents(nextBatchSynched);

        const root = `0x${this.treeDb.getRoot().toString(16)}`;
        // console.log("KEY ADDED: ", `${batchStateKey}${separator}${nextBatchSynched}`);
        // console.log("VALUE ROOT: ", root);
        // console.log("VALUE BLOCK: ", blockNumber);
        await this.db.insert(`${batchStateKey}${separator}${nextBatchSynched}`, this._toString({root, blockNumber}));
        await this.db.insert(lastBlockKey, this._toString(blockNumber));
        await this.db.insert(lastBatchKey, this._toString(nextBatchSynched));
    }

    async _purgeEvents(batchKey){
        // purge all events which are already used to update account balance tree
        const lastEventPurged = Number(await this.db.getOrDefault(lastPurgedEventKey, "-1"));
        // purge off-chain
        for (let i = batchKey; i > lastEventPurged; i--) {
            await this.db.delete(`${eventForgeBatchKey}${separator}${i}`);
            
        }
        // purge on-chain
        for (let i = (batchKey - 1); i > (lastEventPurged - 1); i--) {
            await this.db.delete(`${eventOnChainKey}${separator}${i}`);
        }
        // update last batch purged
        await this.db.insert(lastPurgedEventKey, this._toString(batchKey));
    }

    async _saveEvents(logs, numBatch) {
        const eventsOnChain = [];
        const eventsForge = [];
        for (const event of logs){
            if (event.event == "OnChainTx") {
                const eventOnChainData = this._getOnChainEventData(event.returnValues);
                eventsOnChain.push(eventOnChainData);
            } else if (event.event == "ForgeBatch") {
                eventsForge.push(event.transactionHash);
            }
        }
        await this.db.insert(`${eventOnChainKey}${separator}${numBatch}`,
            this._toString(eventsOnChain));
        await this.db.insert(`${eventForgeBatchKey}${separator}${numBatch}`,
            this._toString(eventsForge)); 
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
            const newAccount = tx.newAccount;
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
        const inputOffChainHash = inputRetrieved[4];
        const inputFeePlanCoin = inputRetrieved[5];
        const inputFeePlanFee = inputRetrieved[6];

        const fromBlock = txForge.blockNumber - this.blocksPerSlot;
        const toBlock = txForge.blockNumber;
        // console.log("update tree from: ", fromBlock);
        // console.log("update tree to: ", toBlock);
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
        // console.log("getting data committed...");
        const txDataCommitted = await this.web3.eth.getTransaction(txHash);
        const decodedData2 = abiDecoder.decodeMethod(txDataCommitted.input);
        let compressedTx;
        decodedData2.params.forEach(elem => {
            if (elem.name == "compressedTx") {
                compressedTx = elem.value;
            }
        });
        // console.log("finish getting data commited");
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

    async _setUserFee(bb, txs){
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
