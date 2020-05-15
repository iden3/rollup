const Scalar = require("ffjavascript").Scalar;
const Constants = require("./constants");
const utils = require("./utils");

class DepositsState {

    constructor(maxSlots, feeDeposit, conversion, rollupDb) {
        this.rollupDb = rollupDb;
        this.maxSlots = maxSlots;
        this.lastIdx = 2**24;
        this.newLeafs = {};
        this.states = {};
        this.txs = [];
        this.txOffChainToForge = [];
        this.lenArrayTx = 8;
        this.feeDeposit = feeDeposit || null;
        this.ethPrice = null;
        this.conversion = conversion;
    }

    setFee(feeDeposit){
        this.feeDeposit = feeDeposit  || null;
    }

    setEthPrice(ethPrice){
        this.ethPrice = ethPrice || null;
    }

    setConversion(conversion){
        this.conversion = conversion;
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
        // Check is fee is enough to cover transaction
        const res = this._checkFees(tx);
        if (!res) return "NOT_ENOUGH_FEE";

        const hashIdx = utils.hashIdx(tx.coin, tx.toAx, tx.toAy);
        this.newLeafs[hashIdx] = this.lastIdx;
        // set flag to identify deposit off-chain
        tx.isDeposit = true;
        tx.toIdx = this.lastIdx;
        tx.timestamp = (new Date()).getTime();

        this.txs.push(tx);
        this.lastIdx += 1;
        
        this.states[this.lastIdx] = {
            ax: tx.toAx,
            ay: tx.toAy,
            coin: tx.coin,
            nonce: 0,
            amount: tx.amount,
        };
        await this._saveTxToDb(tx);
    }

    _checkFees(tx){
        if (this.feeDeposit === null || this.ethPrice === null) 
            return false;

        const feeTx = utils.float2fix(utils.fix2float(tx.userFee));
        const convRate = this.conversion[tx.coin];

        if (convRate) {
            const num = Scalar.mul(feeTx, Math.floor(convRate.price * 2**64));
            const den = Scalar.pow(10, convRate.decimals);

            const normalizeFeeTx = Number(Scalar.div(num, den)) / 2**64;

            if (normalizeFeeTx > (this.feeDeposit * this.ethPrice)){
                return true; 
            }
        }
        return false;
    }

    _setNormalizedFees() {
        for (let i = 0; i < this.txs.length; i++) {
            const tx = this.txs[i];
            const convRate = this.conversion[tx.coin];

            if (convRate) {
                const num = Scalar.mul(tx.userFee, Math.floor(convRate.price * 2**64));
                const den = Scalar.pow(10, convRate.decimals);

                tx.normalizedFee = Number(Scalar.div(num, den)) / 2**64;
            } else {
                tx.normalizedFee = 0;
            }
        }
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
        
        for (let i = 0; i < this.txs.length ; i++){
            const arrayTx = this._tx2Array(this.txs[i]);
            valTxs = [...valTxs, ...arrayTx];
        }

        await this.rollupDb.db.multiIns([
            [Constants.DB_TxPoolDepositTx, valTxs],
        ]);
    }

    async loadFromDb(){
        const lastTxs = await this.rollupDb.db.get(Constants.DB_TxPoolDepositTx);

        let valTxs;
        if (!lastTxs) valTxs = [];
        else valTxs = [...lastTxs];
        
        const numTx = valTxs.length / this.lenArrayTx;

        for (let i = 0; i < numTx; i++){
            const arrayTx = valTxs.slice(this.lenArrayTx*i, this.lenArrayTx*i + this.lenArrayTx);
            this.txs.push(this._array2Tx(arrayTx));
        }    
    }

    async purge(){
        // remove all transactions that already exist on rollup db
        // meaning that the tx is no longer an off-chain deposit
        for (let i = 0; i < this.txs.length; i++) {
            const tx = this.txs[i];
            const toId = await this.rollupDb.getIdx(tx.coin, tx.toAx, tx.toAy);
            if (toId !== null)
                this.txs.splice(i, 1);
        }
        await this.saveAllToDb();
    }


    async setCandidates(nFreeTx){
        this.candidateOnChainTxs = [];
        this.candidateOffChainTxs = [];
        this.candidateTxs = [];
        
        const maxDepositsToAdd = Math.floor(nFreeTx/2);

        if (!maxDepositsToAdd) return 0;

        await this.purge();
        this._setNormalizedFees();

        // Sort deposits by normalized fee
        this.txs.sort( (a, b) => {
            return b.normalizedFee - a.normalizedFee;
        });

        // Set all deposits off-chain into the batch builder
        let depositsAdded = 0;
        for (let i = 0; i < maxDepositsToAdd; i++){
            if (this.txs.length){
                // remove array element
                const tx = this.txs.shift();
                tx.candidateId = depositsAdded;
                this.candidateTxs.push(tx);
                // get on-chain tx
                const onChainTx = this._getOnChainTx(tx);
                this.candidateOnChainTxs.push(onChainTx);
                // bb.addTx(onChainTx);
                // bb.addDepositOffChain(onChainTx);

                // get off-chain tx
                const offChainTx = this._getOffChainTx(tx);
                this.candidateOffChainTxs.push(offChainTx);
                // bb.addTx(offChainTx);
                
                // update deposits added
                depositsAdded += 1; 
            } else break;
        }
        // await this.saveAllToDb();
        // return depositsAdded;
    }

    getTxOffChainCandidates(){
        return this.candidateOffChainTxs;
    }

    getTxOnChainCandidates(){
        return this.candidateOnChainTxs;
    }

    async recoverNonUsedTx(forgedTxs){
        const toDelete = [];
        for (let txForged of forgedTxs){
            if (txForged.isDeposit){
                toDelete.push(txForged.candidateId);
            }
        }

        for (let tx of this.candidateTxs){
            if (!toDelete.includes(tx.candidateId)){
                this.txs.push(tx);
            }
        }
        await this.saveAllToDb();
    }


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
            onChain: true,
            candidateId: tx.candidateId,
        };
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
            fee: tx.fee,
            normalizedFee: tx.normalizedFee,
            isDeposit: tx.isDeposit,
            candidateId: tx.candidateId,
        };
    }

    reset() {
        this.lastIdx = 2**24;
        this.newLeafs = {};
        this.states = {};
        this.txs = [];
    }

    _tx2Array(tx) {
        return [
            this._buildTxDataPool(tx),
            Scalar.e(tx.rqTxData || 0),
            Scalar.add(Scalar.shl(tx.timestamp, 1), tx.isDeposit ? 1 : 0),
            Scalar.fromString(tx.fromAx, 16),
            Scalar.fromString(tx.fromAy, 16),
            Scalar.fromString(tx.toAx, 16),
            Scalar.fromString(tx.toAy, 16),
            Scalar.fromString(tx.toEthAddr, 16),
        ];
    }

    _buildTxDataPool(tx){
        let res = Scalar.e(0);

        res = Scalar.add(res, tx.fromIdx);
        res = Scalar.add(res, Scalar.shl(tx.toIdx, 64));
        res = Scalar.add(res, Scalar.shl(utils.fix2float(tx.amount, 128), 128));
        res = Scalar.add(res, Scalar.shl(tx.coin, 144));
        res = Scalar.add(res, Scalar.shl(tx.nonce, 176));
        res = Scalar.add(res, Scalar.shl(utils.fix2float(tx.userFee), 224));
        res = Scalar.add(res, Scalar.shl(tx.rqOffset || 0, 240));
        res = Scalar.add(res, Scalar.shl(tx.fee, 243));

        return res;
    }

    _array2Tx(arr) {
        const tx = {};
        const d0 = Scalar.e(arr[0]);
        tx.fromIdx = utils.extract(d0, 0, 64);
        tx.toIdx = utils.extract(d0, 64, 64);
        tx.amount = utils.float2fix(Scalar.toNumber(utils.extract(d0, 128, 16)));
        tx.coin = utils.extract(d0, 144, 16);
        tx.nonce = utils.extract(d0, 176, 16);
        tx.userFee = utils.float2fix(Scalar.toNumber(utils.extract(d0, 224, 16)));
        tx.rqOffset = utils.extract(d0, 240, 3);
        tx.fee = utils.extract(d0, 243, 4);

        tx.rqTxData = Scalar.e(arr[1]);

        tx.isDeposit = utils.extract(arr[2], 0, 1);
        tx.timestamp = utils.extract(arr[2], 1, 64);

        tx.fromAx = Scalar.e(arr[3]).toString(16);
        tx.fromAy = Scalar.e(arr[4]).toString(16);

        tx.toAx = Scalar.e(arr[5]).toString(16);
        tx.toAy = Scalar.e(arr[6]).toString(16);
        tx.toEthAddr = Scalar.e(arr[7]).toString(16);

        return tx;
    }
}

module.exports = DepositsState;