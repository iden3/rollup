const BatchBuilder = require("./batchbuilder");
const bigInt = require("snarkjs").bigInt;
const Constants = require("./constants");
const utils = require("./utils");

class RollupDB {

    constructor(db, lastBatch, stateRoot) {
        this.db = db;
        this.lastBatch = lastBatch;
        this.stateRoot = stateRoot;
    }

    async buildBatch(maxNTx, nLevels) {
        return new BatchBuilder(this, this.lastBatch+1, this.stateRoot, maxNTx, nLevels);
    }

    async consolidate(bb) {
        if (bb.batchNumber != this.lastBatch +1) {
            throw new Error("Updating the wrong batch");
        }
        if (!bb.builded) {
            await bb.build();
        }
        const insertsState = Object.keys(bb.dbState.inserts).map(function(key) {
            return [bigInt(key), bb.dbState.inserts[key]];
        });
        const insertsExit = Object.keys(bb.dbExit.inserts).map(function(key) {
            return [bigInt(key), bb.dbExit.inserts[key]];
        });
        await this.db.multiIns([
            ...insertsState,
            ...insertsExit,
            [ Constants.DB_Batch.add(bigInt(bb.batchNumber)), [bb.stateTree.root, bb.exitTree.root]],
            [ Constants.DB_Master, this.lastBatch]
        ]);
        this.lastBatch = bb.batchNumber;
        this.stateRoot = bb.stateTree.root;
    }

    async getStateByIdx(idx) {
        const key = Constants.DB_Idx.add(bigInt(idx));
        const valueState = await this.db.get(key);
        const stateArray = await this.db.get(valueState);
        if (!stateArray) return null;
        const st = utils.array2state(stateArray);
        st.idx=Number(idx);
        return st;
    }

    async getStateByAxAy(ax, ay) {
        const keyAxAy = Constants.DB_AxAy.add(bigInt("0x" + ax)).add(bigInt("0x"+ay));

        const idxs = await this.db.get(keyAxAy);
        const promises = [];
        for (let i=0; i<idxs.length; i++) {
            promises.push(this.getStateByIdx(idxs[i]));
        }

        return Promise.all(promises);
    }

    async getStateByEthAddr(ethAddr) {
        const keyEthAddr = Constants.DB_EthAddr.add(bigInt(ethAddr));

        const idxs = await this.db.get(keyEthAddr);
        const promises = [];
        for (let i=0; i<idxs.length; i++) {
            promises.push(this.getStateByIdx(idxs[i]));
        }

        return Promise.all(promises);
    }

    getLastBatchId(){
        return this.lastBatch;
    }
}

module.exports = async function(db) {
    const master = await db.get(Constants.DB_Master);
    if (!master) {
        return new RollupDB(db, 0, bigInt(0));
    }
    const batch = await db.get(Constants.DB_Batch.add(master[0]));
    if (!batch) {
        throw new Error("Database corrupted");
    }
    return new RollupDB(db, master[0], batch[0]);
};
