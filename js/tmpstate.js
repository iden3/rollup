const Scalar = require("ffjavascript").Scalar;

const utils = require("./utils");

class TmpState {

    constructor(rollupDB) {
        this.rollupDB = rollupDB;
        this.tmpStates = {};
    }

    async getState(idx) {
        if (typeof(this.tmpStates[idx]) == "undefined" ) {
            this.tmpStates[idx] = await this.rollupDB.getStateByIdx(idx);
        }
        return this.tmpStates[idx];
    }

    async canProcess(tx) {
        const stFrom = await this.getState(tx.fromIdx);
        if (!stFrom || stFrom.ax != tx.fromAx || stFrom.ay != tx.fromAy) return "NO";
        let stTo;
        if (tx.toIdx) {
            stTo = await this.getState(tx.toIdx);
            if (!stTo) return "NO";
        }

        // Check nonce
        if (tx.nonce < stFrom.nonce) return "NO";
        if (tx.nonce > stFrom.nonce) return "NOT_NOW";

        // Check there is enough funds
        const amount = utils.float2fix(utils.fix2float(tx.amount));
        const userFee = utils.float2fix(utils.fix2float(tx.userFee));
        if (!Scalar.geq(stFrom.amount, Scalar.add(userFee, amount))) return "NOT_NOW";

        // Check coins match
        if (tx.toIdx) {
            if (stTo.coin != stFrom.coin || stFrom.coin != tx.coin) return "NO";
        }

        // Check onChain flag
        if (tx.onChain) return "NO";

        return "YES";
    }

    async process(tx) {
        const stFrom = await this.getState(tx.fromIdx);
        if (!stFrom || stFrom.ax != tx.fromAx || stFrom.ay != tx.fromAy) return false;

        let stTo;
        if (tx.toIdx) {
            stTo = await this.getState(tx.toIdx);
            if (!stTo) return false;
        }

        // Check nonce
        if (tx.nonce != stFrom.nonce) return false;

        // Check there is enough funds
        const amount = utils.float2fix(utils.fix2float(tx.amount));
        const userFee = utils.float2fix(utils.fix2float(tx.userFee));
        if (!Scalar.geq(stFrom.amount, Scalar.add(userFee, amount))) return false;

        // Check coins match
        if (tx.toIdx) {
            if (stTo.coin != stFrom.coin || stFrom.coin != tx.coin) return false;
        }

        // Check onChain flag
        if (tx.onChain) return false;

        stFrom.nonce++;
        stFrom.amount = Scalar.sub(stFrom.amount, amount);
        stFrom.amount = Scalar.sub(stFrom.amount, userFee);
        if (tx.toIdx) {
            stTo.amount = Scalar.add(stTo.amount, amount);
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
}

module.exports = TmpState;
