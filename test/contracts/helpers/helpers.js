
/* global web3 */
/* global BigInt */
/* global artifacts */

const { buildPublicInputsSm, manageEvent } = require("../../../rollup-operator/src/utils");
const chai = require("chai");
const { expect } = chai;


const proofA = ["0", "0"];
const proofB = [["0", "0"], ["0", "0"]];
const proofC = ["0", "0"];

const abiDecoder = require("abi-decoder");
const RollupPoS = artifacts.require("../contracts/RollupPoS");
const Rollup = artifacts.require("../contracts/Rollup");

abiDecoder.addABI(RollupPoS.abi);
abiDecoder.addABI(Rollup.abi);

function decodeMethod(transaction){
    return abiDecoder.decodeMethod(transaction);
}

function buildFullInputSm(bb, beneficiary) {
    const input = buildPublicInputsSm(bb);
    return {
        beneficiary: beneficiary,
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
        this.insRollupTest= insRollupTest;
    }

    async forgeBatch(events = undefined) {
        const batch = await this.rollupDB.buildBatch(this.maxTx, this.nLevels);
        if (events) {
            events.forEach(elem => {
                batch.addTx(manageEvent(elem));
            });
        }
        await batch.build();
        const inputSm = buildFullInputSm(batch, this.beneficiary);
        await this.insRollupTest.forgeBatch(inputSm.beneficiary, inputSm.proofA,
            inputSm.proofB, inputSm.proofC, inputSm.input);
        await this.rollupDB.consolidate(batch);
    }    

    checkBatchNumber(events) {
        events.forEach(elem => {
            const eventBatch = BigInt(elem.args.batchNumber);
            expect(eventBatch.add(BigInt(2)).toString()).to.be.equal(BigInt(this.rollupDB.lastBatch).toString());
        });
    }    
}


async function getEtherBalance(address) {
    let balance = await web3.eth.getBalance(address);
    balance = web3.utils.fromWei(balance, "ether");
    return Number(balance);
}


async function getPublicPoSVariables(insRollupPoS) {
    const slotPerEra = await insRollupPoS.SLOTS_PER_ERA();
    const blocksPerSlot = await insRollupPoS.BLOCKS_PER_SLOT();
    const blockPerEra = slotPerEra * blocksPerSlot;
    const amountToStake = await insRollupPoS.MIN_STAKE();
    const genesisBlock = await insRollupPoS.genesisBlock();
    const deadlineBlocks = Number(await insRollupPoS.SLOT_DEADLINE());

    return [slotPerEra, blocksPerSlot, blockPerEra, amountToStake, genesisBlock, deadlineBlocks];
}



function padZeroes(str, length) {
    while (str.length < length) {
        str = `0${str}`;
    }
    return str;
}

module.exports = {
    buildFullInputSm,
    ForgerTest,
    decodeMethod,
    getEtherBalance,
    getPublicPoSVariables,
    padZeroes
};
