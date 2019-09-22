const BlockBuilder = require("./blockbuilder");
const bigInt = require("snarkjs").bigInt;

class RollupDB {

    constructor(db, lastBlock, stateRoot) {
        this.db = db;
        this.lastBlock = lastBlock;
        this.stateRoot = stateRoot;
    }

    async buildBlock(maxNTx, nLevels) {
        return new BlockBuilder(this.db, this.lastBlock+1, this.stateRoot, maxNTx, nLevels);
    }

    async consolidate(bb) {
        if (bb.blockNumber != this.lastBlock+1) {
            throw new Error("Updating the wrong block");
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
            [ bb.blockNumber, [bb.stateTree.root, bb.exitTree.root]],
            [ 0, this.lastBlock]
        ]);
        this.lastBlock = bb.blockNumber;
        this.stateRoot = bb.stateTree.root;
    }
}

module.exports = async function(db) {
    const master = await db.get(0);
    if (!master) {
        return new RollupDB(db, 0, bigInt(0));
    }
    const block = await db.get(master[0]);
    if (!block) {
        throw new Error("Database corrupted");
    }
    return new RollupDB(db, master[0], block[0]);
};
