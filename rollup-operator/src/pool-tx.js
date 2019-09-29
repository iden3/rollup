class Pool {
    constructor(maxTx){
        this.pool = [];
        this.maxTx = maxTx;
    }
	
    addTx(tx) {
        this.pool.push(tx);
    }
    
    getTxToForge(numTx){
        const res = [];
        const txToAdd = Math.min(this.maxTx, numTx);
        for (let i = 0; i < txToAdd; i++) {
            if (!this.pool.length) res.push(this.pool.shift());
        }
        return res;
    }
}

module.exports = Pool;