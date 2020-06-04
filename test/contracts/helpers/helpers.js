
/* global web3 */
/* global artifacts */

const { expect }  = require("chai");
const abiDecoder = require("abi-decoder");
const poseidon = require("circomlib").poseidon;
const eddsa = require("circomlib").eddsa;
const Scalar = require("ffjavascript").Scalar;

const { buildPublicInputsSm, manageEvent } = require("../../../rollup-operator/src/utils");
const { buildElement, hash } = require("../../../rollup-utils/utils");
const { buildTxData } = require("../../../js/utils");

const RollupPoS = artifacts.require("../contracts/RollupPoS");
const Rollup = artifacts.require("../contracts/Rollup");

const proofA = ["0", "0"];
const proofB = [["0", "0"], ["0", "0"]];
const proofC = ["0", "0"];

abiDecoder.addABI(RollupPoS.abi);
abiDecoder.addABI(Rollup.abi);

function decodeMethod(transaction){
    return abiDecoder.decodeMethod(transaction);
}

function buildFullInputSm(bb) {
    const input = buildPublicInputsSm(bb);
    return {
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

    async forgeBatch(events = undefined, compressedOnChainTx = []) {
        const batch = await this.rollupDB.buildBatch(this.maxTx, this.nLevels);

        batch.addBeneficiaryAddress(this.beneficiary);

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
        const inputSm = buildFullInputSm(batch);
        await this.insRollupTest.forgeBatch(inputSm.proofA,
            inputSm.proofB, inputSm.proofC, inputSm.input, compressedOnChainTx);
        await this.rollupDB.consolidate(batch);
    }    

    checkBatchNumber(events) {
        events.forEach(elem => {
            const eventBatch = Scalar.e(elem.args.batchNumber);
            expect(Scalar.add(eventBatch, 2)).to.be.equal(Scalar.e(this.rollupDB.lastBatch));
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

async function getPublicPoBVariables(insRollupPoB) {
    const blocksPerSlot = await insRollupPoB.BLOCKS_PER_SLOT();
    const amountMinBid = await insRollupPoB.MIN_BID();
    const genesisBlock = await insRollupPoB.genesisBlock();
    const deadlineBlocks = Number(await insRollupPoB.SLOT_DEADLINE());

    return [blocksPerSlot, amountMinBid, genesisBlock, deadlineBlocks];
}


function padZeroes(str, length) {
    while (str.length < length) {
        str = `0${str}`;
    }
    return str;
}

function buildOnChainData(fromAx, fromAy, toEthAddress, Ax, Ay) {
    // Build Entry
    // element 0
    const e0 = buildElement([fromAx.toString(16)]);
    // element 1
    const e1 = buildElement([fromAy.toString(16)]);
    // element 2
    const e2 = buildElement([toEthAddress.toString(16)]); 
    // element 3
    const e3 = buildElement([Ax.toString(16)]);
    // element 4
    const e4 = buildElement([Ay.toString(16)]);

    return {e0, e1, e2, e3, e4};
}

function hashOnChainData(tx){
    const dataOnChain = hash([
        Scalar.fromString(tx.fromAx, 16),
        Scalar.fromString(tx.fromAy, 16),
        Scalar.fromString(tx.toEthAddr, 16),
        Scalar.fromString(tx.toAx, 16),
        Scalar.fromString(tx.toAy, 16),
    ]);
    return dataOnChain;
}


function buildhashOnChain(oldOnChainHash, txData, loadAmount, hashOnchainData, fromEthAddress) {
    // Build Entry
    // element 0
    const e0 = buildElement([oldOnChainHash.toString(16)]);
    // element 1
    const e1 = buildElement([txData.toString(16)]);
    // element 2
    const e2 = buildElement([loadAmount.toString(16)]);
    // element 3
    const e3 = buildElement([hashOnchainData.toString(16)]); 
    // element 4
    const e4 = buildElement([fromEthAddress.toString(16)]);

    return {e0, e1, e2, e3, e4};
}

function hashOnChain(oldOnChainHash, txData, loadAmount, hashOnchainData, fromEthAddr){
    const dataOnChain = hash([
        oldOnChainHash,
        txData,
        loadAmount,
        hashOnchainData,
        fromEthAddr,
    ]);
    return dataOnChain;
}

function signRollupTx(walletBabyJub, tx) {
    const data = buildTxData(tx.amount, tx.coin, tx.nonce,
        tx.userFee, tx.rqOffset, tx.onChain, tx.newAccount);
    const hash = poseidon.createHash(5, 8, 57);

    const h = hash([
        data,
        tx.rqTxData || 0,
        Scalar.fromString(tx.toAx, 16),
        Scalar.fromString(tx.toAy, 16),
        Scalar.fromString(tx.toEthAddr, 16),
    ]);
    const signature = eddsa.signPoseidon(walletBabyJub.privateKey.toString("hex"), h);
    tx.r8x = signature.R8[0];
    tx.r8y = signature.R8[1];
    tx.s = signature.S;
}

function toFixedDown(value, digits) {
    if( isNaN(value) )
        return 0;
    var n = value - Math.pow(10, -digits)/2;
    n += n / Math.pow(2, 53);
    return n.toFixed(digits);
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
    signRollupTx,
    getPublicPoBVariables,
    toFixedDown
};
