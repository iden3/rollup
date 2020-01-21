const SMTMemDB = require("circomlib").SMTMemDB;
const RollupAccount = require("../../js/rollupaccount");
const RollupDB = require("../../js/rollupdb");
const { performance } = require("perf_hooks");
const account1 = new RollupAccount(1);


async function addTxDeposit(nTx, bb){
    for ( let i = 1; i<=nTx; i++){
        bb.addTx({ fromIdx: i, loadAmount: 1000, coin: 0, ax: account1.ax, ay: account1.ay,
            ethAddress: account1.ethAddress, onChain: true });
    }
}

async function addTxDeposit2(nTx, bb){
    for ( let i = nTx+1; i<=nTx*2; i++){
        bb.addTx({ fromIdx: i, loadAmount: 1000, coin: 0, ax: account1.ax, ay: account1.ay,
            ethAddress: account1.ethAddress, onChain: true });
    }
}

async function addSend(nTx, bb, max){
    for ( let i = 0; i<nTx; i++){
        let randoms = randomIntegerMax(max);
        let tx = { fromIdx: randoms[0], toIdx: randoms[1], coin: 0, amount: 1, nonce: 0, userFee: 1};
        account1.signTx(tx);
        bb.addTx(tx);
    }
}

function randomIntegerMax(max){
    let a = Math.floor(Math.random() * max) + 1; 
    let b;
    do{
        b = Math.floor(Math.random() * max) + 1; 
    }
    while (a == b);
    return [a, b];
}

describe("Batchbuilder test", function () {
    this.timeout(0); 

    it("Should test batchbuilder performance", async () => {
        console.log("|   nTx    | 24 levels | 32 levels |");
        console.log("| -------- | --------- | --------- |");
        const levels= [24, 32];
        for (let i = 2; i < 13; i++){
            const nTx = 2**i; // 4, 8, 16... 4096
            let log = `| **${nTx}**    |`; // hackmd table
            for (const level of levels){  
                const db = new SMTMemDB();
                const rollupDB = await RollupDB(db);
                // add leafs to interact with them in the next batch
                const bb = await rollupDB.buildBatch(nTx, level);
                addTxDeposit(nTx/2 , bb);
                await bb.build();
                await rollupDB.consolidate(bb);
             
                const bb2 = await rollupDB.buildBatch(nTx, level);
                // 50% on-chain 50% off-chain
                addTxDeposit2(nTx/2 , bb2);
                addSend(nTx/2, bb2, nTx/2);

                const t0 = performance.now();
                await bb2.build();
                await rollupDB.consolidate(bb2);
                const t1 = performance.now();
                
                // prepare the log for the hackmd table
                let unit = "ms";
                let result = (t1-t0).toFixed(2);
                if (result>1000){
                    result = (result/1000).toFixed(2);
                    unit = "s";
                    if(result>60){
                        unit ="min";
                        result= (result/60).toFixed(2);
                    }
                }
                log += ` ${result + unit}   |`;
            }
            console.log(log); // log hackmd table
        }    
    });
});