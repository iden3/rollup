const { expect } = require("chai");
const Scalar = require("ffjavascript").Scalar;

function timeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function assertForgeBatch(cliRollup, targetBatch, timeoutLoop){
    let batchForged = false;
    let counter = 0;
    while(!batchForged && counter < 10) {
        const res = await cliRollup.getState();
        const info = res.data;
        if (info.rollupSynch.lastBatchSynched > targetBatch) {
            batchForged = true;
            break;
        } 
        await timeout(timeoutLoop);
        counter += 1;
    }
    expect(batchForged).to.be.equal(true);
}

async function assertBalances(cliRollup, rollupAccounts, arrayBalances){
    const numAccounts = rollupAccounts.length;
    const coin = 0;

    for (let i = 0; i < numAccounts; i++){
        if (arrayBalances[i] !== null){
            const ax = rollupAccounts[i].babyjubWallet.publicKey[0].toString(16);
            const ay = rollupAccounts[i].babyjubWallet.publicKey[1].toString(16);

            const res = await cliRollup.getStateAccount(coin, ax, ay);
            expect(Scalar.eq(res.data.amount, arrayBalances[i])).to.be.equal(true);
        }
    }
}

module.exports = {
    assertForgeBatch,
    assertBalances,
};