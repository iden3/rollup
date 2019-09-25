/* eslint-disable no-underscore-dangle */
/* global artifacts */
/* global contract */
/* global web3 */
/* global BigInt */

const ethUtil = require("ethereumjs-util");
const chai = require("chai");
const { smt } = require("circomlib");
const crypto = require("crypto");

const { expect } = chai;
const poseidonUnit = require("../../node_modules/circomlib/src/poseidon_gencontract.js");
const poseidonJs = require("../../node_modules/circomlib/src/poseidon.js");
const utils = require("../../rollup-utils/rollup-utils");
const treeUtils = require("../../rollup-utils/rollup-tree-utils");
const HelpersTest = artifacts.require("../contracts/test/RollupHelpersTestV2");

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

function padZeroes(str, length) {
    while (str.length < length) {
        str = `0${str}`;
    }
    return str;
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
            tokenIdsBuff = Buffer.concat([tokenIdsBuff, tmpBuff]);
        }
        const tokenIdsBytes = `0x${tokenIdsBuff.toString("hex")}`;

        let feeBuff = Buffer.alloc(0);
        for (let i = 0; i < totalTokens; i++) {
            const fee = 2 * (i + 1);
            arrayFee.push(fee);
            const feeHex = padZeroes(fee.toString("16"), 4);
            const tmpBuff = Buffer.from(feeHex, "hex");
            feeBuff = Buffer.concat([feeBuff, tmpBuff]);
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
            nTxBuff = Buffer.concat([nTxBuff, tmpBuff]);
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

    it("Hash off chain tx", async () => {
        const maxTx = 4;  
        const offChainTx = 2;
        const offChainTxLen = 8;
        // create 2 offChain tx
        const tx0 = utils.buildOffChainTx(2, 3, 10);
        const tx1 = utils.buildOffChainTx(7, 8, 100);
        const buffTxOffChain = Buffer.concat([tx0, tx1]);
        
        const bytesTx = `0x${buffTxOffChain.toString("hex")}`;
        // Calculate hash
        const fillBuff = Buffer.alloc(offChainTxLen*(maxTx - offChainTx));
        const hashTotalBuff = Buffer.concat([buffTxOffChain, fillBuff]);
        const r = BigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617");
        const hash = crypto.createHash("sha256")
            .update(hashTotalBuff)
            .digest("hex");
        const hashTotal = BigInt("0x" + hash) % r;
        // Calculate hash solidity
        const res = await insHelpers.hashOffChainTxTest(bytesTx, 4);
        expect(res.toString()).to.be.equal(hashTotal.toString());
    });

    it("Hash state rollup tree", async () => {
        const amountDeposit = 2;
        const tokenId = 3;
        const nonce = 4;
        const Ax = BigInt(30890499764467592830739030727222305800976141688008169211302);
        const Ay = BigInt(19826930437678088398923647454327426275321075228766562806246);
        const withdrawAddress = "0xe0fbce58cfaa72812103f003adce3f284fe5fc7c";

        const res = await insHelpers.buildTreeStateTest(amountDeposit, tokenId, Ax.toString(),
            Ay.toString(), withdrawAddress, nonce);
        
        const infoLeaf = treeUtils.hashStateTree(amountDeposit, tokenId, Ax, Ay, BigInt(withdrawAddress), nonce);

        expect(res[0]).to.be.equal(infoLeaf.elements.e0);
        expect(res[1]).to.be.equal(infoLeaf.elements.e1);
        expect(BigInt(res[2]).toString()).to.be.equal(BigInt(infoLeaf.elements.e2).toString());
        expect(BigInt(res[3]).toString()).to.be.equal(BigInt(infoLeaf.elements.e3).toString());
        expect(res[4]).to.be.equal(infoLeaf.elements.e4);

        const resHash = await insHelpers.hashTreeStateTest(amountDeposit, tokenId, Ax.toString(),
            Ay.toString(), withdrawAddress, nonce);
        expect(BigInt(resHash).toString()).to.be.equal(infoLeaf.hash.toString());
    });

    describe("Build and hash onChain", async () => {
        const fromId = 1;
        const toId = 2;
        const amount = 3;
        const token = 4;
        const nonce = 5;
        const maxFee = 6;
        const rqOffset = 4;
        const onChain = true;
        const newAccount = true;
        const oldOnChainHash = 1;
        const loadAmount = 2;
        const Ax = BigInt(30890499764467592830739030727222305800976141688008169211302);
        const Ay = BigInt(19826930437678088398923647454327426275321075228766562806246);
        const withdrawAddress = "0xe0fbce58cfaa72812103f003adce3f284fe5fc7c";

        let element;
        let onChainJs;

        it("hash 6 elements", async () => {
            const hashJs = poseidonJs.createHash(6, 8, 57);
            const resJs = hashJs([1, 2, 3, 4, 5, 6]);
    
            const resSm = await insHelpers.testHashGeneric([1, 2, 3, 4, 5, 6]);
            expect(resJs.toString()).to.be.equal(resSm.toString());
        });

        it("Build tx data", async () => {            
            element = utils.buildTxData(fromId, toId, amount, token,
                nonce, maxFee, rqOffset, onChain, newAccount);
            const res = await insHelpers.buildTxDataTest(fromId, toId, amount, token,
                nonce, maxFee, rqOffset, onChain, newAccount);
            expect(res).to.be.equal(element);
        });

        it("Build on chain data", async () => {            
            const res = await insHelpers.buildOnChainDataTest(oldOnChainHash,
                BigInt(element).toString(), loadAmount, withdrawAddress, Ax.toString(), Ay.toString());

            onChainJs = utils.hashOnChain(oldOnChainHash,
                BigInt(element), loadAmount, BigInt(withdrawAddress), Ax, Ay);

            expect(res[0]).to.be.equal(onChainJs.elements.e0);
            expect(res[1]).to.be.equal(onChainJs.elements.e1);
            expect(res[2]).to.be.equal(onChainJs.elements.e2);
            expect(res[3]).to.be.equal(onChainJs.elements.e3);
            expect(res[4]).to.be.equal(onChainJs.elements.e4);
            expect(res[5]).to.be.equal(onChainJs.elements.e5);
        });

        it("hash on chain data", async () => {            
            const res = await insHelpers.hashOnChainTest(oldOnChainHash,
                BigInt(element).toString(), loadAmount, withdrawAddress, Ax.toString(), Ay.toString());
            expect(BigInt(res).toString()).to.be.equal(onChainJs.hash.toString());
        });
    });
});
