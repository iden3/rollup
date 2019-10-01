/* eslint-disable no-underscore-dangle */
/* global artifacts */
/* global contract */
/* global web3 */
/* global BigInt */

const chai = require("chai");
const RollupTree = require("../../rollup-utils/rollup-tree");
const utils = require("../../rollup-utils/utils");
const rollupUtils = require("../../rollup-utils/rollup-utils.js");
const { BabyJubWallet } = require("../../rollup-utils/babyjub-wallet");

const { expect } = chai;
const poseidonUnit = require("circomlib/src/poseidon_gencontract");

const TokenRollup = artifacts.require("../contracts/test/TokenRollup");
const Verifier = artifacts.require("../contracts/test/VerifierHelper");
const StakerManager = artifacts.require("../contracts/RollupPoS");
const RollupTest = artifacts.require("../contracts/test/RollupTest");

const abiDecoder = require("abi-decoder");
abiDecoder.addABI(RollupTest.abi);

const RollupDB = require("../../js/rollupdb");
const SMTMemDB = require("circomlib/src/smt_memdb");

function buildInputSm(bb, beneficiary) {
    return {
        oldStateRoot: bb.getInput().oldStRoot.toString(),
        newStateRoot: bb.getNewStateRoot().toString(),
        newExitRoot: bb.getNewExitRoot().toString(),
        onChainHash: bb.getOnChainHash().toString(),
        feePlan: rollupUtils.buildFeeInputSm(bb.feePlan),
        compressedTx: `0x${bb.getDataAvailable().toString("hex")}`,
        offChainHash: bb.getOffChainHash().toString(),
        nTxPerToken: bb.getCountersOut().toString(),
        beneficiary: beneficiary
    };
}

function manageEvent(event) {
    if (event.event == "OnChainTx") {
        const txData = rollupUtils.decodeTxData(event.args.txData);
        return {
            fromIdx: txData.fromId,
            toIdx: txData.toId,
            amount: txData.amount,
            loadAmount: BigInt(event.args.loadAmount),
            coin: txData.tokenId,
            ax: BigInt(event.args.Ax).toString(16),
            ay: BigInt(event.args.Ay).toString(16),
            ethAddress: BigInt(event.args.ethAddress).toString(),
            onChain: true
        };
    }
}

contract("Rollup", (accounts) => { 

    async function forgeBlock(events = undefined) {
        const block = await rollupDB.buildBatch(maxTx, nLevels);
        if (events) {
            events.forEach(elem => {
                block.addTx(manageEvent(elem));
            });
        }
        await block.build();
        const inputSm = buildInputSm(block, beneficiary);
        await insRollupTest.forgeBatchTest(inputSm.oldStateRoot, inputSm.newStateRoot, inputSm.newExitRoot,
            inputSm.onChainHash, inputSm.feePlan, inputSm.compressedTx, inputSm.offChainHash, inputSm.nTxPerToken,
            inputSm.beneficiary);
        await rollupDB.consolidate(block);
    }

    function checkBatchNumber(events) {
        events.forEach(elem => {
            const eventBatch = BigInt(elem.args.batchNumber); 
            expect(eventBatch.add(BigInt(2)).toString()).to.be.equal(BigInt(rollupDB.lastBlock).toString());
        });
    }

    const maxTx = 10;
    const maxOnChainTx = 3;
    const nLevels = 24;
    let db;
    let rollupDB;

    let exitTree;

    let insPoseidonUnit;
    let insTokenRollup;
    let insStakerManager;
    let insRollupTest;
    let insVerifier;

    // BabyJubjub public key
    const mnemonic = "urban add pulse prefer exist recycle verb angle sell year more mosquito";
    const wallet = BabyJubWallet.fromMnemonic(mnemonic);
    const Ax = wallet.publicKey[0].toString();
    const Ay = wallet.publicKey[1].toString();

    // tokenRollup initial amount
    const tokenInitialAmount = 100;

    const {
        0: owner,
        1: id1,
        2: id2,
        3: id3,
        4: tokenList,
        5: beneficiary,
    } = accounts;

    before(async () => {
        // Deploy poseidon
        const C = new web3.eth.Contract(poseidonUnit.abi);
        insPoseidonUnit = await C.deploy({ data: poseidonUnit.createCode() })
            .send({ gas: 2500000, from: owner });

        // Deploy TokenRollup
        insTokenRollup = await TokenRollup.new(id1, tokenInitialAmount);

        // Deploy Verifier
        insVerifier = await Verifier.new();

        // Deploy Rollup test
        insRollupTest = await RollupTest.new(insVerifier.address, insPoseidonUnit._address,
            maxTx, maxOnChainTx);

        // Deploy Staker manager
        insStakerManager = await StakerManager.new(insRollupTest.address);
        
        // init rollup database
        db = new SMTMemDB();
        rollupDB = await RollupDB(db);
        exitTree = await RollupTree.newMemRollupTree();
    });

    it("Check ganache provider", async () => {
        if (accounts.length < 12) {
            throw new Error("launch ganache with more than 12 accounts:\n\n `ganache-cli -a 20`");
        }
    });

    it("Load forge batch mechanism", async () => {
        await insRollupTest.loadForgeBatchMechanism(insStakerManager.address);
        try {
            await insRollupTest.loadForgeBatchMechanism(insStakerManager.address, { from: id1 });
        } catch (error) {
            expect((error.message).includes("caller is not the owner")).to.be.equal(true);
        }
    });

    it("Distribute token rollup", async () => {
        await insTokenRollup.transfer(id2, 25, { from: id1 });
        await insTokenRollup.transfer(id3, 25, { from: id1 });
    });

    it("Rollup token listing", async () => {
    // Check balances token
        const resOwner = await insTokenRollup.balanceOf(owner);
        const resId1 = await insTokenRollup.balanceOf(id1);
        expect(resOwner.toString()).to.be.equal("0");
        expect(resId1.toString()).to.be.equal("50");

        // Add token to rollup token list
        const resAddToken = await insRollupTest.addToken(insTokenRollup.address,
            { from: tokenList, value: web3.utils.toWei("1", "ether") });

        expect(resAddToken.logs[0].event).to.be.equal("AddToken");
        expect(resAddToken.logs[0].args.tokenAddress).to.be.equal(insTokenRollup.address);
        expect(resAddToken.logs[0].args.tokenId.toString()).to.be.equal("0");
    });

    it("Check token address", async () => {
    // Check token address
        const resTokenAddress = await insRollupTest.getTokenAddress(0);
        expect(resTokenAddress).to.be.equal(insTokenRollup.address);
    });

    it("Should add deposit", async () => {
    // Steps:
    // - Transaction to deposit 'TokenRollup' from 'id1' to 'rollup smart contract'(owner)
    // - Check 'tokenRollup' balances
    // - Get event data
    // - Update rollupTree
    // - forge blocks to include deposit

        const loadAmount = 10;
        const tokenId = 0;

        const resApprove = await insTokenRollup.approve(insRollupTest.address, loadAmount, { from: id1 });
        expect(resApprove.logs[0].event).to.be.equal("Approval");

        const resDeposit = await insRollupTest.deposit(loadAmount, tokenId, id1,
            [Ax, Ay], { from: id1, value: web3.utils.toWei("1", "ether") });
        expect(resDeposit.logs[0].event).to.be.equal("OnChainTx");

        // Check token balances for id1 and rollup smart contract
        const resRollup = await insTokenRollup.balanceOf(insRollupTest.address);
        const resId1 = await insTokenRollup.balanceOf(id1);
        expect(resRollup.toString()).to.be.equal("10");
        expect(resId1.toString()).to.be.equal("40");

        // forge genesis block
        await forgeBlock();

        // Forge block with deposit transaction
        await forgeBlock([resDeposit.logs[0]]);

        checkBatchNumber([resDeposit.logs[0]]);
    });

    it("Should add two deposits", async () =>{
        const loadAmount = 5;
        const tokenId = 0;

        await insTokenRollup.approve(insRollupTest.address, loadAmount, { from: id2 });
        await insTokenRollup.approve(insRollupTest.address, loadAmount, { from: id3 });

        const resDepositId2 = await insRollupTest.deposit(loadAmount, tokenId, id2,
            [Ax, Ay], { from: id2, value: web3.utils.toWei("1", "ether") });
        const resDepositId3 = await insRollupTest.deposit(loadAmount, tokenId, id3,
            [Ax, Ay], { from: id3, value: web3.utils.toWei("1", "ether") });
        
        // Check token balances for id1 and rollup smart contract
        const resRollup = await insTokenRollup.balanceOf(insRollupTest.address);
        const resId1 = await insTokenRollup.balanceOf(id1);
        const resId2 = await insTokenRollup.balanceOf(id2);
        const resId3 = await insTokenRollup.balanceOf(id3);
        expect(resRollup.toString()).to.be.equal("20");
        expect(resId1.toString()).to.be.equal("40");
        expect(resId2.toString()).to.be.equal("20");
        expect(resId3.toString()).to.be.equal("20");

        // forge block with no transactions
        await forgeBlock();

        // forge block two deposits
        await forgeBlock([resDepositId2.logs[0], resDepositId3.logs[0]]);

        checkBatchNumber([resDepositId2.logs[0], resDepositId3.logs[0]]);
    });

    it("Should add force withdraw", async () => {
    // Steps:
    // - Transaction to force wothdraw 'TokenRollup' from 'id1' to 'rollup smart contract'(owner)
    // - Check 'tokenRollup' balances
    // - Get event data
    // - Update rollupTree
    // - forge blocks to include force withdraw
    // - it creates an exit root, it is created
        const from = 1;
        const amount = 8;
        // Should trigger error since id2 is the sender, does not match id1
        try {
            await insRollupTest.forceWithdraw(from, amount, [Ax, Ay],
                { from: id2, value: web3.utils.toWei("1", "ether") });
        }
        catch (error) {
            expect((error.message).includes("Sender does not match identifier balance tree")).to.be.equal(true);
        }

        const resForceWithdraw = await insRollupTest.forceWithdraw(from, amount, [Ax, Ay],
            { from: id1, value: web3.utils.toWei("1", "ether") });

        // forge block with no transactions
        await forgeBlock();
        // forge block force withdraw
        await forgeBlock([resForceWithdraw.logs[0]]);

        // Simulate exit tree to retrieve siblings
        await exitTree.addId(1, amount, 0, BigInt(Ax), BigInt(Ay), BigInt(id1), 0);

        checkBatchNumber([resForceWithdraw.logs[0]]);
    });

    it("Should withdraw tokens", async () => {
    // Steps:
    // - Get data from 'exitTree'
    // - Transaction to withdraw amount indicated in previous step
        const id = 1;

        const infoId = await exitTree.getIdInfo(id);
        const siblingsId = utils.arrayBigIntToArrayStr(infoId.siblings);

        const leafId = infoId.foundObject;
        // last block forged
        const lastBlock = await insRollupTest.getStateDepth();
        // Should trigger error since we are try get withdraw from different sender
        try {
            await insRollupTest.withdraw(id, leafId.balance.toString(), leafId.tokenId.toString(),
                BigInt(lastBlock).toString(), leafId.nonce.toString(),[leafId.Ax.toString(), leafId.Ay.toString()],
                siblingsId, { from: id2 });
        } catch (error) {
            expect((error.message).includes("invalid proof")).to.be.equal(true);
        }
        // send withdraw transaction
        await insRollupTest.withdraw(id, leafId.balance.toString(), leafId.tokenId.toString(),
            BigInt(lastBlock).toString(), leafId.nonce.toString(),[leafId.Ax.toString(), leafId.Ay.toString()],
            siblingsId, { from: id1 });
        // Should trigger error since we are repeating the withdraw transaction
        try {
            await insRollupTest.withdraw(id, leafId.balance.toString(), leafId.tokenId.toString(),
                BigInt(lastBlock).toString(), leafId.nonce.toString(),[leafId.Ax.toString(), leafId.Ay.toString()],
                siblingsId, { from: id1 });
        } catch (error) {
            expect((error.message).includes("withdraw has been already done")).to.be.equal(true);
        }

        // Check token balances for id1 and rollup smart contract
        const resRollup = await insTokenRollup.balanceOf(insRollupTest.address);
        const resId1 = await insTokenRollup.balanceOf(id1);
        expect(resRollup.toString()).to.be.equal("12");
        expect(resId1.toString()).to.be.equal("48");
    });

    it("Should add deposit on top", async () => {
    // Steps:
    // - Transaction to deposit 'TokenRollup' to 'id3'
    // - Check 'tokenRollup' balances
    // - Get event data
    // - Update rollupTree
    // - forge blocks to include deposit on top
        const toId = 3;
        const onTopAmount = 3;
        const tokenId = 0;

        const resApprove = await insTokenRollup.approve(insRollupTest.address, onTopAmount, { from: id1 });
        expect(resApprove.logs[0].event).to.be.equal("Approval");

        const resDepositOnTop = await insRollupTest.depositOnTop(toId, onTopAmount, tokenId,
            { from: id1, value: web3.utils.toWei("1", "ether") });

        // Check token balances for id1 and rollup smart contract
        const resRollup = await insTokenRollup.balanceOf(insRollupTest.address);
        const resId1 = await insTokenRollup.balanceOf(id1);
        expect(resRollup.toString()).to.be.equal("15");
        expect(resId1.toString()).to.be.equal("45");

        // forge empty block
        await forgeBlock();
        // forge block with deposit on top transaction
        await forgeBlock([resDepositOnTop.logs[0]]);

        checkBatchNumber([resDepositOnTop.logs[0]]);
    });

    it("Should add transfer", async () => {
    // Steps:
    // - Transaction from 'id2' to 'id3'
    // - Get event data
    // - Update rollupTree
    // - forge blocks to include transaction
        const fromId = 2;
        const toId = 3;
        const amount = 1;
        const tokenId = 0;

        const resTransfer = await insRollupTest.transfer(fromId, toId, amount, tokenId,
            [Ax, Ay], { from: id2, value: web3.utils.toWei("1", "ether") });

        // forge empty block
        await forgeBlock();
        // forge block with deposit on top transaction
        await forgeBlock([resTransfer.logs[0]]);

        checkBatchNumber([resTransfer.logs[0]]);
    });

    it("Should forge off-chain transaction with fee", async () => {
    // Steps:
    // - Transaction from 'id3' to 'id2'
    // - Update rollupTree
    // - forge block to include transaction
    // - Check blovk number information, balance of beneficiary and batch number
        const tx = {
            fromIdx: 3,
            toIdx: 2,
            coin: 0,
            amount: 3,
            nonce: 0,
            userFee: 1
        };
        rollupUtils.signRollupTx(wallet, tx);
        const block = await rollupDB.buildBatch(maxTx, nLevels);
        block.addTx(tx);
        // Add fee
        block.addCoin(0, 1);
        block.addCoin(1, 5);
        await block.build();
        const inputSm = buildInputSm(block, beneficiary);
        const balanceBefore = await insTokenRollup.balanceOf(beneficiary);

        const resForge = await insRollupTest.forgeBatchTest(inputSm.oldStateRoot, inputSm.newStateRoot, inputSm.newExitRoot,
            inputSm.onChainHash, inputSm.feePlan, inputSm.compressedTx, inputSm.offChainHash, inputSm.nTxPerToken,
            inputSm.beneficiary);
        await rollupDB.consolidate(block);

        const balanceAfter = await insTokenRollup.balanceOf(beneficiary);
        expect(BigInt(balanceBefore).add(BigInt(1)).toString()).to.be.equal(BigInt(balanceAfter).toString());
        expect(resForge.logs[0].event).to.be.equal("ForgeBatch");
        
        // Off-chain are included next bacth forged
        expect(BigInt(rollupDB.lastBlock).toString()).to.be.equal(BigInt(resForge.logs[0].args.batchNumber).add(BigInt(1)).toString());
        // Recover calldata information from forgeBatch event
        const blockNumber = resForge.logs[0].args.blockNumber.toString();
        const transaction = await web3.eth.getTransactionFromBlock(blockNumber, 0);
        const decodedData = abiDecoder.decodeMethod(transaction.input);
        let inputRetrieved;
        decodedData.params.forEach(elem => {
            if (elem.name == "compressedTxs") {
                inputRetrieved = elem.value;
            }
        });
        expect(inputSm.compressedTx).to.be.equal(inputRetrieved);
    });
});