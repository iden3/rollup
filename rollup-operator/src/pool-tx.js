const { timeout } = require("../src/utils");

class Pool {
    constructor(maxTx){
        this.pool = [];
        this.maxTx = maxTx;
    }
	
    async addTx(tx) {
        this.pool.push(tx);
    }
    
    async getTxToForge(numTx){
        const res = [];
        const txToAdd = Math.min(this.maxTx, numTx);
        for (let i = 0; i < txToAdd; i++) {
            if (!this.pool.length) res.push(this.pool.shift());
        }
        return res;
    }

    async fillBatch(bb) {
        // Simulate test to fill batch builder
        await timeout(1000);
        await bb.build();
        return bb;
    }
}

module.exports = Pool;