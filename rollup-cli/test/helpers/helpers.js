
/* global expect */
/* eslint-disable require-atomic-updates */

const { Scalar } = require('ffjavascript');
const { buildPublicInputsSm, manageEvent } = require('../../../rollup-operator/src/utils');

const proofA = ['0', '0'];
const proofB = [['0', '0'], ['0', '0']];
const proofC = ['0', '0'];


function buildFullInputSm(bb, beneficiary) {
    const input = buildPublicInputsSm(bb);
    return {
        beneficiary,
        proofA,
        proofB,
        proofC,
        input,
    };
}

class ForgerTest {
    constructor(rollupDB, maxTx, nLevels, beneficiary, insRollupTest) {
        this.rollupDB = rollupDB;
        this.maxTx = maxTx;
        this.nLevels = nLevels;
        this.beneficiary = beneficiary;
        this.insRollupTest = insRollupTest;
    }

    async forgeBatch(events = undefined, compressedOnChainTx = []) {
        const batch = await this.rollupDB.buildBatch(this.maxTx, this.nLevels);

        if (events) {
            const addTxPromises = events.map(async (elem) => new Promise((resolve) => {
                const batchTx = manageEvent(elem);
                batch.addTx(batchTx);
                resolve();
            }));
            await Promise.all(addTxPromises);
        }
        batch.addBeneficiaryAddress(this.beneficiary);

        await batch.build();
        const inputSm = buildFullInputSm(batch, this.beneficiary);
        await this.insRollupTest.forgeBatch(inputSm.proofA,
            inputSm.proofB, inputSm.proofC, inputSm.input, compressedOnChainTx);
        await this.rollupDB.consolidate(batch);
    }

    checkBatchNumber(events) {
        events.forEach((elem) => {
            const eventBatch = Scalar.e(elem.args.batchNumber);
            expect(Scalar.add(eventBatch, 2)).to.be.equal(Scalar.e(this.rollupDB.lastBatch));
        });
    }
}


module.exports = {
    buildFullInputSm,
    ForgerTest,
};
