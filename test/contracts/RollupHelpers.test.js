/* eslint-disable no-underscore-dangle */
/* global artifacts */
/* global contract */
/* global web3 */

const ethUtil = require("ethereumjs-util");
const { expect } = require("chai");
const { smt } = require("circomlib");
const poseidonUnit = require("circomlib/src/poseidon_gencontract");
const poseidonJs = require("circomlib/src/poseidon");
const SMTMemDB = require("circomlib/src/smt_memdb");
const Scalar = require("ffjavascript").Scalar;

const utils = require("../../js/utils");
const treeUtils = require("../../rollup-utils/rollup-tree-utils");
const HelpersTest = artifacts.require("../contracts/test/RollupHelpersTest");
const { padZeroes} = require("./helpers/helpers");
const helpers= require("./helpers/helpers");
const RollupDB = require("../../js/rollupdb");
const { exitAx, exitAy, exitEthAddr} = require("../../js/constants");

const MAX_LEVELS = 24;

let tree;
const key1 = Scalar.e(7);
const value1 = Scalar.e(77);
const key2 = Scalar.e(8);
const value2 = Scalar.e(88);
const key3 = Scalar.e(32);
const value3 = Scalar.e(3232);

const key4 = Scalar.e(6);
const key5 = Scalar.e(22);
const key6 = Scalar.e(0);
const key7 = Scalar.e(9);


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
        const oldKey = resProof.notFoundKey ? resProof.notFoundKey.toString() : Scalar.e(0).toString();
        const oldValue = resProof.notFoundKey ? resProof.notFoundValue.toString() : Scalar.e(0).toString();

        // Manipulate root
        const rootFake = Scalar.e(30890499764467592830739030727222305800976141688008169211302).toString();
        const resSm1 = await insHelpers.smtVerifierTest(rootFake, siblings, key1.toString(), value1.toString(),
            oldKey, oldValue, isNonExistence, isOld, MAX_LEVELS);
        expect(resSm1).to.be.equal(false);

        // Manipulate flag non-existence
        const isNonExistenceFake = true;
        const resSm2 = await insHelpers.smtVerifierTest(root, siblings, key1.toString(), value1.toString(),
            oldKey, oldValue, isNonExistenceFake, isOld, MAX_LEVELS);
        expect(resSm2).to.be.equal(false);

        // Manipulate key
        const keyFake = Scalar.e(46).toString();
        const resSm3 = await insHelpers.smtVerifierTest(root, siblings, keyFake.toString(), value1.toString(),
            oldKey, oldValue, isNonExistence, isOld, MAX_LEVELS);
        expect(resSm3).to.be.equal(false);

        // Manipulate value
        const valueFake = Scalar.e(7).toString();
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
        const arrayTotalFee = [];
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

        let totalFeeBuff = Buffer.alloc(0);
        for (let i = 0; i < totalTokens; i++) {
            const fee = 2 * (i + 1);
            arrayTotalFee.push(fee);
            const feeHex = padZeroes(fee.toString("16"), 4);
            const tmpBuff = Buffer.from(feeHex, "hex");
            totalFeeBuff = Buffer.concat([tmpBuff, totalFeeBuff]);
        }
        const feeBytes = `0x${totalFeeBuff.toString("hex")}`;

        for (let i = 0; i < totalTokens; i++) {
            // eslint-disable-next-line no-await-in-loop
            const resSm = await insHelpers.calcTokenTotalFeeTest(tokenIdsBytes, feeBytes, i);
            expect(resSm["0"].toString()).to.be.equal(arrayTokenIds[i].toString());
            expect(resSm["1"].toString()).to.be.equal(arrayTotalFee[i].toString());
        }
    });

    it("Hash state rollup tree", async () => {
        const amountDeposit = 2;
        const tokenId = 3;
        const nonce = 4;
        const Ax = Scalar.e(30890499764467592830739030727222305800976141688008169211302);
        const Ay = Scalar.e(19826930437678088398923647454327426275321075228766562806246);
        const ethAddr = "0xe0fbce58cfaa72812103f003adce3f284fe5fc7c";

        const res = await insHelpers.buildTreeStateTest(amountDeposit, tokenId, Ax.toString(),
            Ay.toString(), ethAddr, nonce);
        
        const infoLeaf = treeUtils.hashStateTree(amountDeposit, tokenId, Ax, Ay, Scalar.e(ethAddr), nonce);

        expect(res[0]).to.be.equal(infoLeaf.elements.e0);
        expect(res[1]).to.be.equal(infoLeaf.elements.e1);
        expect(Scalar.fromString(res[2]).toString()).to.be.equal(Scalar.fromString(infoLeaf.elements.e2).toString());
        expect(Scalar.fromString(res[3]).toString()).to.be.equal(Scalar.fromString(infoLeaf.elements.e3).toString());
        expect(res[4]).to.be.equal(infoLeaf.elements.e4);

        const resHash = await insHelpers.hashTreeStateTest(amountDeposit, tokenId, Ax.toString(),
            Ay.toString(), ethAddr, nonce);
        expect(Scalar.e(resHash).toString()).to.be.equal(infoLeaf.hash.toString());
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
            expect(Scalar.e(resSm).toString()).to.be.equal(testVector[i][1]);
        }
    });


    describe("Build and hash onChain", async () => {
        const amount = 3;
        const coin = 4;
        const nonce = 5;
        const fee = 6;
        const rqOffset = 4;
        const onChain = true;
        const newAccount = true;
        const oldOnChainHash = 1;
        const loadAmount = 2;
        const fromAx = Scalar.e(30890499764467592830739030727222305800976141688008169211302);
        const fromAy = Scalar.e(19826930437678088398923647454327426275321075228766562806246);
        const fromEthAddr = "0xe0fbce58cfaa72812103f003adce3f284fe5fc7c";
        const IDEN3_ROLLUP_TX = Scalar.fromString("4839017969649077913");

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
                nonce, fee, rqOffset, onChain, newAccount});
            const res = await insHelpers.buildTxDataTest(amount, coin,
                nonce, fee, rqOffset, onChain, newAccount);
            expect(res).to.be.equal(`0x${padZeroes(txData.toString(16), 64)}`);

        });

        it("Build on chain data", async () => {            
            const res = await insHelpers.buildOnChainDataTest(fromAx.toString(), fromAy.toString(), 
                exitEthAddr, exitAx, exitAy);

            const onChainJs = helpers.buildOnChainData(fromAx, fromAy, Scalar.e(exitEthAddr), Scalar.e(exitAx), Scalar.e(exitAy));
                
            expect(res[0]).to.be.equal(onChainJs.e0);
            expect(res[1]).to.be.equal(onChainJs.e1);
            expect(res[2]).to.be.equal(onChainJs.e2);
            expect(res[3]).to.be.equal(onChainJs.e3);
            expect(res[4]).to.be.equal(onChainJs.e4);
        });

        it("hash on chain data", async () => {            
            const res = await insHelpers.hashOnChainDataTest(fromAx.toString(), fromAy.toString(), exitEthAddr, exitAx, exitAy);

            hashOnchainData = helpers.hashOnChainData({fromAx: fromAx.toString(16), fromAy: fromAy.toString(16), 
                toEthAddr: exitEthAddr, toAx: exitAx, toAy: exitAy});
                
            expect(res.toString()).to.be.equal(hashOnchainData.toString());
        });
        
        it("Build on chain hash", async () => {            
            const res = await insHelpers.buildOnChainHashTest(oldOnChainHash,
                txData.toString(), loadAmount, hashOnchainData.toString(), fromEthAddr);

            let onChainJs = helpers.buildhashOnChain(oldOnChainHash,
                txData, loadAmount, Scalar.fromString(hashOnchainData.toString()), Scalar.e(fromEthAddr));

            expect(res[0]).to.be.equal(onChainJs.e0);
            expect(res[1]).to.be.equal(onChainJs.e1);
            expect(res[2]).to.be.equal(onChainJs.e2);
            expect(res[3]).to.be.equal(onChainJs.e3);
            expect(res[4]).to.be.equal(onChainJs.e4);

        });

        it("hash on chain hash", async () => {            
            const res = await insHelpers.hashOnChainHashTest(oldOnChainHash,
                txData.toString(), loadAmount, hashOnchainData.toString(), fromEthAddr);

            onChainHash = helpers.hashOnChain(oldOnChainHash,
                txData, loadAmount, hashOnchainData.toString(), fromEthAddr);
                
            expect( Scalar.e(res).toString()).to.be.equal(onChainHash.toString());
        });

        it("helpers and batchbuilder must have the same results", async () => { 

            // necessary variables in order to be equal to batchbuilder
            let amount = 0; 
            let oldOnChainHash = 0;
            let nonce = 0;
            let fee = 0;
            let rqOffset = 0;
            const tx = {
                IDEN3_ROLLUP_TX,
                amount,
                loadAmount,
                coin,
                fromAx: fromAx.toString(16),
                fromAy: fromAy.toString(16),
                fromEthAddr,
                toAx: exitAx,
                toAy: exitAy,
                toEthAddr: exitEthAddr,
                onChain: true
            };
            let db = new SMTMemDB();
            let rollupDB = await RollupDB(db);

            const batch = await rollupDB.buildBatch(8, 8);
            batch.addTx(tx);
            await batch.build();
            let hashBatchbuilder = batch.getOnChainHash();

            const txData = await insHelpers.buildTxDataTest(amount, coin,
                nonce, fee, rqOffset, onChain, newAccount);
                
            const hashSC = await insHelpers.buildAndHashOnChain(fromEthAddr,
                fromAx.toString(), fromAy.toString(), exitEthAddr, exitAx, exitAy, 
                oldOnChainHash, txData.toString(), loadAmount);
    
            expect(Scalar.e(hashSC).toString()).to.be.equal(hashBatchbuilder.toString());
        });

        it("encode and decode offchain deposit", async () => { 
            const fromAx = Scalar.e(30890499764467592830739030727222305800976141688008169211302).toString(16);
            const fromAy = Scalar.e(19826930437678088398923647454327426275321075228766562806246).toString(16);
            const fromEthAddr = "0xe0fbce58cfaa72812103f003adce3f284fe5fc7c";
            const coin = 3;

            const depositOffchain ={
                fromAx,
                fromAy,
                fromEthAddr,
                coin
            };

            const encodedDeposits = utils.encodeDepositOffchain([depositOffchain]);
            const decodedOffchainDeposit = await insHelpers.decodeOffchainDepositTest(encodedDeposits);

            expect(decodedOffchainDeposit[0].toString(16)).to.be.equal(fromAx);
            expect(decodedOffchainDeposit[1].toString(16)).to.be.equal(fromAy);
            expect(Scalar.e(decodedOffchainDeposit[2])).to.be.equal(Scalar.e(fromEthAddr));
            expect(decodedOffchainDeposit[3].toString()).to.be.equal(coin.toString());
        });

        it("Should update onchain fees properly", async () => {
            const currentOnchainFee = web3.utils.toWei("0.01", "ether");
            const moreFeeJs = Scalar.div( Scalar.mul( Scalar.fromString(currentOnchainFee), 100722), 100000);
            const lessFeeJs = Scalar.div( Scalar.mul( Scalar.fromString(currentOnchainFee), 100000), 100722);

            const sameFeeSC = await insHelpers.updateOnchainFeeTest(10, currentOnchainFee); 
            const moreFeeSC = await insHelpers.updateOnchainFeeTest(11, currentOnchainFee); 
            const lessFeeSC = await insHelpers.updateOnchainFeeTest(9, currentOnchainFee); 

            expect(Scalar.fromString(currentOnchainFee)).to.be.equal(Scalar.e(sameFeeSC));
            expect(moreFeeJs).to.be.equal(Scalar.e(moreFeeSC));
            expect(lessFeeJs).to.be.equal(Scalar.e(lessFeeSC));
        });

        it("Should update deposit fees properly", async () => {

            const currentDepositMul = web3.utils.toWei("0.001", "ether");

            const moreFee = await insHelpers.udateDepositFeeTest(1, currentDepositMul);

            expect(Scalar.div(Scalar.mul(Scalar.fromString(currentDepositMul), 10000008235), 10**10)).to.be.equal(Scalar.e(moreFee));

            const deposits = 1000;

            // 1.0000005 = 10000005 * 10**-7
            // 1.0000005^x = 10000005^x * (10**-7)^x
            const depositMulJs = 
            Scalar.div( 
                Scalar.mul(
                    Scalar.fromString(currentDepositMul),
                    Scalar.pow(10000008235, deposits)
                ),
                Scalar.pow(10**10, deposits)
            ); 

            // gas consumption 131171
            console.log("gas consumed by update fees of 1000 tx", 
                (await insHelpers.udateDepositFeeTest.estimateGas(deposits, currentDepositMul)).toString());
            const Fee1000Deposits = await insHelpers.udateDepositFeeTest(deposits, currentDepositMul);
    
            // ethereum loses precision, thats why we don't count the last 4 decimals
            console.log(Fee1000Deposits.toString());
            expect(Scalar.div(depositMulJs, 10**4)).to.be.equal(Scalar.div(Fee1000Deposits, 10**4));

        });
    });
});
