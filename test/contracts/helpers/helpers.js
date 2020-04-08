
/* global web3 */
/* global BigInt */
/* global artifacts */
/* eslint-disable require-atomic-updates*/

const { buildPublicInputsSm, manageEvent } = require("../../../rollup-operator/src/utils");
const chai = require("chai");
const { expect } = chai;
const {
    buildElement, hash
} = require("../../../rollup-utils/utils");

const proofA = ["0", "0"];
const proofB = [["0", "0"], ["0", "0"]];
const proofC = ["0", "0"];

const abiDecoder = require("abi-decoder");
const RollupPoS = artifacts.require("../contracts/RollupPoS");
const Rollup = artifacts.require("../contracts/Rollup");
const bigInt = require("snarkjs").bigInt;

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
        this.counter = 1;
    }

    async forgeBatch(events = undefined, compressedOnChainTx = []) {
        const batch = await this.rollupDB.buildBatch(this.maxTx, this.nLevels);

        if (events) {
            let addTxPromises = events.map(async elem => {
                return new Promise((resolve) => {
                    let batchTx = manageEvent(elem);
                    batch.addTx(batchTx);
                    resolve();
                });
            });
            await Promise.all(addTxPromises);
        }
        await batch.build();
        const inputSm = buildFullInputSm(batch, this.beneficiary);
        await this.insRollupTest.forgeBatch(inputSm.beneficiary, inputSm.proofA,
            inputSm.proofB, inputSm.proofC, inputSm.input, compressedOnChainTx);
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

function buildOnChainData(fromEthAddress, fromAx, fromAy, toEthAddress, Ax, Ay) {
    // Build Entry
    // element 0
    const e0 = buildElement([fromEthAddress.toString(16)]);
    // element 1
    const e1 = buildElement([fromAx.toString(16)]);
    // element 2
    const e2 = buildElement([fromAy.toString(16)]);
    // element 3
    const e3 = buildElement([toEthAddress.toString(16)]); 
    // element 4
    const e4 = buildElement([Ax.toString(16)]);
    // element 5
    const e5 = buildElement([Ay.toString(16)]);
    return {e0, e1, e2, e3, e4, e5};
}

function hashOnChainData(tx){
    const dataOnChain = hash([
        tx.fromEthAddr,
        BigInt("0x" + tx.fromAx),
        BigInt("0x" + tx.fromAy),
        tx.toEthAddr,
        BigInt("0x" + tx.toAx),
        BigInt("0x" + tx.toAy),
    ]);
    return dataOnChain;
}


function buildhashOnChain(oldOnChainHash, txData, loadAmount, hashOnchainData) {
    // Build Entry
    // element 0
    const e0 = buildElement([oldOnChainHash.toString(16)]);
    // element 1
    const e1 = buildElement([txData.toString(16)]);
    // element 2
    const e2 = buildElement([loadAmount.toString(16)]);
    // element 3
    const e3 = buildElement([hashOnchainData.toString(16)]); 

    return {e0, e1, e2, e3};
}

function hashOnChain(oldOnChainHash, txData, loadAmount, hashOnchainData){
    const dataOnChain = hash([
        oldOnChainHash,
        txData,
        loadAmount,
        hashOnchainData,
    ]);
    return dataOnChain;
}

function encodeAddressToken(address, token) {
    let res = BigInt(0);
    res = res.add( bigInt(token));
    res = res.add( bigInt(address).shl(32));
    return res;
}

module.exports = {
    buildFullInputSm,
    ForgerTest,
    decodeMethod,
    getEtherBalance,
    getPublicPoSVariables,
    padZeroes,
    buildOnChainData,
    hashOnChainData,
    buildhashOnChain,
    hashOnChain,
    encodeAddressToken
};
