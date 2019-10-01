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
        if (!stFrom) return "NO";
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
        if (!(stFrom.amount.greaterOrEquals(userFee.add(amount)))) return "NOT_NOW";

        // Check coins match
        if (tx.toIdx) {
            if (stTo.coin != stFrom.coin) return "NO";
        }

        return "YES";
    }

    async process(tx) {
        const stFrom = await this.getState(tx.fromIdx);
        if (!stFrom) return false;

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
        if (!(stFrom.amount.greaterOrEquals(userFee.add(amount)))) return false;

        // Check coins match
        if (tx.toIdx) {
            if (stTo.coin != stFrom.coin) return false;
        }

        stFrom.nonce++;
        stFrom.amount = stFrom.amount.sub(amount);
        stFrom.amount = stFrom.amount.sub(userFee);
        stTo.amount = stTo.amount.add(amount);

        return true;
    }

    reset() {
        this.tmpStates = {};
    }
}

module.exports = TmpState;
