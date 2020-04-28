const { expect } = require("chai");
const lodash = require("lodash");
const { stringifyBigInts } = require("ffjavascript").utils;
const Scalar = require("ffjavascript").Scalar;

function timeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function publicDataPoS(insRollupPoS){
    const publicData = {};
    publicData.delayGenesis = Number(await insRollupPoS.DELAY_GENESIS());
    publicData.blocksPerSlot = Number(await insRollupPoS.BLOCKS_PER_SLOT());
    publicData.slotsPerEra = Number(await insRollupPoS.SLOTS_PER_ERA());
    publicData.slotDeadline = Number(await insRollupPoS.SLOT_DEADLINE());
    publicData.maxTx = Number(await insRollupPoS.MAX_TX());
    publicData.minStake = Scalar.e(await insRollupPoS.MIN_STAKE());
    publicData.genesisBlock = Number(await insRollupPoS.genesisBlock());

    return publicData;
}

async function checkSynch(synch, opRollupDb){
    // Check fully synchronized
    const totalSynched = await synch.getSynchPercentage();
    expect(totalSynched).to.be.equal(Number(100).toFixed(2));
    const isSynched = await synch.isSynched();
    expect(isSynched).to.be.equal(true);
    // Check database-synch matches database-op
    const keys = Object.keys(opRollupDb.db.nodes);
    for (const key of keys) {
        const valueOp = JSON.stringify(stringifyBigInts(await opRollupDb.db.get(key)));
        const valueSynch = JSON.stringify(stringifyBigInts(await synch.treeDb.db.get(key)));
        expect(lodash.isEqual(valueOp, valueSynch)).to.be.equal(true);
    }
}

async function assertBalances(synch, rollupAccounts, arrayBalances){
    const numAccounts = rollupAccounts.length;
    const coin = 0;

    for (let i = 0; i < numAccounts; i++){
        if (arrayBalances[i] !== null){
            const ax = Scalar.e(rollupAccounts[i].Ax).toString("16");
            const ay = Scalar.e(rollupAccounts[i].Ay).toString("16");

            const res = await synch.getStateByAccount(coin, ax, ay);
            expect(Scalar.eq(res.amount, arrayBalances[i])).to.be.equal(true);
        }
    }
}

async function assertForgeBatch(rollupSynch, targetBatch, timeoutLoop){
    let batchForged = false;
    let counter = 0;
    while(!batchForged && counter < 10) {
        const lastBatchSynched = await rollupSynch.getLastBatch();
        if (lastBatchSynched > targetBatch) {
            batchForged = true;
            break;
        } 
        await timeout(timeoutLoop);
        counter += 1;
    }
    expect(batchForged).to.be.equal(true);
}

module.exports = {
    publicDataPoS,
    checkSynch,
    assertBalances,
    assertForgeBatch,
};