/* eslint-disable no-underscore-dangle */
/* global artifacts */
/* global contract */
/* global web3 */
/* global BigInt */

const ethUtil = require("ethereumjs-util");
const chai = require("chai");
const { smt } = require("circomlib");

const { expect } = chai;
const poseidonUnit = require("circomlib/src/poseidon_gencontract");
const poseidonJs = require("circomlib/src/poseidon");
const utils = require("../../js/utils");
const treeUtils = require("../../rollup-utils/rollup-tree-utils");
const HelpersTest = artifacts.require("../contracts/test/RollupHelpersTest");
const { padZeroes} = require("./helpers/helpers");
const helpers= require("./helpers/helpers");
const RollupDB = require("../../js/rollupdb");
const SMTMemDB = require("circomlib/src/smt_memdb");


const MAX_LEVELS = 24;

let tree;
const key1 = BigInt(7);
const value1 = BigInt(77);
const key2 = BigInt(8);
const value2 = BigInt(88);
const key3 = BigInt(32);
const value3 = BigInt(3232);

const key4 = BigInt(6);
const key5 = BigInt(22);
const key6 = BigInt(0);
const key7 = BigInt(9);


async function fillSmtTree() {
    tree = await smt.newMemEmptyTrie();

    await tree.insert(key1, value1);
    await tree.insert(key2, value2);
    await tree.insert(key3, value3);
}
contract("RollupHelpers functions", (accounts) => {
    const {
        0: owner,
    } = accounts;

    let insHelpers;
    let insPoseidonUnit;

    before(async () => {
    // Deploy poseidon
        const C = new web3.eth.Contract(poseidonUnit.abi);
        insPoseidonUnit = await C.deploy({ data: poseidonUnit.createCode()})
            .send({ gas: 5500000, from: owner });

        // Deploy rollup helpers test
        insHelpers = await HelpersTest.new(insPoseidonUnit._address);

        // Fill smt Tree
        fillSmtTree();
    });

    it("hash node generic", async () => {
        const hashJs = poseidonJs.createHash(6, 8, 57);
        const resJs = hashJs([1, 2, 3, 4, 5]);

        const resSm = await insHelpers.testHashGeneric([1, 2, 3, 4, 5]);
        expect(resJs.toString()).to.be.equal(resSm.toString());
    });

    it("hash node", async () => {
        const hashJs = poseidonJs.createHash(6, 8, 57);
        const resJs = hashJs([1, 2]);

        const resSm = await insHelpers.testHashNode(1, 2);
        expect(resJs.toString()).to.be.equal(resSm.toString());
    });

    it("hash final node", async () => {
        const hashJs = poseidonJs.createHash(6, 8, 57);
        const resJs = hashJs([1, 2, 1]);

        const resSm = await insHelpers.testHashFinalNode(1, 2);
        expect(resJs.toString()).to.be.equal(resSm.toString());
    });

    it("smt verifier: existence", async () => {
        const oldKey = "0";
        const oldValue = "0";
        const isOld = false;
        const isNonExistence = false;
        let resProof;
        let siblings;

        const root = tree.root.toString();

        // Verify key1, value1
        resProof = await tree.find(key1);
        siblings = [];
        for (let i = 0; i < resProof.siblings.length; i++) {
            siblings.push(resProof.siblings[i].toString());
        }
        const resSm1 = await insHelpers.smtVerifierTest(root, siblings, key1.toString(), value1.toString(),
            oldKey, oldValue, isNonExistence, isOld, MAX_LEVELS);
        expect(resSm1).to.be.equal(true);

        // Verify key2, value2
        resProof = await tree.find(key2);
        siblings = [];
        for (let i = 0; i < resProof.siblings.length; i++) {
            siblings.push(resProof.siblings[i].toString());
        }
        const resSm2 = await insHelpers.smtVerifierTest(root, siblings, key2.toString(), value2.toString(),
            oldKey, oldValue, isNonExistence, isOld, MAX_LEVELS);
        expect(resSm2).to.be.equal(true);

        // Verify key3, value3
        resProof = await tree.find(key3);
        siblings = [];
        for (let i = 0; i < resProof.siblings.length; i++) {
            siblings.push(resProof.siblings[i].toString());
        }
        const resSm3 = await insHelpers.smtVerifierTest(root, siblings, key3.toString(), value3.toString(),
            oldKey, oldValue, isNonExistence, isOld, MAX_LEVELS);
        expect(resSm3).to.be.equal(true);
    });

    it("sparse merkle tree verifier: non-existence empty node", async () => {
        let oldKey;
        let oldValue;
        let isOld;
        let isNonExistence;
        let resProof;
        let siblings;

        const root = tree.root.toString();

        // Verify non-existence key4
        resProof = await tree.find(key4);
        siblings = [];
        for (let i = 0; i < resProof.siblings.length; i++) {
            siblings.push(resProof.siblings[i].toString());
        }

        isNonExistence = !resProof.found;
        isOld = !resProof.isOld0;
        oldKey = resProof.notFoundKey.toString();
        oldValue = resProof.notFoundValue.toString();

        const resSm1 = await insHelpers.smtVerifierTest(root, siblings, key4.toString(), 0,
            oldKey, oldValue, isNonExistence, isOld, MAX_LEVELS);
        expect(resSm1).to.be.equal(true);

        // Verify non-existence key5
        resProof = await tree.find(key5);
        siblings = [];
        for (let i = 0; i < resProof.siblings.length; i++) {
            siblings.push(resProof.siblings[i].toString());
        }

        isNonExistence = !resProof.found;
        isOld = !resProof.isOld0;
        oldKey = resProof.notFoundKey.toString();
        oldValue = resProof.notFoundValue.toString();

        const resSm2 = await insHelpers.smtVerifierTest(root, siblings, key5.toString(), 0,
            oldKey, oldValue, isNonExistence, isOld, MAX_LEVELS);
        expect(resSm2).to.be.equal(true);
    });

    it("sparse merkle tree verifier: non-existence non-empty node", async () => {
        let oldKey;
        let oldValue;
        let isOld;
        let isNonExistence;
        let resProof;
        let siblings;

        const root = tree.root.toString();

        // Verify non-existence key6
        resProof = await tree.find(key6);
        siblings = [];
        for (let i = 0; i < resProof.siblings.length; i++) {
            siblings.push(resProof.siblings[i].toString());
        }

        isNonExistence = !resProof.found;
        isOld = !resProof.isOld0;
        oldKey = resProof.notFoundKey.toString();
        oldValue = resProof.notFoundValue.toString();

        const resSm1 = await insHelpers.smtVerifierTest(root, siblings, key6.toString(), 0,
            oldKey, oldValue, isNonExistence, isOld, MAX_LEVELS);
        expect(resSm1).to.be.equal(true);

        // Verify non-existence key7
        resProof = await tree.find(key7);
        siblings = [];
        for (let i = 0; i < resProof.siblings.length; i++) {
            siblings.push(resProof.siblings[i].toString());
        }

        isNonExistence = !resProof.found;
        isOld = !resProof.isOld0;
        oldKey = resProof.notFoundKey.toString();
        oldValue = resProof.notFoundValue.toString();

        const resSm2 = await insHelpers.smtVerifierTest(root, siblings, key7.toString(), 0,
            oldKey, oldValue, isNonExistence, isOld, MAX_LEVELS);
        expect(resSm2).to.be.equal(true);
    });

    it("sparse merkle tree verifier: trick proofs", async () => {
        const root = tree.root.toString();

        // Trick proofs
        const resProof = await tree.find(key1);
        const siblings = [];
        for (let i = 0; i < resProof.siblings.length; i++) {
            siblings.push(resProof.siblings[i].toString());
        }

        const isNonExistence = !resProof.found;
        const isOld = !resProof.isOld0;
        const oldKey = resProof.notFoundKey ? resProof.notFoundKey.toString() : BigInt(0).toString();
        const oldValue = resProof.notFoundKey ? resProof.notFoundValue.toString() : BigInt(0).toString();

        // Manipulate root
        const rootFake = BigInt(30890499764467592830739030727222305800976141688008169211302).toString();
        const resSm1 = await insHelpers.smtVerifierTest(rootFake, siblings, key1.toString(), value1.toString(),
            oldKey, oldValue, isNonExistence, isOld, MAX_LEVELS);
        expect(resSm1).to.be.equal(false);

        // Manipulate flag non-existence
        const isNonExistenceFake = true;
        const resSm2 = await insHelpers.smtVerifierTest(root, siblings, key1.toString(), value1.toString(),
            oldKey, oldValue, isNonExistenceFake, isOld, MAX_LEVELS);
        expect(resSm2).to.be.equal(false);

        // Manipulate key
        const keyFake = BigInt(46).toString();
        const resSm3 = await insHelpers.smtVerifierTest(root, siblings, keyFake.toString(), value1.toString(),
            oldKey, oldValue, isNonExistence, isOld, MAX_LEVELS);
        expect(resSm3).to.be.equal(false);

        // Manipulate value
        const valueFake = BigInt(7).toString();
        const resSm4 = await insHelpers.smtVerifierTest(root, siblings, key1.toString(), valueFake.toString(),
            oldKey, oldValue, isNonExistence, isOld, MAX_LEVELS);
        expect(resSm4).to.be.equal(false);
    });

    it("ecrecover helper", async () => {
        const privateKeyHex = "0x0102030405060708091011121314151617181920212223242526272829303132";
        const addressKey = ethUtil.privateToAddress(privateKeyHex);
        const addressKeyHex = `0x${addressKey.toString("hex")}`;
        const privateKey = Buffer.from(privateKeyHex.substr(2), "hex");

        const msg = Buffer.from("This is a test message");
        const msgHash = ethUtil.hashPersonalMessage(msg);
        const msgHashHex = ethUtil.bufferToHex(msgHash);
        const sig = ethUtil.ecsign(msgHash, privateKey);
        const sigHex = `0x${Buffer.concat([sig.r, sig.s, ethUtil.toBuffer(sig.v)]).toString("hex")}`;

        const res = await insHelpers.testEcrecover(msgHashHex, sigHex);
        expect(addressKeyHex).to.be.equal(res.toLowerCase());
    });

    it("Get entry from fee plan", async () => {
        const tokenPlan = "0x4000000000000000000000000000000320000000000000000000000000000001";
        const feePlan = "0x8000000000000000000000000000000760000000000000000000000000000005";

        const Entry1Hex = "0x0000000000000000000000000000000020000000000000000000000000000001";
        const Entry2Hex = "0x0000000000000000000000000000000040000000000000000000000000000003";
        const Entry3Hex = "0x0000000000000000000000000000000060000000000000000000000000000005";
        const Entry4Hex = "0x0000000000000000000000000000000080000000000000000000000000000007";
        const Entry5Hex = "0x0000000000000000000000000000000000000000000000000000000000000000";
        const res = await insHelpers.buildEntryFeePlanTest([tokenPlan, feePlan]);

        expect(res[0]).to.be.equal(Entry1Hex);
        expect(res[1]).to.be.equal(Entry2Hex);
        expect(res[2]).to.be.equal(Entry3Hex);
        expect(res[3]).to.be.equal(Entry4Hex);
        expect(res[4]).to.be.equal(Entry5Hex);
    });

    it("Calculate total fee per token", async () => {
        const totalTokens = 16;
        const arrayFee = [];
        const arrayTokenIds = [];
        let tokenIdsBuff = Buffer.alloc(0);
        for (let i = 0; i < totalTokens; i++) {
            const tokenId = Math.floor((Math.random() * 100) + 1);
            arrayTokenIds.push(tokenId);
            const tokenIdHex = padZeroes(tokenId.toString("16"), 4);
            const tmpBuff = Buffer.from(tokenIdHex, "hex");
            tokenIdsBuff = Buffer.concat([tmpBuff, tokenIdsBuff]);
        }
        const tokenIdsBytes = `0x${tokenIdsBuff.toString("hex")}`;

        let feeBuff = Buffer.alloc(0);
        for (let i = 0; i < totalTokens; i++) {
            const fee = 2 * (i + 1);
            arrayFee.push(fee);
            const feeHex = padZeroes(fee.toString("16"), 4);
            const tmpBuff = Buffer.from(feeHex, "hex");
            feeBuff = Buffer.concat([tmpBuff, feeBuff]);
        }
        const feeBytes = `0x${feeBuff.toString("hex")}`;
        // Build number of transactions buffer
        const arrayTx = [];
        let nTxBuff = Buffer.alloc(0);
        for (let i = 0; i < totalTokens; i++) {
            const rand = Math.floor((Math.random() * 10) + 1);
            arrayTx.push(rand);
            const nTxHex = padZeroes(rand.toString("16"), 4);
            const tmpBuff = Buffer.from(nTxHex, "hex");
            nTxBuff = Buffer.concat([tmpBuff, nTxBuff]);
        }
        const nTxBytes = `0x${nTxBuff.toString("hex")}`;

        for (let i = 0; i < totalTokens; i++) {
            const resJs = arrayFee[i] * arrayTx[i];
            // eslint-disable-next-line no-await-in-loop
            const resSm = await insHelpers.calcTokenTotalFeeTest(tokenIdsBytes, feeBytes, nTxBytes, i);
            expect(resSm["0"].toString()).to.be.equal(arrayTokenIds[i].toString());
            expect(resSm["1"].toString()).to.be.equal(resJs.toString());
        }
    });

    it("Hash state rollup tree", async () => {
        const amountDeposit = 2;
        const tokenId = 3;
        const nonce = 4;
        const Ax = BigInt(30890499764467592830739030727222305800976141688008169211302);
        const Ay = BigInt(19826930437678088398923647454327426275321075228766562806246);
        const ethAddr = "0xe0fbce58cfaa72812103f003adce3f284fe5fc7c";

        const res = await insHelpers.buildTreeStateTest(amountDeposit, tokenId, Ax.toString(),
            Ay.toString(), ethAddr, nonce);
        
        const infoLeaf = treeUtils.hashStateTree(amountDeposit, tokenId, Ax, Ay, BigInt(ethAddr), nonce);

        expect(res[0]).to.be.equal(infoLeaf.elements.e0);
        expect(res[1]).to.be.equal(infoLeaf.elements.e1);
        expect(BigInt(res[2]).toString()).to.be.equal(BigInt(infoLeaf.elements.e2).toString());
        expect(BigInt(res[3]).toString()).to.be.equal(BigInt(infoLeaf.elements.e3).toString());
        expect(res[4]).to.be.equal(infoLeaf.elements.e4);

        const resHash = await insHelpers.hashTreeStateTest(amountDeposit, tokenId, Ax.toString(),
            Ay.toString(), ethAddr, nonce);
        expect(BigInt(resHash).toString()).to.be.equal(infoLeaf.hash.toString());
    });

    it("float to fix", async () => {
        const testVector = [
            [0x307B, "123000000"],
            [0x1DC6, "454500"],
            [0xFFFF, "10235000000000000000000000000000000"],
            [0x0000, "0"],
            [0x0400, "0"],
            [0x0001, "1"],
            [0x0401, "1"],
            [0x0800, "0"],
            [0x0c00, "5"],
            [0x0801, "10"],
            [0x0c01, "15"],
        ];
        
        for (let i = 0; i < testVector.length; i ++) {
            const resSm = await insHelpers.float2FixTest(testVector[i][0]);
            expect(BigInt(resSm).toString()).to.be.equal(testVector[i][1]);
        }
    });


    describe("Build and hash onChain", async () => {
        const amount = 3;
        const coin = 4;
        const nonce = 5;
        const userFee = 6;
        const rqOffset = 4;
        const onChain = true;
        const newAccount = true;
        const oldOnChainHash = 1;
        const loadAmount = 2;
        const fromAx = BigInt(30890499764467592830739030727222305800976141688008169211302);
        const fromAy = BigInt(19826930437678088398923647454327426275321075228766562806246);
        const toAx = BigInt(0);
        const toAy = BigInt(0);
        const fromEthAddr = "0xe0fbce58cfaa72812103f003adce3f284fe5fc7c";
        const toEthAddr = "0x0000000000000000000000000000000000000000";
        const IDEN3_ROLLUP_TX = BigInt("4839017969649077913");
        //ethAddr with 0x and axay no?



        let txData;
        let hashOnchainData;
        let onChainHash;

        it("hash 6 elements", async () => {
            const hashJs = poseidonJs.createHash(6, 8, 57);
            const resJs = hashJs([1, 2, 3, 4, 5, 6]);
    
            const resSm = await insHelpers.testHashGeneric([1, 2, 3, 4, 5, 6]);
            expect(resJs.toString()).to.be.equal(resSm.toString());
        });

        it("Build tx data", async () => {            
            txData = utils.buildTxData({amount, coin,
                nonce, userFee, rqOffset, onChain, newAccount});
            const res = await insHelpers.buildTxDataTest(amount, coin,
                nonce, userFee, rqOffset, onChain, newAccount);
            expect(res).to.be.equal(`0x${padZeroes(txData.toString(16), 64)}`);

        });

        it("Build on chain data", async () => {            
            const res = await insHelpers.buildOnChainDataTest(fromEthAddr,
                fromAx.toString(), fromAy.toString(), toEthAddr, toAx.toString(), toAy.toString());

            let onChainJs = helpers.buildOnChainData(BigInt(fromEthAddr),
                fromAx, fromAy, BigInt(toEthAddr), toAx, toAy);
                
            expect(res[0]).to.be.equal(onChainJs.e0);
            expect(res[1]).to.be.equal(onChainJs.e1);
            expect(res[2]).to.be.equal(onChainJs.e2);
            expect(res[3]).to.be.equal(onChainJs.e3);
            expect(res[4]).to.be.equal(onChainJs.e4);
            expect(res[5]).to.be.equal(onChainJs.e5);
        });

        it("hash on chain data", async () => {            
            const res = await insHelpers.hashOnChainDataTest(fromEthAddr,
                fromAx.toString(), fromAy.toString(), toEthAddr, toAx.toString(), toAy.toString());
            hashOnchainData = helpers.hashOnChainData({fromEthAddr: BigInt(fromEthAddr),
                fromAx: fromAx.toString(16), fromAy: fromAy.toString(16), 
                toEthAddr: BigInt(toEthAddr), toAx: toAx.toString(16), toAy:toAy.toString(16)});
            expect(res.toString()).to.be.equal(hashOnchainData.toString());
        });
        
        it("Build on chain hash", async () => {            
            const res = await insHelpers.buildOnChainHashTest(oldOnChainHash,
                txData.toString(), loadAmount, hashOnchainData.toString());

            let onChainJs = helpers.buildhashOnChain(oldOnChainHash,
                txData, loadAmount,  BigInt(hashOnchainData.toString()));

            expect(res[0]).to.be.equal(onChainJs.e0);
            expect(res[1]).to.be.equal(onChainJs.e1);
            expect(res[2]).to.be.equal(onChainJs.e2);
            expect(res[3]).to.be.equal(onChainJs.e3);

        });

        it("hash on chain hash", async () => {            
            const res = await insHelpers.hashOnChainHashTest(oldOnChainHash,
                txData.toString(), loadAmount, hashOnchainData.toString());
            onChainHash = helpers.hashOnChain(oldOnChainHash,
                txData, loadAmount, hashOnchainData.toString());
            expect(BigInt(res).toString()).to.be.equal(onChainHash.toString());
        });

        it("helpers and batchbuilder must have the same results", async () => { 

            // necessary variables in order to be = to batchbuilder
            let amount = 0; 
            let oldOnChainHash = 0;
            let nonce = 0;
            let userFee = 0;
            let rqOffset = 0;
            const tx = {
                fromIdx: 1, // it does not matter for the hash, but is needed a valid transactoin
                toIdx: 0, //same
                IDEN3_ROLLUP_TX,
                amount,
                loadAmount,
                coin,
                fromAx: fromAx.toString(16),
                fromAy: fromAy.toString(16),
                fromEthAddr,
                toAx: toAx.toString(16),
                toAy: toAy.toString(16),
                toEthAddr,
                onChain: true
            };
            let db = new SMTMemDB();
            let rollupDB = await RollupDB(db);

            const batch = await rollupDB.buildBatch(8, 8);
            batch.addTx(tx);
            await batch.build();
            let hashBatchbuilder = batch.getOnChainHash();

            const txData = await insHelpers.buildTxDataTest(amount, coin,
                nonce, userFee, rqOffset, onChain, newAccount);
            const hashSC = await insHelpers.buildAndHashOnChain(fromEthAddr,
                fromAx.toString(), fromAy.toString(), toEthAddr, toAx.toString(), toAy.toString(), 
                oldOnChainHash, txData.toString(), loadAmount);
    

            expect(BigInt(hashSC).toString()).to.be.equal(hashBatchbuilder.toString());
        });

        it("should zip and unzip tokenId adn and address", async () => { 
            const ethAddr = "0xe0fbce58cfaa72812103f003adce3f284fe5fc7c";
            const tokenId = 3;
            let jsZip = helpers.encodeAddressToken(ethAddr, tokenId);
            const unzip = await insHelpers.testdecodeAddressTokens(jsZip.toString());
            expect(BigInt(unzip[0])).to.be.equal(BigInt(ethAddr));
            expect(parseInt(unzip[1].toString())).to.be.equal(tokenId);
        });
    
    });
});
