const Scalar = require("ffjavascript").Scalar;

const utils = require("./utils");

class TmpState {

    constructor(rollupDB, feeDeposit, ethPrice, conversion) {
        this.rollupDB = rollupDB;
        this.tmpStates = {};
        this.feeDeposit = feeDeposit;
        this.ethPrice = ethPrice;
        this.conversion = conversion;
    }

    async getState(idx) {
        if (typeof(this.tmpStates[idx]) == "undefined" ) {
            this.tmpStates[idx] = await this.rollupDB.getStateByIdx(idx);
        }
        return this.tmpStates[idx];
    }

    async getStateByAccount(idx) {
        if (typeof(this.tmpStates[idx]) == "undefined" ) {
            this.tmpStates[idx] = await this.rollupDB.getStateByIdx(idx);
        }
        return this.tmpStates[idx];
    }
    
    async canProcess(tx) {
        const stFrom = await this.getState(tx.fromIdx);
        if (!stFrom || stFrom.ax != tx.fromAx || stFrom.ay != tx.fromAy) return "NO";

        // Check nonce
        if (tx.nonce < stFrom.nonce) return "NO";
        if (tx.nonce > stFrom.nonce) return "NOT_NOW";

        // Check there is enough funds
        const amount = utils.float2fix(utils.fix2float(tx.amount));
        const fee = utils.calculateFee(tx);
        if (!Scalar.geq(stFrom.amount, Scalar.add(fee, amount))) return "NOT_NOW";

        // Check onChain flag
        if (tx.onChain) return "NO";

        if (!tx.isDeposit) {
            let stTo;
            if (tx.toIdx) {
                stTo = await this.getState(tx.toIdx);
                if (!stTo) return "NO";
                // Check coins match
                if (stTo.coin != stFrom.coin || stFrom.coin != tx.coin) return "NO";
            }
        } else {
            if (tx.toIdx) {
                return "NO";
            }
            if (!this._checkFeeDeposit(tx)){
                console.log("Deposit off-chain discarded due to low fee");
                return "NO";
            }
            // check leaf don't exist yet
            const hashIdx = utils.hashIdx(tx.coin, tx.toAx, tx.toAy);
            if (typeof(this.tmpStates[hashIdx]) != "undefined") {
                return "NO";
            }
        }

        return "YES";
    }

    async process(tx) { 
        const stFrom = await this.getState(tx.fromIdx);
        if (!stFrom || stFrom.ax != tx.fromAx || stFrom.ay != tx.fromAy) return false;

        // Check nonce
        if (tx.nonce != stFrom.nonce) return false;

        // Check there is enough funds
        const amount = utils.float2fix(utils.fix2float(tx.amount));
        const fee = utils.calculateFee(tx);
        if (!Scalar.geq(stFrom.amount, Scalar.add(fee, amount))) return false;

        // Check onChain flag
        if (tx.onChain) return false;

        stFrom.nonce++;
        stFrom.amount = Scalar.sub(stFrom.amount, amount);
        stFrom.amount = Scalar.sub(stFrom.amount, fee);

        if (!tx.isDeposit) {
            let stTo;
            if (tx.toIdx) {
                stTo = await this.getState(tx.toIdx);
                if (!stTo) return false;
                // Check coins match
                if (stTo.coin != stFrom.coin || stFrom.coin != tx.coin) return false;
                stTo.amount = Scalar.add(stTo.amount, amount);
            }
        } else {
            if (tx.toIdx) {
                return false;
            }
            if (!this._checkFeeDeposit(tx)){
                return false;
            }
            // Check leaf don't exist yet
            const hashIdx = utils.hashIdx(tx.coin, tx.toAx, tx.toAy);
            if (typeof(this.tmpStates[hashIdx]) == "undefined") {
                this.tmpStates[hashIdx] = { 
                    ax: tx.toAx,
                    ay: tx.toAy,
                    coin: tx.coin,
                    nonce: 0,
                    amount: tx.amount,
                };
            } else {
                return false;
            }
        }

        return true;
    }

    reset() {
        this.tmpStates = {};
    }

    addStates(states) {
        for (let idx of Object.keys(states))
            this.tmpStates[idx] = states[idx];
    }


    _checkFeeDeposit(tx){
        if (this.feeDeposit === null || this.ethPrice === null || this.conversion === null) 
            return false;

        const feeTx =  utils.calculateFee(tx);
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

}

module.exports = TmpState;
