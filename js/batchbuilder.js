
const SMT = require("circomlib").SMT;
const SMTTmpDb = require("./smttmpdb");
const utils = require("./utils");
const assert = require("assert");
const crypto = require("crypto");
const bigInt = require("snarkjs").bigInt;
const poseidon = require("circomlib").poseidon;
const Constants = require("./constants");

module.exports = class BatchBuilder {
    constructor(rollupDB, batchNumber, root, maxNTx, nLevels) {
        assert((nLevels % 8) == 0);
        this.rollupDB = rollupDB;
        this.batchNumber = batchNumber;
        this.maxNTx = maxNTx || 4;
        this.nLevels = nLevels;
        this.offChainTxs = [];
        this.onChainTxs = [];
        this.dbState = new SMTTmpDb(rollupDB.db);
        this.stateTree = new SMT(this.dbState, root);
        this.dbExit = new SMTTmpDb(rollupDB.db);
        this.exitTree = new SMT(this.dbExit, bigInt(0));
        this.feePlan = Array(16).fill([0, bigInt(0)]);
        this.counters = Array(16).fill(0);
        this.nCoins = 0;
    }

    _addNopTx() {
        const i = this.input.txData.length;
        this.input.txData[i] = utils.buildTxData({
            fromIdx: 0,
            toIdx: 0,
            amount: 0,
            coin: 0,
            nonce: 0,
            userFee: 0,
            rqOffset: 0,
            inChain: 0,
            newAccount: 0
        });
        this.input.rqTxData[i]= 0;
        this.input.s[i]= 0;
        this.input.r8x[i]= 0;
        this.input.r8y[i]= 0;
        this.input.loadAmount[i]= 0;
        this.input.ethAddr[i]= 0;
        this.input.ax[i]= 0;
        this.input.ay[i]= 0;
        this.input.step[i] = 0;

        // State 1
        this.input.ax1[i]= 0;
        this.input.ay1[i]= 0;
        this.input.amount1[i]= 0;
        this.input.nonce1[i]= 0;
        this.input.ethAddr1[i]= 0;
        this.input.siblings1[i] = [];
        for (let j=0; j<this.nLevels+1; j++) {
            this.input.siblings1[i][j]= 0;
        }
        this.input.isOld0_1[i]= 0;
        this.input.oldKey1[i]= 0;
        this.input.oldValue1[i]= 0;

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

    getOperatorFee(coin, step) {
        let s = step || 0;
        for (let i=0; i<this.feePlan.length; i++) {
            if (this.feePlan[i][0] == coin) {
                if (s==0) {
                    return this.feePlan[i][1];
                } else {
                    s--;
                }
            }
        }
        return bigInt(0);
    }

    async _addTx(tx) {
        const i = this.input.txData.length;

        const amountF = utils.fix2float(tx.amount || 0);
        const amount = utils.float2fix(amountF);

        let loadAmount = bigInt(tx.loadAmount || 0);
        if ((!tx.onChain)&&(loadAmount.greater(bigInt(0)))) {
            throw new Error("Load ammount must be 0 for offChainTxs");
        }

        let oldState1;
        let oldState2;
        let op1 = "NOP";
        let op2 = "INSERT";
        let isExit;
        let newAccount = 0;

        const resFind1 = await this.stateTree.find(tx.fromIdx);
        if (resFind1.found) {
            oldState1 = utils.array2state(await this.dbState.get(resFind1.foundValue));
            op1 = "UPDATE";
        } else {
            oldState1 = {
                amount: bigInt(0),
                coin: tx.coin,
                nonce: 0,
                ax: tx.ax,
                ay: tx.ay,
                ethAddress: tx.ethAddress
            };
            op1 = "INSERT";
            newAccount = 1;
        }

        let resFind2;
        let resFindExit;
        if (tx.toIdx) {
            resFind2 = await this.stateTree.find(tx.toIdx);
            if (!resFind2.found) {
                throw new Error("trying to send to a wrong address");
            }
            oldState2 = utils.array2state(await this.dbState.get(resFind2.foundValue));
            isExit = false;
            op2 = "UPDATE";
        } else {
            resFindExit = await this.exitTree.find(tx.toIdx || 0);
            if (resFindExit.found) {
                oldState2 = utils.array2state(await this.dbExit.get(resFindExit.foundValue));
                op2 = "UPDATE";
            } else {
                oldState2 = {
                    amount: bigInt(0),
                    coin: tx.coin,
                    nonce: 0,
                    ax: tx.ax,
                    ay: tx.ay,
                    ethAddress: tx.ethAddress
                };
                op2 = "INSERT";
            }
            isExit = true;
        }

        let operatorFee;
        if (tx.onChain) {
            operatorFee = bigInt(0);
        } else {
            operatorFee = this.getOperatorFee(tx.coin, tx.step);
        }

        let effectiveAmount = amount;
        const underFlowOk = (oldState1.amount.add(loadAmount).sub(amount).sub(operatorFee).greaterOrEquals(bigInt(0)));
        const overflowOk = (oldState2.amount.add(amount).lesser(bigInt(1).shl(128)));
        const txOk = underFlowOk && overflowOk;
        if (!txOk) {
            if (tx.onChain) {
                effectiveAmount = bigInt(0);
            } else {
                let errStr = "Error ";
                if (!underFlowOk) errStr = "underflow";
                if (!overflowOk) errStr = "overflow";
                throw new Error(errStr);
            }
        }

        if (effectiveAmount.equals(bigInt(0))) op2="NOP";

        this.input.txData[i] = utils.buildTxData(Object.assign({newAccount: newAccount}, tx));
        this.input.rqTxData[i]= tx.rqTxData || 0;
        this.input.s[i]= tx.s || 0;
        this.input.r8x[i]= tx.r8x || 0;
        this.input.r8y[i]= tx.r8y || 0;
        this.input.loadAmount[i]= loadAmount;
        this.input.ethAddr[i]= bigInt(oldState1.ethAddress);
        this.input.ax[i]= bigInt("0x" +oldState1.ax);
        this.input.ay[i]= bigInt("0x" +oldState1.ay);

        this.input.step[i] = ((!tx.inChain) && tx.step) ? 1 : 0;

        const newState1 = Object.assign({}, oldState1);
        newState1.amount = oldState1.amount.add(loadAmount).sub(effectiveAmount).sub(operatorFee);
        if (!tx.onChain) {
            newState1.nonce++;
            this._incCounter(tx.coin, this.input.step[i]);
        }
        const newState2 = Object.assign({}, oldState2);
        newState2.amount = oldState2.amount.add(effectiveAmount);

        if (op1=="INSERT") {

            const newValue = utils.hashState(newState1);

            const res = await this.stateTree.insert(tx.fromIdx, newValue);
            let siblings = res.siblings;
            while (siblings.length<this.nLevels+1) siblings.push(bigInt(0));

            // State 1
            this.input.ax1[i]= 0x1234;      // It should not matter
            this.input.ay1[i]= 0x1234;      // It should not matter
            this.input.amount1[i]= 0x1234;  // It should not matter
            this.input.nonce1[i]= 0x1234;   // It should not matter
            this.input.ethAddr1[i]= this.input.ethAddr[i]; // In the onChain TX this must match
            this.input.siblings1[i] = siblings;
            this.input.isOld0_1[i]= res.isOld0 ? 1 : 0;
            this.input.oldKey1[i]= res.isOld0 ? 0 : res.oldKey;
            this.input.oldValue1[i]= res.isOld0 ? 0 : res.oldValue;

            const keyAxAy = Constants.DB_AxAy.add(this.input.ax[i]).add(this.input.ay[i]);
            const keyEthAddr = Constants.DB_EthAddr.add(this.input.ethAddr[i]);
            const lastVals = await this.dbState.multiGet([
                keyAxAy,
                keyEthAddr
            ]);

            if (!lastVals[0]) lastVals[0] = [];
            lastVals[0].push(bigInt(tx.fromIdx));

            if (!lastVals[1]) lastVals[1] = [];
            lastVals[1].push(bigInt(tx.fromIdx));

            await this.dbState.multiIns([
                [newValue, utils.state2array(newState1)],
                [Constants.DB_Idx.add(bigInt(tx.fromIdx)), newValue],
                [keyAxAy, lastVals[0]],
                [keyEthAddr, lastVals[1]]
            ]);

        } else if (op1 == "UPDATE") {
            const newValue = utils.hashState(newState1);

            const res = await this.stateTree.update(tx.fromIdx, newValue);
            let siblings = res.siblings;
            while (siblings.length<this.nLevels+1) siblings.push(bigInt(0));

            // State 1
            this.input.ax1[i]= bigInt("0x" + oldState1.ax);      // It should not matter
            this.input.ay1[i]= bigInt("0x" + oldState1.ay);      // It should not matter
            this.input.amount1[i]= oldState1.amount;  // It should not matter
            this.input.nonce1[i]= oldState1.nonce;   // It should not matter
            this.input.ethAddr1[i]= bigInt(oldState1.ethAddress); // It should not matter


            this.input.siblings1[i] = siblings;
            this.input.isOld0_1[i]= 0;
            this.input.oldKey1[i]= 0x1234;      // It should not matter
            this.input.oldValue1[i]= 0x1234;    // It should not matter

            await this.dbState.multiDel([resFind1.foundValue]);
            await this.dbState.multiIns([
                [newValue, utils.state2array(newState1)],
                [Constants.DB_Idx.add(bigInt(tx.fromIdx)), newValue]
            ]);
        }

        if (op2=="INSERT") {
            const newValue = utils.hashState(newState2);

            const res = await this.exitTree.insert(tx.fromIdx, newValue);
            if (res.found) {
                throw new Error("Invalid Exit account");
            }
            let siblings = res.siblings;
            while (siblings.length<this.nLevels+1) siblings.push(bigInt(0));

            // State 1
            this.input.ax2[i]= 0x1234;      // It should not matter
            this.input.ay2[i]= 0x1234;      // It should not matter
            this.input.amount2[i]= 0;  // Must be 0 to signal is an insert.
            this.input.nonce2[i]= 0x1234;   // It should not matter
            this.input.ethAddr2[i]= this.input.ethAddr[i]; // In the onChain TX this must match
            this.input.siblings2[i] = siblings;
            this.input.isOld0_2[i]= res.isOld0 ? 1 : 0;
            this.input.oldKey2[i]= res.isOld0 ? 0 : res.oldKey;
            this.input.oldValue2[i]= res.isOld0 ? 0 : res.oldValue;

            await this.dbExit.multiIns([[newValue, utils.state2array(newState2)]]);

        } else if (op2=="UPDATE") {
            if (isExit) {
                const newValue = utils.hashState(newState2);

                const res = await this.exitTree.update(tx.fromIdx, newValue);
                let siblings = res.siblings;
                while (siblings.length<this.nLevels+1) siblings.push(bigInt(0));

                // State 2
                this.input.ax2[i]= bigInt("0x" + oldState2.ax);      // It should not matter
                this.input.ay2[i]= bigInt("0x" + oldState2.ay);      // It should not matter
                this.input.amount2[i]= oldState2.amount;  // It should not matter
                this.input.nonce2[i]= oldState2.nonce;   // It should not matter
                this.input.ethAddr2[i]= bigInt(oldState2.ethAddress); // It should not matter


                this.input.siblings2[i] = siblings;
                this.input.isOld0_2[i]= 0;
                this.input.oldKey2[i]= 0x1234;      // It should not matter
                this.input.oldValue2[i]= 0x1234;    // It should not matter

                await this.dbExit.multiDel([resFindExit.foundValue]);
                await this.dbExit.multiIns([[newValue, utils.state2array(newState2)]]);
            } else {
                const newValue = utils.hashState(newState2);

                const res = await this.stateTree.update(tx.toIdx, newValue);
                let siblings = res.siblings;
                while (siblings.length<this.nLevels+1) siblings.push(bigInt(0));

                // State 2
                this.input.ax2[i]= bigInt("0x" + oldState2.ax);      // It should not matter
                this.input.ay2[i]= bigInt("0x" + oldState2.ay);      // It should not matter
                this.input.amount2[i]= oldState2.amount;  // It should not matter
                this.input.nonce2[i]= oldState2.nonce;   // It should not matter
                this.input.ethAddr2[i]= bigInt(oldState2.ethAddress); // It should not matter


                this.input.siblings2[i] = siblings;
                this.input.isOld0_2[i]= 0;
                this.input.oldKey2[i]= 0x1234;      // It should not matter
                this.input.oldValue2[i]= 0x1234;    // It should not matter

                await this.dbState.multiDel([resFind2.foundValue]);
                await this.dbState.multiIns([
                    [newValue, utils.state2array(newState2)],
                    [Constants.DB_Idx.add(bigInt(tx.toIdx)), newValue]
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
    }

    _incCounter(coin, step) {
        const getIdx = (coin, step) => {
            let s = step;
            for (let i=0; i<this.feePlan.length; i++) {
                if (this.feePlan[i][0] == coin) {
                    if (s==0) {
                        return i;
                    } else {
                        s--;
                    }
                }
            }
            return -1;
        };
        const idx = getIdx(coin, step);
        if (idx <0) return;
        if (this.counters[idx]+1 >= ( (idx < 15) ? (1<<13) : (1<<16) ) ) {
            throw new Error("Maximum TXs per coin in a batch reached");
        }
        this.counters[idx]++;
    }

    _buildFeePlan() {
        const res = {
            feePlanCoins: bigInt(0),
            feePlanFees: bigInt(0)
        };
        for (let i=0; i<this.feePlan.length; i++) {
            const feeF = utils.fix2float(this.feePlan[i][1]);
            res.feePlanCoins = res.feePlanCoins.add( bigInt(this.feePlan[i][0]).shl(16*i) );
            res.feePlanFees = res.feePlanFees.add( bigInt(feeF).shl(16*i) );
        }
        return res;
    }

    optimizeSteps() {
        for (let i=0; i<this.offChainTxs.length; i++) {
            const tx = this.offChainTxs[i];
            tx.step=0;
            while (this.getOperatorFee(tx.coin, tx.step).greater(tx.userFee)) tx.step++;
        }
        for (let i=0; i<this.onChainTxs.length; i++) {
            const tx = this.onChainTxs[i];
            tx.step=0;
        }
    }

    async build() {

        const {feePlanCoins, feePlanFees} = this._buildFeePlan();

        this.input = {
            oldStRoot: this.stateTree.root,
            feePlanCoins: feePlanCoins,
            feePlanFees: feePlanFees,
            txData: [],
            rqTxData: [],
            s: [],
            r8x: [],
            r8y: [],
            loadAmount: [],
            ethAddr: [],
            ax: [],
            ay: [],
            step: [],

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
        };

        if (this.builded) throw new Error("Batch already builded");
        for (let i=0; i<this.offChainTxs.length; i++) {
            await this._addTx(this.offChainTxs[i]);
        }
        for (let i=0; i<this.maxNTx - this.offChainTxs.length - this.onChainTxs.length; i++) {
            this._addNopTx();
        }
        for (let i=0; i<this.onChainTxs.length; i++) {
            await this._addTx(this.onChainTxs[i]);
        }
        this.builded=true;
    }

    getInput() {
        if (!this.builded) throw new Error("Batch must first be builded");
        return this.input;
    }

    getNewStateRoot() {
        if (!this.builded) throw new Error("Batch must first be builded");
        return this.stateTree.root;
    }

    getNewExitRoot() {
        if (!this.builded) throw new Error("Batch must first be builded");
        return this.exitTree.root;
    }

    getDataAvailable() {
        if (!this.builded) throw new Error("Batch must first be builded");

        // Fill with initial steps padded to the byte with zeros
        const bytes = Array( Math.ceil(this.maxNTx/8) ).fill(0);
        for (let i=0; i<this.offChainTxs.length; i++) {
            const tx = this.offChainTxs[i];
            if (tx.step) bytes[ Math.floor(i/8)] |= (0x80 >> (i%8));
            pushInt(tx.fromIdx, this.nLevels/8);
            pushInt(tx.toIdx, this.nLevels/8);
            pushInt(utils.fix2float(tx.amount), 2);
        }
        return Buffer.from(bytes);

        function pushInt(n, size) {
            for (let i=0; i<size; i++) {
                bytes.push((n >> ((size-1-i)*8))&0xFF);
            }
        }
    }

    getOnChainHash() {
        if (!this.builded) throw new Error("Batch must first be builded");
        const hash = poseidon.createHash(6, 8, 57);

        const firsOnChainTx = this.maxNTx - this.onChainTxs.length;
        let h = bigInt(0);
        for (let i=0; i<this.onChainTxs.length; i++) {
            h = hash([
                h,
                this.input.txData[firsOnChainTx+i],
                this.input.loadAmount[firsOnChainTx+i],
                this.input.ethAddr[firsOnChainTx+i],
                this.input.ax[firsOnChainTx+i],
                this.input.ay[firsOnChainTx+i],
            ]);
        }
        return h;
    }

    getOffChainHash() {
        if (!this.builded) throw new Error("Batch must first be builded");
        const txSize = (this.nLevels/8)*2+2;
        const data = this.getDataAvailable();
        const post = Buffer.alloc((this.maxNTx - (this.offChainTxs.length))*txSize);

        const b  = Buffer.concat([data, post]);

        const r = bigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617");
        const hash = crypto.createHash("sha256")
            .update(b)
            .digest("hex");
        const h = bigInt("0x" + hash).mod(r);
        return h;
    }

    getCountersOut() {
        if (!this.builded) throw new Error("Batch must first be builded");
        let res = bigInt(0);
        for (let i=0; i<this.counters.length; i++) {
            res = res.add( bigInt(this.counters[i]).shl(16*i) );
        }
        return res;
    }

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

    addCoin(coin, fee) {
        const roundedFee = utils.float2fix(utils.fix2float(fee));
        if (roundedFee.isZero()) return;

        if (this.nCoins >= 16) {
            throw new Error("Maximum 16 coins per batch");
        }
        if ((this.nCoins == 15)&&(coin >= 1<<13)) {
            throw new Error("Coin 16 must be less than 2^13");
        }
        this.feePlan[this.nCoins] = [coin, roundedFee];
        this.nCoins = this.nCoins + 1;
    }
};
