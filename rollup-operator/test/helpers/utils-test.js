/* global BigInt */
const chai = require("chai");
const { expect } = chai;
const lodash = require("lodash");
const { stringifyBigInts } = require("snarkjs");

async function publicDataPoS(insRollupPoS){
    const publicData = {};
    publicData.delayGenesis = Number(await insRollupPoS.DELAY_GENESIS());
    publicData.blocksPerSlot = Number(await insRollupPoS.BLOCKS_PER_SLOT());
    publicData.slotsPerEra = Number(await insRollupPoS.SLOTS_PER_ERA());
    publicData.slotDeadline = Number(await insRollupPoS.SLOT_DEADLINE());
    publicData.maxTx = Number(await insRollupPoS.MAX_TX());
    publicData.minStake = BigInt(await insRollupPoS.MIN_STAKE());
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

module.exports = {
    publicDataPoS,
    checkSynch,
};