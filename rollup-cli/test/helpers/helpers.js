
/* global BigInt */
/* global expect */
/* eslint-disable require-atomic-updates */

const { bigInt } = require('snarkjs');

const proofA = ['0', '0'];
const proofB = [['0', '0'], ['0', '0']];
const proofC = ['0', '0'];

/**
 * Convert to hexadecimal string padding until 256 characters
 * @param {Number | BigInt} n - input number
 * @returns {String} - String encoded as hexadecimal with 256 characters
 */
function padding256(n) {
    let nstr = BigInt(n).toString(16);
    while (nstr.length < 64) nstr = `0${nstr}`;
    nstr = `0x${nstr}`;
    return nstr;
}

/**
 * Get zkSnark public inputs from batchBuilder
 * @param {Object} bb - batchBuilder object
 * @returns {Array} - zkSanrk public inputs
 */
function buildPublicInputsSm(bb) {
    return [
        padding256(bb.getFinalIdx()),
        padding256(bb.getNewStateRoot()),
        padding256(bb.getNewExitRoot()),
        padding256(bb.getOnChainHash()),
        padding256(bb.getOffChainHash()),
        padding256(bb.getCountersOut()),
        padding256(bb.getInitIdx()),
        padding256(bb.getOldStateRoot()),
        padding256(bb.getFeePlanCoins()),
        padding256(bb.getFeePlanFees()),
    ];
}

function float2fix(fl) {
    const m = (fl & 0x3FF);
    const e = (fl >> 11);
    const e5 = (fl >> 10) & 1;

    const exp = bigInt(10).pow(bigInt(e));
    let res = bigInt(m).mul(exp);
    if (e5 && e) {
        res = res.add(exp.div(bigInt(2)));
    }
    return res;
}

/**
 * Decode rollup transactions
 * @param {String} txDataEncodedHex - rollup transaction encoded as an hex string
 * @returns {Object} - Raw rollup transaction
 */
function decodeTxData(txDataEncodedHex) {
    const txDataBi = bigInt(txDataEncodedHex);
    const txData = {};

    txData.IDEN3_ROLLUP_TX = txDataBi.and(bigInt(1).shl(64).sub(bigInt(1)));
    txData.amount = float2fix(txDataBi.shr(64).and(bigInt(1).shl(16).sub(bigInt(1))).toJSNumber());
    txData.tokenId = txDataBi.shr(80).and(bigInt(1).shl(32).sub(bigInt(1)));
    txData.nonce = txDataBi.shr(112).and(bigInt(1).shl(48).sub(bigInt(1)));
    txData.maxFee = float2fix(txDataBi.shr(160).and(bigInt(1).shl(16).sub(bigInt(1))).toJSNumber());
    txData.rqOffset = txDataBi.shr(176).and(bigInt(1).shl(3).sub(bigInt(1)));
    txData.onChain = !!txDataBi.shr(179).and(bigInt(1).shl(1).sub(bigInt(1)));
    txData.newAccount = !!txDataBi.shr(180).and(bigInt(1).shl(1).sub(bigInt(1)));

    return txData;
}

/**
 * Get transaction from either on-chain or on-chain event
 * @param {Object} event - Ethereum event
 * @returns {Object} - Decoded rollup transaction
 */
function manageEvent(event) {
    if (event.event === 'OnChainTx') {
        const txData = decodeTxData(event.args.txData);
        return {
            IDEN3_ROLLUP_TX: txData.IDEN3_ROLLUP_TX,
            amount: txData.amount,
            loadAmount: BigInt(event.args.loadAmount),
            coin: txData.tokenId,
            fromAx: BigInt(event.args.fromAx).toString(16),
            fromAy: BigInt(event.args.fromAy).toString(16),
            fromEthAddr: BigInt(event.args.fromEthAddress).toString(),
            toAx: BigInt(event.args.toAx).toString(16),
            toAy: BigInt(event.args.toAy).toString(16),
            toEthAddr: BigInt(event.args.toEthAddress).toString(),
            onChain: txData.onChain,
        };
    } if (event.event === 'OffChainTx') {
        return event.tx;
    }

    return null;
}


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
        this.counter = 1;
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
        await batch.build();
        const inputSm = buildFullInputSm(batch, this.beneficiary);
        await this.insRollupTest.forgeBatch(inputSm.beneficiary, inputSm.proofA,
            inputSm.proofB, inputSm.proofC, inputSm.input, compressedOnChainTx);
        await this.rollupDB.consolidate(batch);
    }

    checkBatchNumber(events) {
        events.forEach((elem) => {
            const eventBatch = BigInt(elem.args.batchNumber);
            expect(eventBatch.add(BigInt(2)).toString()).to.be.equal(BigInt(this.rollupDB.lastBatch).toString());
        });
    }
}


module.exports = {
    buildFullInputSm,
    ForgerTest,
};
