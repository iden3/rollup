const Scalar = require("ffjavascript").Scalar;
const Constants = require("./constants");
const utils = require("./utils");

class DepositsState {

    constructor(maxSlots, rollupDb) {
        this.rollupDb = rollupDb;
        this.maxSlots = maxSlots;
        this.lastIdx = 2**24;
        this.newLeafs = {};
        this.states = {};
        this.txs = [];
        this.txOffChainToForge = [];
    }

    isFull(){
        if (this.txs.length >= this.maxSlots) 
            return true;
        else    
            return false;
    }

    exist(tx) {
        const hashIdx = utils.hashIdx(tx.coin, tx.toAx, tx.toAy);
        if (this.newLeafs[hashIdx])
            return false;
        return true;
    }

    async addTx(tx) {
        const hashIdx = utils.hashIdx(tx.coin, tx.toAx, tx.toAy);
        this.newLeafs[hashIdx] = this.lastIdx;
        // set flag to identify deposit off-chain
        tx.isDeposit = true;

        this.txs.push(tx);
        this.lastIdx += 1;
        
        this.states[this.lastIdx] = {
            ax: tx.toAx,
            ay: tx.toAy,
            coin: tx.coin,
            nonce: 0,
            amount: tx.amount,
        }
        await this._saveTxToDb(tx);
    }

    async _saveTxToDb(tx){
        const lastTxs = await this.rollupDb.db.get(Constants.DB_TxPoolDepositTx);

        let valTxs = [];
        if (!lastTxs) valTxs = [];
            else valTxs = [...lastTxs];

        const arrayTx = this._tx2Array(tx);
        valTxs = [...valTxs, ...arrayTx];

        await this.rollupDb.db.multiIns([
            [Constants.DB_TxPoolDepositTx, valTxs],
        ]);
    }

    async saveAllToDb(){
        let valTxs = [];
        
        for (let i = 0; i < this.txs.length ; i++)
            valTxs.push(this._tx2Array(tx));

        await this.rollupDb.db.multiIns([
            [Constants.DB_TxPoolDepositTx, valTxs],
        ]);
    }

    async loadFromDb(){
        const lastTxs = await this.rollupDb.db.get(Constants.DB_TxPoolDepositTx);

        let valTxs;
        if (!lastTxs) valTxs = [];
        else valTxs = [...lastTxs];
        
        for (let valTx of valTxs)
            this.txs.push(_array2Tx(valTx));
    }

    async purge(){
        // remove all transactions that already exist on rollup db
        // meaning that the tx is no longer an off-chain deposit
        for (let i = 0; i < this.txs; i++) {
                const toId = await this.rollupDb.getIdx(tx.coin, tx.toAx, tx.toAy);
                if (toId !== null)
                    this.txs.splice(i, 1);
        }
        await this.saveAllToDb();
    }


    fillBatch(bb, nFreeTx){
        // this.candidateOnChainTxs = [];
        this.txToForge = [];
        
        const maxDepositsToAdd = Math.floor(nFreeTx/2);

        // Sort deposits by normalize fee
        this.txs.sort( (a, b) => {
            return b.normalizedFee - a.normalizedFee;
        });

        // Set all deposits off-chain into the batch builder
        let depositsAdded = 0;
        for (let i = 0; i < maxDepositsToAdd; i++){
            if (this.txs.length){
                // get on-chain tx
                const onChainTx = this._getOnChainTx(this.txs[i]);
                // this.candidateOnChainTxs.push(onChainTx);
                bb.addTx(onChainTx);
                bb.addDepositOffChain(onChainTx);

                // get off-chain tx
                const offChainTx = this._getOffChainTx(this.txs[i]);
                this.txToForge.push(offChainTx);
                // bb.addTx(offChainTx);

                // remove array element
                this.txs.shift();
                
                // update deposits added
                depositsAdded += 1; 
            } else break;
        }

        return depositsAdded;
    }

    getTxToForge(){
        return this.txToForge;
    }

    // getTxOffChainCandidates(){
    //     return this.candidateOffChainTxs;
    // }

    // getTxOnChainCandidates(){
    //     return this.candidateOnChainTxs;
    // }

    _getOnChainTx(tx){
        return {
            loadAmount: 0,
            coin: tx.coin,
            fromAx: tx.toAx,
            fromAy: tx.toAy,
            fromEthAddr: tx.toEthAddr,
            toAx: Constants.exitAx,
            toAy: Constants.exitAy,
            toEthAddr: Constants.exitEthAddr,
            onChain: true
        }
    }

    _getOffChainTx(tx){
        return {
            fromAx: tx.fromAx,
            fromAy: tx.fromAy,
            fromEthAddr: tx.fromEthAddr,
            toAx: tx.toAx,
            toAy: tx.toAy,
            toEthAddr: tx.toEthAddr,
            coin: tx.coin,
            amount: tx.amount,
            nonce: 0,
            userFee: tx.userFee,
            normalizedFee: tx.normalizedFee,
            isDeposit: tx.isDeposit,
        }
    }

    reset() {
        this.lastIdx = 2**24;
        this.newLeafs = {};
        this.states = {};
        this.txs = [];
    }

    _tx2Array(tx) {
        return [
            utils.buildTxData(tx),
            Scalar.e(tx.rqTxData || 0),
            Scalar.e(tx.isDeposit ? 1 : 0),
            Scalar.fromString(tx.fromAx, 16),
            Scalar.fromString(tx.fromAy, 16),
        ];
    }

    _array2Tx(arr) {
        const tx = {};
        const d0 = Scalar.e(arr[0]);
        tx.fromIdx = utils.extract(d0, 0, 64);
        tx.toIdx = utils.extract(d0, 64, 64);
        tx.amount = utils.float2fix(utils.extract(d0, 128, 16));
        tx.coin = utils.extract(d0, 144, 16);
        tx.nonce = utils.extract(d0, 176, 16);
        tx.userFee = utils.float2fix(utils.extract(d0, 224, 16));
        tx.rqOffset = utils.extract(d0, 240, 3);
        tx.onChain = utils.extract(d0, 243, 1);
        tx.newAccount = utils.extract(d0, 244, 1);

        tx.rqTxData = Scalar.e(arr[1]);

        tx.isDeposit = utils.extract(arr[1], 0, 1);

        tx.fromAx = Scalar.e(arr[2]).toString(16);
        tx.fromAy = Scalar.e(arr[3]).toString(16);

        return tx;
    }
}

module.exports = DepositsState;
