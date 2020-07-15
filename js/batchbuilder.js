const assert = require("assert");
const crypto = require("crypto");
const Scalar = require("ffjavascript").Scalar;
const poseidon = require("circomlib").poseidon;
const SMT = require("circomlib").SMT;

const SMTTmpDb = require("./smttmpdb");
const utils = require("./utils");
const Constants = require("./constants");

const poseidonHash = poseidon.createHash(6, 8, 57);

module.exports = class BatchBuilder {
    constructor(rollupDB, batchNumber, root, initialIdx, maxNTx, nLevels) {
        assert((nLevels % 8) == 0);
        this.rollupDB = rollupDB;
        this.batchNumber = batchNumber;
        this.finalIdx = initialIdx;
        this.maxNTx = maxNTx || 4;
        this.nLevels = nLevels;
        this.offChainTxs = [];
        this.onChainTxs = [];
        this.depOffChainTxs = [];
        this.dbState = new SMTTmpDb(rollupDB.db);
        this.stateTree = new SMT(this.dbState, root);
        this.dbExit = new SMTTmpDb(rollupDB.db);
        this.exitTree = new SMT(this.dbExit, Scalar.e(0));
        this.feePlanCoins = Array(64).fill(0);
        this.feeTotals = Array(64).fill(0);
        this.nCoins = 0;
        this.newBatchNumberDb = Scalar.e(batchNumber);
    }
    
    /**
     * Add an empty transaction to the batchbuilder
     */
    _addNopTx() {
        const i = this.input.txData.length;
        this.input.txData[i] = utils.buildTxData({
            amount: 0,
            coin: 0,
            nonce: 0,
            userFee: 0,
            rqOffset: 0,
            onChain: 0,
            newAccount: 0
        });
        this.input.fromIdx[i] = 0;
        this.input.toIdx[i] = 0;
        // to
        this.input.toEthAddr[i] = 0,
        this.input.rqTxData[i] = 0;
        this.input.s[i] = 0;
        this.input.r8x[i] = 0;
        this.input.r8y[i] = 0;
        // on-chain
        this.input.fromEthAddr[i] = 0;
        this.input.fromAx[i] = 0;
        this.input.fromAy[i] = 0;
        this.input.loadAmount[i] = 0;

        // State 1
        this.input.ax1[i] = 0;
        this.input.ay1[i] = 0;
        this.input.amount1[i] = 0;
        this.input.nonce1[i] = 0;
        this.input.ethAddr1[i] = 0;
        this.input.siblings1[i] = [];
        for (let j=0; j<this.nLevels+1; j++) {
            this.input.siblings1[i][j] = 0;
        }
        this.input.isOld0_1[i] = 0;
        this.input.oldKey1[i] = 0;
        this.input.oldValue1[i] = 0;

        // State 2
        this.input.ax2[i] = 0;
        this.input.ay2[i] = 0;
        this.input.amount2[i] = 0;
        this.input.nonce2[i] = 0;
        this.input.ethAddr2[i] = 0;
        this.input.siblings2[i] = [];
        for (let j=0; j<this.nLevels+1; j++) {
            this.input.siblings2[i][j] = 0;
        }
        this.input.isOld0_2[i] = 0;
        this.input.oldKey2[i] = 0;
        this.input.oldValue2[i] = 0;
        
        if (i<this.maxNTx-1) {
            this.input.imStateRoot[i] = this.stateTree.root;
            this.input.imExitRoot[i] = this.exitTree.root;
            const lastHash = i == 0 ? 0: this.input.imOnChainHash[i-1];
            this.input.imOnChainHash[i] = lastHash;
            this.input.imOnChain[i] = 0;
        }
    }

    /**
     * Process a transaction, update the DB and the inputs for the circuit
     * @param {Object} tx - Object transaction
     */
    async _addTx(tx) {
        const i = this.input.txData.length;

        // Find and set Idx
        const hashFromIdx = utils.hashIdx(tx.coin, tx.fromEthAddr);

        let fromIdx = await this.dbState.get(hashFromIdx);

        let toIdx;
        
        if (Scalar.eq(tx.toEthAddr, Constants.exitAccount)) toIdx = 0;
        else {
            const hashToIdx = utils.hashIdx(tx.coin, tx.toEthAddr); 
            toIdx = await this.dbState.get(hashToIdx);
        }

        if (toIdx === undefined)
            throw new Error("trying to send to a non existing account");

        this._addIdx(tx, fromIdx, toIdx);

        // Round values
        const amountF = utils.fix2float(tx.amount || 0);
        const amount = utils.float2fix(amountF);

        let loadAmount = Scalar.e(tx.loadAmount || 0);
        if ((!tx.onChain) && (Scalar.gt(loadAmount, 0))) {
            throw new Error("Load amount must be 0 for offChainTxs");
        }

        let oldState1;
        let oldState2;
        let op1 = "NOP";
        let op2 = "INSERT";
        let isExit;
        let newAccount = 0;

        // From leaf
        const resFind1 = await this.stateTree.find(tx.fromIdx);
        if (resFind1.found) {
            const foundValueId = poseidonHash([resFind1.foundValue, tx.fromIdx]);
            oldState1 = utils.array2state(await this.dbState.get(foundValueId));
            op1 = "UPDATE";
        } else {
            // INSERT
            // tx needs Ax, Ay
            oldState1 = {
                amount: Scalar.e(0),
                coin: tx.coin,
                nonce: 0,
                ax: tx.fromAx,
                ay: tx.fromAy,
                ethAddress: tx.fromEthAddr
            };
            op1 = "INSERT";
            newAccount = 1;
        }

        // To leaf
        let resFind2;
        let resFindExit;
        if (tx.toIdx) {
            resFind2 = await this.stateTree.find(tx.toIdx);
            if (!resFind2.found) {
                throw new Error("trying to send to a wrong address");
            }
            const foundValueId = poseidonHash([resFind2.foundValue, tx.toIdx]);
            oldState2 = utils.array2state(await this.dbState.get(foundValueId));
            isExit = false;
            op2 = "UPDATE";
        } else {
            resFindExit = await this.exitTree.find(tx.fromIdx);
            if (resFindExit.found) {
                const foundValueId = poseidonHash([resFindExit.foundValue, tx.fromIdx]);
                oldState2 = utils.array2state(await this.dbExit.get(foundValueId));
                op2 = "UPDATE";
            } else {
                oldState2 = {
                    amount: Scalar.e(0),
                    coin: tx.coin,
                    nonce: 0,
                    ax: tx.fromAx || oldState1.ax,
                    ay: tx.fromAy || oldState1.ay,
                    ethAddress: tx.fromEthAddr || oldState1.ethAddress
                };
                op2 = "INSERT";
            }
            isExit = true;
        }

        let fee2Charge;
        if (tx.onChain){
            fee2Charge = Scalar.e(0);
        } else {
            fee2Charge = utils.computeFee(tx.amount, tx.fee);
        }      

        let effectiveAmount = amount; 

        const underFlowOk = Scalar.geq(Scalar.sub( Scalar.sub( Scalar.add(oldState1.amount, loadAmount), amount), fee2Charge), 0);
        if (!underFlowOk) {
            if (tx.onChain) {
                effectiveAmount = Scalar.e(0);
            } else {
                let errStr = "Error ";
                if (!underFlowOk) errStr = "underflow";
                throw new Error(errStr);
            }
        }

        if (Scalar.eq(effectiveAmount, 0)) op2="NOP";

        this.input.fromIdx[i] = tx.fromIdx;
        this.input.toIdx[i] = tx.toIdx;
        this.input.txData[i] = utils.buildTxData(Object.assign({newAccount: newAccount}, tx));
        this.input.toEthAddr[i] = Scalar.fromString(tx.toEthAddr, 16),
        this.input.rqTxData[i]= tx.rqTxData || 0;
        this.input.s[i]= tx.s || 0;
        this.input.r8x[i]= tx.r8x || 0;
        this.input.r8y[i]= tx.r8y || 0;
        this.input.loadAmount[i]= loadAmount;
        this.input.fromEthAddr[i]= Scalar.fromString(oldState1.ethAddress, 16);
        this.input.fromAx[i]= Scalar.fromString(oldState1.ax, 16);
        this.input.fromAy[i]= Scalar.fromString(oldState1.ay, 16);

        const newState1 = Object.assign({}, oldState1);
        newState1.amount = Scalar.sub(Scalar.sub(Scalar.add(oldState1.amount, loadAmount), effectiveAmount), fee2Charge);
        if (!tx.onChain) {
            newState1.nonce++;
            this._accumulateFees(tx.coin, fee2Charge);
        }

        if (tx.fromIdx === tx.toIdx)
            oldState2 = Object.assign({}, newState1);

        const newState2 = Object.assign({}, oldState2);
        newState2.amount = Scalar.add(oldState2.amount, effectiveAmount);
        if (op1=="INSERT") {

            this.finalIdx += 1;
            const newValue = utils.hashState(newState1);

            const res = await this.stateTree.insert(tx.fromIdx, newValue);
            let siblings = res.siblings;
            while (siblings.length<this.nLevels+1) siblings.push(Scalar.e(0));

            // State 1
            // That first 4 parameters do not matter in the circuit, since it gets the information from the TxData
            this.input.ax1[i]= 0x1234;      // It should not matter
            this.input.ay1[i]= 0x1234;      // It should not matter
            this.input.amount1[i]= 0x1234;  // It should not matter
            this.input.nonce1[i]= 0x1234;   // It should not matter
            this.input.ethAddr1[i]= this.input.fromEthAddr[i]; // In the onChain TX this must match
            this.input.siblings1[i] = siblings;
            this.input.isOld0_1[i]= res.isOld0 ? 1 : 0;
            this.input.oldKey1[i]= res.isOld0 ? 0 : res.oldKey;
            this.input.oldValue1[i]= res.isOld0 ? 0 : res.oldValue;

            // Insert hashmap uniqueHash-idx
            const keyIdx = this._uniqueAccount(tx.coin, tx.fromEthAddr);
            await this.dbState.multiIns([
                [keyIdx, tx.fromIdx],
            ]);

            // Database AxAy
            const keyAxAy = Scalar.add( Scalar.add(Constants.DB_AxAy, this.input.fromAx[i]), this.input.fromAy[i]);
            const lastAxAyStates = await this.dbState.get(keyAxAy);
                
            // get last state and add last batch number
            let valStatesAxAy;
            let lastAxAyState;
            if (!lastAxAyStates) {
                lastAxAyState = null;
                valStatesAxAy = [];
            }
            else {
                valStatesAxAy = [...lastAxAyStates];
                lastAxAyState = valStatesAxAy.slice(-1)[0];
            }
            if (!valStatesAxAy.includes(this.newBatchNumberDb)){
                valStatesAxAy.push(this.newBatchNumberDb);
                await this.dbState.multiIns([
                    [keyAxAy, valStatesAxAy],
                ]);
            }

            // get last state
            let valOldAxAy = null;
            if (lastAxAyState){
                const keyOldAxAyBatch = poseidonHash([keyAxAy, lastAxAyState]);
                valOldAxAy = await this.dbState.get(keyOldAxAyBatch);
            }

            let newValAxAy;
            if (!valOldAxAy) newValAxAy = [];
            else newValAxAy = [...valOldAxAy];
            newValAxAy.push(Scalar.e(tx.fromIdx));
            // new key newValAxAy
            const newKeyAxAyBatch = poseidonHash([keyAxAy, this.newBatchNumberDb]);
            await this.dbState.multiIns([
                [newKeyAxAyBatch, newValAxAy],
            ]);

            // Database Ether address
            const keyEth = Scalar.add(Constants.DB_EthAddr, this.input.fromEthAddr[i]);
            const lastEthStates = await this.dbState.get(keyEth);

            // get last state and add last batch number
            let valStatesEth;
            let lastEthState;
            if (!lastEthStates) {
                lastEthState = null;
                valStatesEth = [];
            }
            else {
                valStatesEth = [...lastEthStates];
                lastEthState = valStatesEth.slice(-1)[0];
            } 
            if (!valStatesEth.includes(this.newBatchNumberDb)){
                valStatesEth.push(this.newBatchNumberDb);
                await this.dbState.multiIns([
                    [keyEth, valStatesEth],
                ]);
            }

            // get last state
            let valOldEth = null;
            if (lastEthState){
                const keyOldEthBatch = poseidonHash([keyEth, lastEthState]);
                valOldEth = await this.dbState.get(keyOldEthBatch);
            }

            let newValEth;
            if (!valOldEth) newValEth = [];
            else newValEth = [...valOldEth];
            newValEth.push(Scalar.e(tx.fromIdx));

            // new key newValEth
            const newKeyEthBatch = poseidonHash([keyEth, this.newBatchNumberDb]);

            await this.dbState.multiIns([
                [newKeyEthBatch, newValEth],
            ]);

            // Database Idx
            // get array of states saved by batch
            const lastIdStates = await this.dbState.get(Scalar.add(Constants.DB_Idx, tx.fromIdx));
            // add last batch number
            let valStatesId;
            if (!lastIdStates) valStatesId = [];
            else valStatesId = [...lastIdStates];
            if (!valStatesId.includes(this.newBatchNumberDb)) valStatesId.push(this.newBatchNumberDb);

            // new state for idx
            const newValueId = poseidonHash([newValue, tx.fromIdx]);

            // new entry according idx and batchNumber
            const keyIdBatch = poseidonHash([tx.fromIdx, this.newBatchNumberDb]);
            
            await this.dbState.multiIns([
                [newValueId, utils.state2array(newState1)],
                [keyIdBatch, newValueId],
                [Scalar.add(Constants.DB_Idx, tx.fromIdx), valStatesId],
            ]);
        } else if (op1 == "UPDATE") {
            const newValue = utils.hashState(newState1);

            const res = await this.stateTree.update(tx.fromIdx, newValue);
            let siblings = res.siblings;
            while (siblings.length<this.nLevels+1) siblings.push(Scalar.e(0));

            // State 1
            //It should not matter what the Tx have, because we get the input from the oldState
            this.input.ax1[i]= Scalar.fromString(oldState1.ax, 16);
            this.input.ay1[i]= Scalar.fromString(oldState1.ay, 16);
            this.input.amount1[i]= oldState1.amount;  
            this.input.nonce1[i]= oldState1.nonce; 
            this.input.ethAddr1[i]= Scalar.fromString(oldState1.ethAddress, 16);


            this.input.siblings1[i] = siblings;
            this.input.isOld0_1[i]= 0;
            this.input.oldKey1[i]= 0x1234;      // It should not matter
            this.input.oldValue1[i]= 0x1234;    // It should not matter

            // get array of states saved by batch
            const lastIdStates = await this.dbState.get(Scalar.add(Constants.DB_Idx, tx.fromIdx));
            // add last batch number
            let valStatesId;
            if (!lastIdStates) valStatesId = [];
            else valStatesId = [...lastIdStates];
            if (!valStatesId.includes(this.newBatchNumberDb)) valStatesId.push(this.newBatchNumberDb);

            // new state for idx
            const newValueId = poseidonHash([newValue, tx.fromIdx]);
            
            // new entry according idx and batchNumber
            const keyIdBatch = poseidonHash([tx.fromIdx, this.newBatchNumberDb]);
            
            await this.dbState.multiIns([
                [newValueId, utils.state2array(newState1)],
                [keyIdBatch, newValueId],
                [Scalar.add(Constants.DB_Idx, tx.fromIdx), valStatesId]
            ]);
        }

        if (op2=="INSERT") {
            const newValue = utils.hashState(newState2);

            const res = await this.exitTree.insert(tx.fromIdx, newValue);
            if (res.found) {
                throw new Error("Invalid Exit account");
            }
            let siblings = res.siblings;
            while (siblings.length<this.nLevels+1) siblings.push(Scalar.e(0));

            // State 1
            this.input.ax2[i]= 0x1234;      // It should not matter
            this.input.ay2[i]= 0x1234;      // It should not matter
            this.input.amount2[i]= 0;  // Must be 0 to signal is an insert.
            this.input.nonce2[i]= 0x1234;   // It should not matter
            this.input.ethAddr2[i]= this.input.fromEthAddr[i]; // In the onChain TX this must match
            this.input.siblings2[i] = siblings;
            this.input.isOld0_2[i]= res.isOld0 ? 1 : 0;
            this.input.oldKey2[i]= res.isOld0 ? 0 : res.oldKey;
            this.input.oldValue2[i]= res.isOld0 ? 0 : res.oldValue;

            const newValueId = poseidonHash([newValue, tx.fromIdx]);
            await this.dbExit.multiIns([[newValueId, utils.state2array(newState2)]]);

        } else if (op2=="UPDATE") {
            if (isExit) {
                const newValue = utils.hashState(newState2);

                const res = await this.exitTree.update(tx.fromIdx, newValue);
                let siblings = res.siblings;
                while (siblings.length<this.nLevels+1) siblings.push(Scalar.e(0));

                // State 2
                //It should not matter what the Tx have, because we get the input from the oldState
                this.input.ax2[i]= Scalar.fromString(oldState2.ax, 16);
                this.input.ay2[i]= Scalar.fromString(oldState2.ay, 16);
                this.input.amount2[i]= oldState2.amount;
                this.input.nonce2[i]= oldState2.nonce; 
                this.input.ethAddr2[i]= Scalar.fromString(oldState2.ethAddress, 16);


                this.input.siblings2[i] = siblings;
                this.input.isOld0_2[i]= 0;
                this.input.oldKey2[i]= 0x1234;      // It should not matter
                this.input.oldValue2[i]= 0x1234;    // It should not matter

                const newValueId = poseidonHash([newValue, tx.fromIdx]);
                const oldValueId = poseidonHash([resFindExit.foundValue, tx.fromIdx]);
                await this.dbExit.multiDel([oldValueId]);
                await this.dbExit.multiIns([[newValueId, utils.state2array(newState2)]]);
            } else {
                const newValue = utils.hashState(newState2);

                const res = await this.stateTree.update(tx.toIdx, newValue);
                let siblings = res.siblings;
                while (siblings.length<this.nLevels+1) siblings.push(Scalar.e(0));

                // State 2
                //It should not matter what the Tx have, because we get the input from the oldState
                this.input.ax2[i]= Scalar.fromString(oldState2.ax, 16);
                this.input.ay2[i]= Scalar.fromString(oldState2.ay, 16);
                this.input.amount2[i]= oldState2.amount;
                this.input.nonce2[i]= oldState2.nonce;
                this.input.ethAddr2[i]= Scalar.fromString(oldState2.ethAddress, 16);


                this.input.siblings2[i] = siblings;
                this.input.isOld0_2[i]= 0;
                this.input.oldKey2[i]= 0x1234;      // It should not matter
                this.input.oldValue2[i]= 0x1234;    // It should not matter

                // get array of states saved by batch
                const lastIdStates = await this.dbState.get(Scalar.add(Constants.DB_Idx, tx.toIdx));
                // add last batch number
                let valStatesId;
                if (!lastIdStates) valStatesId = [];
                else valStatesId = [...lastIdStates];
                if (!valStatesId.includes(this.newBatchNumberDb)) valStatesId.push(this.newBatchNumberDb);

                // new state for idx
                const newValueId = poseidonHash([newValue, tx.toIdx]);
                
                // new entry according idx and batchNumber
                const keyIdBatch = poseidonHash([tx.toIdx, this.newBatchNumberDb]);
               
                await this.dbState.multiIns([
                    [newValueId, utils.state2array(newState2)],
                    [keyIdBatch, newValueId],
                    [Scalar.add(Constants.DB_Idx, tx.toIdx), valStatesId]
                ]);
            }
        } else if (op2=="NOP") {
            // State 2
            this.input.ax2[i]= 0;
            this.input.ay2[i]= 0;
            this.input.amount2[i]= 0;
            this.input.nonce2[i]= 0;
            this.input.ethAddr2[i]= 0;
            this.input.siblings2[i] = [];
            for (let j=0; j<this.nLevels+1; j++) {
                this.input.siblings2[i][j]= 0;
            }
            this.input.isOld0_2[i]= 0;
            this.input.oldKey2[i]= 0;
            this.input.oldValue2[i]= 0;
        }

        if (i<this.maxNTx-1) {
            this.input.imStateRoot[i] = this.stateTree.root;
            this.input.imExitRoot[i] = this.exitTree.root;
            const lastHash = i == 0 ? 0: this.input.imOnChainHash[i-1];
            if (tx.onChain) {
                const hash = poseidon.createHash(6, 8, 57);

                const {compressed, sign } = utils.toCompressed(
                    this.input.fromAx[i], this.input.fromAy[i]);
                
                let entry1 = Scalar.e(0);
                entry1 = Scalar.add(entry1, this.input.fromEthAddr[i]);
                entry1 = Scalar.add(entry1, Scalar.shl(sign, 160));


                this.input.imOnChainHash[i] = hash([
                    compressed,
                    entry1,
                    this.input.toEthAddr[i],
                    lastHash,
                    this.input.txData[i],
                    this.input.loadAmount[i],
                ]);
                this.input.imOnChain[i] = Scalar.e(1);
            } else {
                this.input.imOnChainHash[i] = lastHash;
                this.input.imOnChain[i] = 0;
            }
        }

        // Database numBatch - Idx
        const keyNumBatchIdx = Scalar.add(Constants.DB_NumBatch_Idx, this.newBatchNumberDb);
        let lastBatchIdx = await this.dbState.get(keyNumBatchIdx);

        // get last state and add last batch number
        let newBatchIdx;
        if (!lastBatchIdx) lastBatchIdx = [];
        newBatchIdx = [...lastBatchIdx];

        if (op1 == "INSERT" || op1 == "UPDATE") {
            if (!newBatchIdx.includes(tx.fromIdx)) newBatchIdx.push(tx.fromIdx); 
        }

        if (op2 == "UPDATE" && !isExit) {
            if (!newBatchIdx.includes(tx.toIdx)) newBatchIdx.push(tx.toIdx);
        }
        await this.dbState.multiIns([
            [keyNumBatchIdx, newBatchIdx],
        ]);

        // Database NumBatch
        if (op1 == "INSERT") {
            // AxAy
            const hashAxAy = poseidonHash([this.input.fromAx[i], this.input.fromAy[i]]);
            const keyNumBatchAxAy = Scalar.add(Constants.DB_NumBatch_AxAy, this.newBatchNumberDb);
            let oldStatesAxAy = await this.dbState.get(keyNumBatchAxAy);
            let newStatesAxAy;
            if (!oldStatesAxAy) oldStatesAxAy = [];
            newStatesAxAy = [...oldStatesAxAy];
            if (!newStatesAxAy.includes(hashAxAy)) {
                newStatesAxAy.push(hashAxAy);
                await this.dbState.multiIns([
                    [hashAxAy, [this.input.fromAx[i], this.input.fromAy[i]]],
                    [keyNumBatchAxAy, newStatesAxAy],
                ]);
            }
            // EthAddress
            const ethAddr =  this.input.fromEthAddr[i];
            const keyNumBatchEthAddr = Scalar.add(Constants.DB_NumBatch_EthAddr, this.newBatchNumberDb);
            let oldStatesEthAddr = await this.dbState.get(keyNumBatchEthAddr);
            let newStatesEthAddr;
            if (!oldStatesEthAddr) oldStatesEthAddr = [];
            newStatesEthAddr = [...oldStatesEthAddr];
            if (!newStatesEthAddr.includes(ethAddr)) {
                newStatesEthAddr.push(ethAddr);
                await this.dbState.multiIns([
                    [keyNumBatchEthAddr, newStatesEthAddr],
                ]);
            }
        }  
    }

    /**
     * Return the corresponding identifier
     * @param {Object} tx - transaction object
     * @param {Scalar} from - From Idx
     * @param {Scalar} to - To IdX
     */
    _addIdx(tx, from, to){  
        // From
        if (!from) tx.fromIdx = this.finalIdx + 1;
        else tx.fromIdx = from;
        // To
        tx.toIdx = to;
    }

    /**
     * Return the hash of the coin and babyjub public key
     * @param {String} coin - Coin identifier
     * @param {String} ethAddr - Ethereum Address
     * @returns {Scalar} Resulting poseidon hash
     */
    _uniqueAccount(coin, ethAddr){
        const h = poseidon.createHash(6, 8, 57);
        return h([Scalar.e(coin), Scalar.fromString(ethAddr, 16)]);
    }

    /**
     * Add fee of an especific coin to the feeTotals object
     * @param {String} coin - Coin identifier
     * @param {String} fee2Charge - Fee to add
     */
    _accumulateFees(coin, fee2Charge){
        // find coin index
        const indexCoin = this.feePlanCoins.indexOf(coin);
        
        if (indexCoin === -1) return;
        this.feeTotals[indexCoin] = Scalar.add(this.feeTotals[indexCoin], fee2Charge);
    }

    /**
     * Encode all the fees in feeTotals into a single Scalar
     * @return {Scalar} Resulting Scalar
     */
    _getFeeTotal() {
        let res = [];
        let tmp = Scalar.e(0);
        let counter = 0;
        for (let i = 0; i < this.feeTotals.length; i++) {
            tmp = Scalar.add(tmp, Scalar.shl(Scalar.e(utils.floorFix2Float(this.feeTotals[i])), 16*i));
            if ((i+1) % 16 == 0){
                res[counter] = tmp;
                tmp = Scalar.e(0);
                counter += 1;
            }
        }
        return res;
    }

    /**
     * Encode all the coins in feePlanCoins into a single Scalar
     * @return {Scalar} Resulting Scalar
     */
    _buildFeePlanCoins() {
        const res = [];
        let counter = 0;
        let tmp = Scalar.e(0);
        for (let i = 0; i < this.feePlanCoins.length; i++) {
            tmp = Scalar.add(tmp, Scalar.shl(Scalar.e(this.feePlanCoins[i]), 16*i));
            if ((i+1) % 16 == 0){
                res[counter] = tmp;
                tmp = Scalar.e(0);
                counter += 1;
            }
        }
        return res;
    }

    /**
     * Build the batch, add all the transactions and calculate the inputs for the circuit
     */
    async build() {

        this.input = {
            initialIdx: this.finalIdx,
            oldStRoot: this.stateTree.root,
            feePlanCoins: this._buildFeePlanCoins(),
            feeTotals: Scalar.e(0),
            pubEthAddress: this.beneficiaryAddress,

            imStateRoot: [],
            imExitRoot: [],
            imOnChainHash: [],
            imOnChain: [],

            txData: [],
            fromIdx: [],
            toIdx: [],
            toAx: [],
            toAy: [],
            toEthAddr: [],
            rqTxData: [],
            s: [],
            r8x: [],
            r8y: [],

            // on-chain
            loadAmount: [],
            fromEthAddr: [],
            fromAx: [],
            fromAy: [],

            ax1: [],
            ay1: [],
            amount1: [],
            nonce1: [],
            ethAddr1: [],
            siblings1: [],
            isOld0_1: [],
            oldKey1: [],
            oldValue1: [],

            ax2: [],
            ay2: [],
            amount2: [],
            nonce2: [],
            ethAddr2: [],
            siblings2: [],
            isOld0_2: [],
            oldKey2: [],
            oldValue2: [],

            // benefiacry address
            privEthAddress: this.beneficiaryAddress,
        };

        if (this.builded) throw new Error("Batch already builded");

        // Add on-chain Tx
        for (let i=0; i<this.onChainTxs.length; i++) {
            await this._addTx(this.onChainTxs[i]);
        }

        // Add Nop Tx
        for (let i=0; i<this.maxNTx - this.offChainTxs.length - this.onChainTxs.length; i++) {
            this._addNopTx();
        }

        // Add off-chain Tx
        for (let i=0; i<this.offChainTxs.length; i++) {
            await this._addTx(this.offChainTxs[i]);
        }

        this.input.feeTotals = this._getFeeTotal();
        
        this.builded = true;
    }

    /**
     * Return the circuit input
     * @return {Object} Circuit input
     */
    getInput() {
        if (!this.builded) throw new Error("Batch must first be builded");
        return this.input;
    }

    /**
     * Return the last leaf identifier before the batch is builded
     * @return {Scalar} Identifier
     */
    getInitIdx() {
        if (!this.builded) throw new Error("Batch must first be builded");
        return this.input.initialIdx;
    }

    /**
     * Return the last leaf identifier after the batch is builded
     * @return {Scalar} Identifier
     */
    getFinalIdx() {
        if (!this.builded) throw new Error("Batch must first be builded");
        return this.finalIdx;
    }
    
    /**
     * Return the last state root before the batch is builded
     * @return {Scalar} State root
     */
    getOldStateRoot() {
        if (!this.builded) throw new Error("Batch must first be builded");
        return this.input.oldStRoot;
    }
        
    /**
     * Return the feePlanCoins object
     * @return {Object} FeePlanCoins object
     */
    getFeePlanCoins() {
        if (!this.builded) throw new Error("Batch must first be builded");
        return this.input.feePlanCoins;
    }
        
    /**
     * Return a Scalar wich contains encoded feesPlanCoins
     * @return {Scalar} Resulting Scalar
     */
    getFeeTotal() {
        if (!this.builded) throw new Error("Batch must first be builded");
        return this._getFeeTotal();
    }

    /**
     * Return the last state root after the batch is builded
     * @return {Scalar} State root
     */
    getNewStateRoot() {
        if (!this.builded) throw new Error("Batch must first be builded");
        return this.stateTree.root;
    }

    /**
     * Return the last exit root after the batch is builded
     * @return {Scalar} Exit root
     */
    getNewExitRoot() {
        if (!this.builded) throw new Error("Batch must first be builded");
        return this.exitTree.root;
    }

    /**
     * Return the beneficiary address
     * @return {String} Ethereum address
     */
    getBeneficiaryAddress(){
        if (!this.builded) throw new Error("Batch must first be builded");
        return this.input.pubEthAddress;
    }

    /**
     * Return the on-chain hash
     * @return {Scalar} Resulting poseidon hash
     */
    getOnChainHash() {
        if (!this.builded) throw new Error("Batch must first be builded");
        const lastHash = this.input.imOnChainHash[this.maxNTx-2];
        let res;

        // check last transaction is on-chain
        const { onChain } = utils.decodeTxData(this.input.txData[this.maxNTx-1]);
        if (onChain) {
            const hash = poseidon.createHash(6, 8, 57);

            const {entry0, sign } = utils.toCompressed(
                this.input.fromAx[this.maxNTx-1], this.input.fromAy[this.maxNTx-1]);
            
            let entry1 = Scalar.e(0);
            entry1 = Scalar.add(entry1, this.fromEthAddr);
            entry1 = Scalar.add(entry1, Scalar.shl(sign, 160));

            res = hash([
                entry0,
                entry1,
                this.input.toEthAddr[this.maxNTx-1],
                lastHash,
                this.input.txData[this.maxNTx-1],
                this.input.loadAmount[this.maxNTx-1],
            ]);

        } else {
            res = Scalar.e(lastHash);
        }
        return res;
    }
    
    /**
     * Return the on-chain hash before the batch is builded
     * @return {Scalar} Resulting poseidon hash
     */
    getTmpOnChainHash(){
        let onChainHash = Scalar.e(0);

        for (let tx of this.onChainTxs){
            const dataOnChain = poseidonHash([
                Scalar.fromString(tx.fromAx, 16),
                Scalar.fromString(tx.fromAy, 16),
                Scalar.fromString(tx.toEthAddr, 16),
                Scalar.fromString(tx.toAx, 16),
                Scalar.fromString(tx.toAy, 16)
            ]);
        
            onChainHash = poseidonHash([
                onChainHash,
                utils.buildTxData(tx),
                Scalar.e(tx.loadAmount),
                dataOnChain,
                Scalar.fromString(tx.fromEthAddr, 16),
            ]);
        }
        return onChainHash;
    }

    /**
     * Return the encoded data available
     * @return {String} Encoded data available
     */
    getDataAvailable() {
        if (!this.builded) throw new Error("Batch must first be builded");

        const indexBits = (this.nLevels/8) * 8;
        const amountBits = 16;
        const feeBits = 4;

        let finalStr = "";

        for (let i = 0; i < this.offChainTxs.length; i++){
            const tx = this.offChainTxs[i];
            let res = Scalar.e(0);
            res = Scalar.add(res, tx.fee);
            res = Scalar.add(res, Scalar.shl(utils.fix2float(tx.amount), feeBits));
            res = Scalar.add(res, Scalar.shl(tx.toIdx, amountBits + feeBits));
            res = Scalar.add(res, Scalar.shl(tx.fromIdx, indexBits + amountBits + feeBits));

            finalStr = finalStr + utils.padZeros(res.toString("16"), (indexBits * 2 + amountBits + feeBits) / 4);
        }

        return  finalStr;
    }

    /**
     * Return the encoded data available ready to send to the rollup SC
     * @return {String} Encoded data available
     */
    getDataAvailableSM() {
        // Buffer must have an integer number of bytes
        // Padding 4 bits at the beginning if odd number of Txs off-chain 
        if (this.offChainTxs.length % 2 == 0) { 
            return `0x${this.getDataAvailable()}`;
        } else {
            return `0x0${this.getDataAvailable()}`;
        }
    }

    /**
     * Return the off chain hash
     * @return {Scalar} Resulting poseidon hash
     */
    getOffChainHash() {
        if (!this.builded) throw new Error("Batch must first be builded");

        const txSizeBits = (this.nLevels/8)*2*8 + 2*8 + 4;
        
        const dataOffChainTx = this.getDataAvailable();
        const dataNopTx = utils.padZeros("", (this.maxNTx - this.offChainTxs.length) * (txSizeBits / 4));

        let b  = dataNopTx.concat(dataOffChainTx);

        // Buffer must have an integer number of bytes
        // padding 4 bits at the beginning if odd number of maxTxs    
        if (this.maxNTx % 2 != 0) {
            b = "0".concat(b);
        }

        const r = Scalar.e("21888242871839275222246405745257275088548364400416034343698204186575808495617");
        const hash = crypto.createHash("sha256")
            .update(b, "hex")
            .digest("hex");
        const h = Scalar.mod(Scalar.fromString(hash, 16), r);
        return h;
    }

    /**
     * Return the states that have been change with the on chain transactions
     * @return {Object} Resulting temporally state
     */
    async getTmpStateOnChain() {
        if (!this.builded) throw new Error("Batch must first be builded");

        const tmpState = {};
        const idxChanges = {};

        for (let i=0; i<this.onChainTxs.length; i++) {
            const fromIdx = this.onChainTxs[i].fromIdx;
            const toIdx = this.onChainTxs[i].toIdx;
            if (idxChanges[fromIdx] == undefined && fromIdx != 0) 
                idxChanges[fromIdx] = fromIdx;
            if (idxChanges[toIdx] == undefined && toIdx != 0) 
                idxChanges[toIdx] = toIdx;
        }

        for (const idx of Object.keys(idxChanges)) {
            const resFind = await this.stateTree.find(idx);
            const foundValueId = poseidonHash([resFind.foundValue, idx]);
            const st = utils.array2state(await this.dbState.get(foundValueId));
            st.idx = Number(idx);
            tmpState[idx] = st;
        }   

        return tmpState;
    }

    /**
     * Add a transaction to the batchbuilder
     * @param {Object} tx - Transaction object
     */
    addTx(tx) {
        if (this.builded) throw new Error("Batch already builded");
        if (this.onChainTxs.length + this.offChainTxs.length >= this.maxNTx) {
            throw Error("Too many TX per batch");
        }
        if (tx.onChain) {
            this.onChainTxs.push(tx);
        } else {
            this.offChainTxs.push(tx);
        }
    }

    /**
     * Add a deposit off-chain transaction
     * @param {Object} tx - Transaction object
     */
    addDepositOffChain(tx) {
        if (this.builded) throw new Error("Batch already builded");
        this.depOffChainTxs.push(tx);
    }

    /**
     * Get the deposit offchain data
     * @returns {Buffer} Encoded deposit transactions 
     */
    getDepOffChainData(){
        if (!this.builded) throw new Error("Batch must first be builded");
        return utils.encodeDepositOffchain(this.depOffChainTxs);
    }

    /**
     * Add a coin identifier to the batchbuilder
     * @param {Scalar} coin - Coin identifier
     */
    addCoin(coin) {
        if (this.nCoins >= 64) {
            throw new Error("Maximum 64 coins per batch");
        }
        if (((this.nCoins + 1) % 16 == 0) && (coin >= 1<<13)) {
            throw new Error("Coin 16 must be less than 2^13");
        }
        this.feePlanCoins[this.nCoins] = coin;
        this.nCoins = this.nCoins + 1;
    }

    /**
     * Add a beneficiary address to the batchbuilder
     * @param {String} beneficiaryAddress - Ethereum address
     */
    addBeneficiaryAddress(beneficiaryAddress) {
        this.beneficiaryAddress = Scalar.fromString(beneficiaryAddress, 16);
    }
};