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


async function publicDataPoB(insRollupPoB){
    const publicData = {};
    publicData.delayGenesis = Number(await insRollupPoB.DELAY_GENESIS());
    publicData.blocksPerSlot = Number(await insRollupPoB.BLOCKS_PER_SLOT());
    publicData.slotDeadline = Number(await insRollupPoB.SLOT_DEADLINE());
    publicData.maxTx = Number(await insRollupPoB.MAX_TX());
    publicData.minBid = Scalar.e(await insRollupPoB.MIN_BID());
    publicData.genesisBlock = Number(await insRollupPoB.genesisBlock());

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

async function assertBalancesDb(synch, rollupAccounts, opDb){
    const numAccounts = rollupAccounts.length;
    const coin = 0;

    for (let i = 0; i < numAccounts; i++){
        const ax = Scalar.e(rollupAccounts[i].Ax).toString("16");
        const ay = Scalar.e(rollupAccounts[i].Ay).toString("16");

        const resSynch = await synch.getStateByAccount(coin, ax, ay);
        let synchBalance;
        if (resSynch !== null) synchBalance = resSynch.amount;
        else synchBalance = null;
        
        const resOpDb = await opDb.getStateByAccount(coin, ax, ay);
        let opBalance;
        if (resOpDb !== null) opBalance = resOpDb.amount;
        else opBalance = null;

        if (synchBalance != null && opBalance != null)
            expect(Scalar.eq(synchBalance, opBalance)).to.be.equal(true);
        else
            expect(synchBalance).to.be.equal(opBalance);
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

async function getBalances(synch, rollupAccounts){
    const numAccounts = rollupAccounts.length;
    const coin = 0;
    const arrayBalances = [];

    for (let i = 0; i < numAccounts; i++){
        const ax = Scalar.e(rollupAccounts[i].Ax).toString("16");
        const ay = Scalar.e(rollupAccounts[i].Ay).toString("16");

        const res = await synch.getStateByAccount(coin, ax, ay);
        if (res != null)
            arrayBalances.push(res.amount);
        else
            arrayBalances.push(null);
    }
    return arrayBalances;
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
    publicDataPoB,
    checkSynch,
    assertBalancesDb,
    assertForgeBatch,
    assertBalances,
    getBalances,
};