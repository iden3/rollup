
const SMT = require("circomlib").SMT.SMT;
const SMTTmpDb = require("./smttmpdb");
const utils = require("./utils");
const assert = require("assert");
const crypto = require("crypto");
const bigInt = require("snarkjs").bigInt;
const poseidon = require("circomlib").poseidon;

module.exports = class BlockBuilder {
    constructor(currentTree, maxNTx, nLevels) {
        assert((nLevels % 8) == 0);
        this.maxNTx = maxNTx || 4;
        this.nLevels = nLevels;
        this.offChainTxs = [];
        this.onChainTxs = [];
        this.stateTree = new SMT(new SMTTmpDb(currentTree.db), currentTree.root);
        this.input = {
            oldStRoot: currentTree.root,
            feePlanCoins: 0,
            feePlanFees: 0,
            txData: [],
            rqTxHash: [],
            s: [],
            r8x: [],
            r8y: [],
            loadAmount: [],
            ethAddr: [],
            ax: [],
            ay: [],

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
    }

    _addNopTx() {
        const i = this.input.txData.length;
        this.input.txData[i] = utils.buildTxData({
            fromIdx: 0,
            toIdx: 0,
            amount: 0,
            coin: 0,
            nonce: 0,
            maxFee: 0,
            rqOffset: 0,
            inChain: 0,
            newAccount: 0
        });
        this.input.rqTxHash[i]= 0;
        this.input.s[i]= 0;
        this.input.r8x[i]= 0;
        this.input.r8y[i]= 0;
        this.input.loadAmount[i]= 0;
        this.input.ethAddr[i]= 0;
        this.input.ax[i]= 0;
        this.input.ay[i]= 0;

        // State 1
        this.input.ax1[i]= 0;
        this.input.ay1[i]= 0;
        this.input.amount1[i]= 0;
        this.input.nonce1[i]= 0;
        this.input.ethAddr1[i]= 0;
        this.input.siblings1[i] = [];
        for (let j=0; j<8; j++) {
            this.input.siblings1[i][j]= 0;
        }
        this.input.isOld0_1[i]= 0;
        this.input.oldKey1[i]= 0;
        this.input.oldValue1[i]= 0;

        // State 1
        this.input.ax2[i]= 0;
        this.input.ay2[i]= 0;
        this.input.amount2[i]= 0;
        this.input.nonce2[i]= 0;
        this.input.ethAddr2[i]= 0;
        this.input.siblings2[i] = [];
        for (let j=0; j<8; j++) {
            this.input.siblings2[i][j]= 0;
        }
        this.input.isOld0_2[i]= 0;
        this.input.oldKey2[i]= 0;
        this.input.oldValue2[i]= 0;
    }

    async _addOnChainTx(tx) {
        const i = this.input.txData.length;

        const resFind = await this.stateTree.find(tx.fromIdx);

        this.input.txData[i] = utils.buildTxData({
            fromIdx: tx.fromIdx,
            toIdx: tx.toIdx || 0,
            amount: tx.amount || 0,
            coin: tx.coin,
            nonce: tx.nonce || 0,
            maxFee: tx.maxFee  || 0,
            rqOffset: 0,
            inChain: 1,
            newAccount: resFind.found ? 0 : 1
        });
        this.input.rqTxHash[i]= 0;
        this.input.s[i]= 0;
        this.input.r8x[i]= 0;
        this.input.r8y[i]= 0;
        this.input.loadAmount[i]= tx.loadAmount || 0;
        this.input.ethAddr[i]= bigInt(tx.ethAddress);
        this.input.ax[i]= bigInt("0x" + tx.ax);
        this.input.ay[i]= bigInt("0x" + tx.ay);

        if (resFind.found) {
            // TODO load onchain
        } else {
            const newValue = utils.hashState({
                ax: tx.ax,
                ay: tx.ay,
                amount: tx.loadAmount,      // TODO: Substract amount, fee
                nonce: 0,
                coin: tx.coin,
                ethAddress: tx.ethAddress
            });

            const res = await this.stateTree.insert(tx.fromIdx, newValue);
            let siblings = res.siblings;
            while (siblings.length<this.nLevels) siblings.push(bigInt(0));

            // State 1
            this.input.ax1[i]= 0x1234;      // It should not matter
            this.input.ay1[i]= 0x1234;      // It should not matter
            this.input.amount1[i]= 0x1234;  // It should not matter
            this.input.nonce1[i]= 0x1234;   // It should not matter
            this.input.ethAddr1[i]= this.input.ethAddr[i]; // It should not matter
            this.input.siblings1[i] = siblings;
            this.input.isOld0_1[i]= res.isOld0 ? 1 : 0;
            this.input.oldKey1[i]= res.isOld0 ? 0 : res.oldKey;
            this.input.oldValue1[i]= res.isOld0 ? 0 : res.oldValue;
        }

        if (tx.amount) {
            // TODO
        } else{
            // State 1
            this.input.ax2[i]= 0;
            this.input.ay2[i]= 0;
            this.input.amount2[i]= 0;
            this.input.nonce2[i]= 0;
            this.input.ethAddr2[i]= 0;
            this.input.siblings2[i] = [];
            for (let j=0; j<this.nLevels; j++) {
                this.input.siblings2[i][j]= 0;
            }
            this.input.isOld0_2[i]= 0;
            this.input.oldKey2[i]= 0;
            this.input.oldValue2[i]= 0;
        }
    }

    _addOffChainTx() {

    }

    async build() {
        if (this.builded) throw new Error("Block already builded");
        for (let i=0; i<this.offChainTxs.length; i++) {
            await this._addOffChainTx(this.onChainTxs[i]);
        }
        for (let i=0; i<this.maxNTx - this.offChainTxs.length - this.onChainTxs.length; i++) {
            this._addNopTx();
        }
        for (let i=0; i<this.onChainTxs.length; i++) {
            await this._addOnChainTx(this.onChainTxs[i]);
        }
        this.builded=true;
    }

    getInput() {
        if (!this.builded) throw new Error("Block must first be builded");
        return this.input;
    }

    getNewStateRoot() {
        if (!this.builded) throw new Error("Block must first be builded");
        return this.stateTree.root;
    }

    getNewExitRoot() {
        if (!this.builded) throw new Error("Block must first be builded");
        return 0;
    }

    getDataAvailable() {
        if (!this.builded) throw new Error("Block must first be builded");

        const bytes = [];
        function pushInt(n, size) {
            for (let i=0; i<size; i++) {
                bytes.push((n >> (i*8))&0xFF);
            }
        }
        for (let i=0; i<this.offChainTxs.length; i++) {
            pushInt(this.offChainTxs[i].fromIdx, this.nLevels/8);
            pushInt(this.offChainTxs[i].toIdx, this.nLevels/8);
            pushInt(utils.fix2float(this.offChainTxs[i].amount), 2);
            pushInt(this.offChainTxs[i].coin, 2);
        }
        return Buffer.from(bytes);
    }

    getOnChainHash() {
        if (!this.builded) throw new Error("Block must first be builded");
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
        if (!this.builded) throw new Error("Block must first be builded");
        const txSize = (this.nLevels/8)*2+2+2;
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
        if (!this.builded) throw new Error("Block must first be builded");
        return 0;
    }

    createAccount(tx) {
        if (this.builded) throw new Error("Block already builded");
        if (this.onChainTxs.length + this.offChainTxs.length >= this.maxNTx) {
            throw Error("Too many TX per block");
        }
        this.onChainTxs.push(tx);
    }


};
