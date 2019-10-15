/* eslint-disable no-underscore-dangle */
/* global artifacts */
/* global contract */
/* global web3 */
/* global BigInt */

const chai = require("chai");
const RollupTree = require("../../rollup-utils/rollup-tree");
const utils = require("../../rollup-utils/utils");
const { buildInputSm } = require("../../rollup-operator/src/utils");
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

const proofA = ["0", "0"];
const proofB = [["0", "0"], ["0", "0"]];
const proofC = ["0", "0"];

function buildFullInputSm(bb, beneficiary) {
    const input = buildInputSm(bb);
    return {
        beneficiary: beneficiary,
        proofA,
        proofB,
        proofC,
        input,
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

    async function forgeBatch(events = undefined) {
        const batch = await rollupDB.buildBatch(maxTx, nLevels);
        if (events) {
            events.forEach(elem => {
                batch.addTx(manageEvent(elem));
            });
        }
        await batch.build();
        const inputSm = buildFullInputSm(batch, beneficiary);
        await insRollupTest.forgeBatch(inputSm.beneficiary, inputSm.proofA,
            inputSm.proofB, inputSm.proofC, inputSm.input);
        await rollupDB.consolidate(batch);
    }

    function checkBatchNumber(events) {
        events.forEach(elem => {
            const eventBatch = BigInt(elem.args.batchNumber);
            expect(eventBatch.add(BigInt(2)).toString()).to.be.equal(BigInt(rollupDB.lastBatch).toString());
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
        insStakerManager = await StakerManager.new(insRollupTest.address, maxTx);
        
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
    // - forge batches to include deposit

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

        // forge genesis batch
        await forgeBatch();

        // Forge batch with deposit transaction
        await forgeBatch([resDeposit.logs[0]]);
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

        // forge batch with no transactions
        await forgeBatch();
        
        // forge batch two deposits
        await forgeBatch([resDepositId2.logs[0], resDepositId3.logs[0]]);

        checkBatchNumber([resDepositId2.logs[0], resDepositId3.logs[0]]);
    });

    it("Should add force withdraw", async () => {
    // Steps:
    // - Transaction to force wothdraw 'TokenRollup' from 'id1' to 'rollup smart contract'(owner)
    // - Check 'tokenRollup' balances
    // - Get event data
    // - Update rollupTree
    // - forge batches to include force withdraw
    // - it creates an exit root, it is created
        const from = 1;
        const amount = 8;
        // Should trigger error since id2 is the sender, does not match id1
        try {
            await insRollupTest.forceWithdraw(from, amount,
                { from: id2, value: web3.utils.toWei("1", "ether") });
        }
        catch (error) {
            expect((error.message).includes("Sender does not match identifier balance tree")).to.be.equal(true);
        }

        const resForceWithdraw = await insRollupTest.forceWithdraw(from, amount,
            { from: id1, value: web3.utils.toWei("1", "ether") });

        // forge batch with no transactions
        await forgeBatch();
        // forge batch force withdraw
        await forgeBatch([resForceWithdraw.logs[0]]);

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
        // last batch forged
        const lastBatch = await insRollupTest.getStateDepth();
        // Should trigger error since we are try get withdraw from different sender
        try {
            await insRollupTest.withdraw(id, leafId.balance.toString(), leafId.tokenId.toString(),
                BigInt(lastBatch).toString(), leafId.nonce.toString(),
                siblingsId, { from: id2 });
        } catch (error) {
            expect((error.message).includes("invalid proof")).to.be.equal(true);
        }
        // send withdraw transaction
        await insRollupTest.withdraw(id, leafId.balance.toString(), leafId.tokenId.toString(),
            BigInt(lastBatch).toString(), leafId.nonce.toString(),
            siblingsId, { from: id1 });
        // Should trigger error since we are repeating the withdraw transaction
        try {
            await insRollupTest.withdraw(id, leafId.balance.toString(), leafId.tokenId.toString(),
                BigInt(lastBatch).toString(), leafId.nonce.toString(),
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
    // - forge batches to include deposit on top
        const toId = 3;
        const onTopAmount = 3;
        const tokenId = 0;

        let initialBalanceId3 = await rollupDB.getStateByIdx(3);
        expect(initialBalanceId3.amount.toString()).to.be.equal("5");

        const resApprove = await insTokenRollup.approve(insRollupTest.address, onTopAmount, { from: id1 });
        expect(resApprove.logs[0].event).to.be.equal("Approval");

        const resDepositOnTop = await insRollupTest.depositOnTop(toId, onTopAmount, tokenId,
            { from: id1, value: web3.utils.toWei("1", "ether") });

        // Check token balances for id1 and rollup smart contract
        const resRollup = await insTokenRollup.balanceOf(insRollupTest.address);
        const resId1 = await insTokenRollup.balanceOf(id1);
        expect(resRollup.toString()).to.be.equal("15");
        expect(resId1.toString()).to.be.equal("45");

        // forge empty batch
        await forgeBatch();
        // forge batch with deposit on top transaction
        await forgeBatch([resDepositOnTop.logs[0]]);

        checkBatchNumber([resDepositOnTop.logs[0]]);

        let finalBalanceId3 = await rollupDB.getStateByIdx(3);//new leaf
        expect(finalBalanceId3.amount.toString()).to.be.equal((parseInt(initialBalanceId3.amount.toString())+onTopAmount).toString());
    });

    it("Should add transfer", async () => {
    // Steps:
    // - Transaction from 'id2' to 'id3'
    // - Get event data
    // - Update rollupTree
    // - forge batches to include transaction

        //current leaf 2: 5, tokens leaf 3: 8 tokens
        //after leaf 2: 4, tokens leaf 3: 9 tokens
        const fromId = 2;
        const toId = 3;
        const amount = 1;
        const tokenId = 0;

        let initialBalanceId2 = await rollupDB.getStateByIdx(2);
        let initialBalanceId3 = await rollupDB.getStateByIdx(3);

        expect(initialBalanceId2.amount.toString()).to.be.equal("5");
        expect(initialBalanceId3.amount.toString()).to.be.equal("8");

        const resTransfer = await insRollupTest.transfer(fromId, toId, amount, tokenId,
            { from: id2, value: web3.utils.toWei("1", "ether") });

        // forge empty batch
        await forgeBatch();
        // forge batch with deposit on top transaction
        await forgeBatch([resTransfer.logs[0]]);

        checkBatchNumber([resTransfer.logs[0]]);

        let finalBalanceId2 = await rollupDB.getStateByIdx(2);
        let finalBalanceId3 = await rollupDB.getStateByIdx(3);

        expect(finalBalanceId2.amount.toString()).to.be.equal((parseInt(initialBalanceId2.amount.toString())-amount).toString());
        expect(finalBalanceId3.amount.toString()).to.be.equal((parseInt(initialBalanceId3.amount.toString())+amount).toString());
    });

    it("Should add DepositAndTransfer", async () => {

        //current Tokens: id1: 45, rollupSc: 15, leaf 2: 4 tokens
        //after this test: id1: 33, rollupSc 27, leaf 2: 14 tokens
        const toId = 2;
        const loadAmount = 12;
        const tokenId = 0;
        const amount = 10;

        let initialBalanceId2 = await rollupDB.getStateByIdx(2);
        expect(initialBalanceId2.amount.toString()).to.be.equal("4");

        const resApprove = await insTokenRollup.approve(insRollupTest.address, loadAmount, { from: id1 });
        expect(resApprove.logs[0].event).to.be.equal("Approval");

        const resDepositAndTransfer = await insRollupTest.depositAndTransfer(loadAmount, tokenId, id1,
            [Ax, Ay], toId, amount, { from: id1, value: web3.utils.toWei("1", "ether") });
        expect(resDepositAndTransfer.logs[0].event).to.be.equal("OnChainTx");

        // Check token balances for id1 and rollup smart contract
        const resRollup = await insTokenRollup.balanceOf(insRollupTest.address);
        const resId1 = await insTokenRollup.balanceOf(id1);
        expect(resRollup.toString()).to.be.equal("27");
        expect(resId1.toString()).to.be.equal("33");

        // forge genesis batch
        await forgeBatch();
        // Forge batch with deposit transaction
        await forgeBatch([resDepositAndTransfer.logs[0]]);
        
        checkBatchNumber([resDepositAndTransfer.logs[0]]);

        let finalBalanceId2 = await rollupDB.getStateByIdx(2);
        let finalBalanceId4 = await rollupDB.getStateByIdx(4);//new leaf

        expect(finalBalanceId2.amount.toString()).to.be.equal((parseInt(initialBalanceId2.amount.toString())+amount).toString());
        expect(finalBalanceId4.amount.toString()).to.be.equal((loadAmount-amount).toString());
    });


    it("Should add force withdraw2", async () => {
        // Steps:
        // - Transaction to force wothdraw 'TokenRollup' from 'id2' to 'rollup smart contract'(owner)
        // - Check 'tokenRollup' balances
        // - Get event data
        // - Update rollupTree
        // - forge batches to include force withdraw
        // - it creates a new exit tree
        exitTree = await RollupTree.newMemRollupTree();
        const from = 2;
        const amount = 14;
    
        const resForceWithdraw = await insRollupTest.forceWithdraw(from, amount,
            { from: id2, value: web3.utils.toWei("1", "ether") });
    
        // forge batch with no transactions
        await forgeBatch();
        // forge batch force withdraw
        await forgeBatch([resForceWithdraw.logs[0]]);
    
        // Simulate exit tree to retrieve siblings
        await exitTree.addId(2, amount, 0, BigInt(Ax), BigInt(Ay), BigInt(id2), 0);
        //await exitTree.addIdExit(2, amount, 0, BigInt(id2));
        checkBatchNumber([resForceWithdraw.logs[0]]);
    });
    
    it("Should withdraw tokens2", async () => {
        // Steps:
        // - Get data from 'exitTree'
        // - Transaction to withdraw amount indicated in previous step
        const id = 2;
        const infoId = await exitTree.getIdInfo(id);
        const siblingsId = utils.arrayBigIntToArrayStr(infoId.siblings);
        const leafId = infoId.foundObject;
        // last batch forged
        const lastBatch = await insRollupTest.getStateDepth();
        // Should trigger error since we are try get withdraw from different sender
        await insRollupTest.withdraw(id, leafId.balance.toString(), leafId.tokenId.toString(),
            BigInt(lastBatch).toString(), leafId.nonce.toString(),
            siblingsId, { from: id2 });
        // Should trigger error since we are repeating the withdraw transaction
    
        // Check token balances for id1 and rollup smart contract
        const resRollup = await insTokenRollup.balanceOf(insRollupTest.address);
        //const resId2 = await insTokenRollup.balanceOf(id1);
        expect(resRollup.toString()).to.be.equal("13");
        //expect(resId2.toString()).to.be.equal("48");
    });
    
    
    it("Should forge off-chain transaction with fee", async () => {
    // Steps:
    // - Transaction from 'id3' to '0' -->forcewithdraw offchain
    // - Update rollupTree
    // - forge batch to include transaction
    // - Check block number information, balance of beneficiary and batch number
    // - Test double withdraw in the same batch

        //current Tokens: leaf 3: 9 tokens
        //after this test: leaf 4: 5 tokens
        let initialBalanceId3 = await rollupDB.getStateByIdx(3);
        expect(initialBalanceId3.amount.toString()).to.be.equal("9");

        exitTree = await RollupTree.newMemRollupTree();
        const tx = {
            fromIdx: 3,
            toIdx: 0,
            coin: 0,
            amount: 1,
            nonce: 0,
            userFee: 1
        };
        await exitTree.addId(3, 1, 0, BigInt(Ax), BigInt(Ay), BigInt(id3), BigInt(0));
        const tx2 = {
            fromIdx: 3,
            toIdx: 0,
            coin: 0,
            amount: 1,
            nonce: 1,
            userFee: 1
        };
        await exitTree.updateId(3, 2);
        rollupUtils.signRollupTx(wallet, tx);
        rollupUtils.signRollupTx(wallet, tx2);
        const batch = await rollupDB.buildBatch(maxTx, nLevels);
        batch.addTx(tx);
        batch.addTx(tx2);
        // Add fee
        batch.addCoin(0, 1);
        batch.addCoin(1, 5);
        await batch.build();
        const inputSm = buildFullInputSm(batch, beneficiary);
        const balanceBefore = await insTokenRollup.balanceOf(beneficiary);
        const resForge = await insRollupTest.forgeBatch(inputSm.beneficiary, inputSm.proofA,
            inputSm.proofB, inputSm.proofC, inputSm.input);
        await rollupDB.consolidate(batch);

        const balanceAfter = await insTokenRollup.balanceOf(beneficiary);
        expect(BigInt(balanceBefore).add(BigInt(2)).toString()).to.be.
            equal(BigInt(balanceAfter).toString());
        expect(resForge.logs[0].event).to.be.equal("ForgeBatch");
        
        // Off-chain are included next bacth forged
        expect(BigInt(rollupDB.lastBatch).toString()).to.be.
            equal(BigInt(resForge.logs[0].args.batchNumber).add(BigInt(1)).toString());
        // Recover hash off-chain from calldata
        // note: data compressedTx will be available on forge Batch Mechanism
        const blockNumber = resForge.logs[0].args.blockNumber.toString();
        const transaction = await web3.eth.getTransactionFromBlock(blockNumber, 0);
        const decodedData = abiDecoder.decodeMethod(transaction.input);
        let inputRetrieved;
        decodedData.params.forEach(elem => {
            if (elem.name == "input") {
                inputRetrieved = elem.value;
            }
        });
        // Off-chain hash is 4th position of the input
        expect(inputSm.input[4]).to.be.equal(inputRetrieved[4]);

        let finalBalanceId3 = await rollupDB.getStateByIdx(3);
        expect(finalBalanceId3.amount.toString()).to.be.equal((parseInt(initialBalanceId3.amount.toString())-4).toString()); //2 fees + 2 amountTransfer = 4
    });

    it("Should withdraw previous offchain transactions", async () => {
        // Steps:
        // - Get data from 'exitTree'
        // - Transaction to withdraw amount indicated in previous step
      
        //current Tokens: id3: 20 tokens
        //after this test: id3: 22 tokens
        const id = 3;
        const infoId = await exitTree.getIdInfo(id);
        const siblingsId = utils.arrayBigIntToArrayStr(infoId.siblings);
        const leafId = infoId.foundObject;
        // last batch forged
        const lastBatch = await insRollupTest.getStateDepth();
        // Should trigger error since we are try get withdraw from different sender
        await insRollupTest.withdraw(id, leafId.balance.toString(), leafId.tokenId.toString(),
            BigInt(lastBatch).toString(), leafId.nonce.toString(),
            siblingsId, { from: id3 });
        // Should trigger error since we are repeating the withdraw transaction
    
        // Check token balances for id1 and rollup smart contract
        const resRollup = await insTokenRollup.balanceOf(insRollupTest.address);
        const resId3 = await insTokenRollup.balanceOf(id3);
        expect(resRollup.toString()).to.be.equal("9"); //13-4; 2 2fees + 2 withdraw
        expect(resId3.toString()).to.be.equal("22");
    });
    
    it("Should DepositAndTransferto 0", async () => {
        //leaf: 5
        //current Tokens: leaf 5: undefined, id3: 22 tokens
        //after this test: leaf 5: 3 tokens, id3: 14 tokens
        const toId = 0;
        const loadAmount = 8;
        const tokenId = 0;
        const amount = 5;
        exitTree = await RollupTree.newMemRollupTree();

        const resApprove = await insTokenRollup.approve(insRollupTest.address, loadAmount, { from: id3 });
        expect(resApprove.logs[0].event).to.be.equal("Approval");

        const resDepositAndTransfer = await insRollupTest.depositAndTransfer(loadAmount, tokenId, id3,
            [Ax, Ay], toId, amount, { from: id3, value: web3.utils.toWei("1", "ether") });
        expect(resDepositAndTransfer.logs[0].event).to.be.equal("OnChainTx");

        // Check token balances for id1 and rollup smart contract
        const resRollup = await insTokenRollup.balanceOf(insRollupTest.address);
        const resId3 = await insTokenRollup.balanceOf(id3);
        expect(resRollup.toString()).to.be.equal("17");
        expect(resId3.toString()).to.be.equal("14");

        // forge genesis batch
        await forgeBatch();
        // Forge batch with deposit transaction
        await forgeBatch([resDepositAndTransfer.logs[0]]);
        
        checkBatchNumber([resDepositAndTransfer.logs[0]]);

        let finalBalanceId5 = await rollupDB.getStateByIdx(5);//new leaf
        expect(finalBalanceId5.amount.toString()).to.be.equal("3");

        await exitTree.addId(5, 5, 0, BigInt(Ax), BigInt(Ay), BigInt(id3), BigInt(0));
    });


    it("Should withdraw depositAndTransfer", async () => {
        // Steps:
        // - Get data from 'exitTree'
        // - Transaction to withdraw amount indicated in previous step
      
        //current Tokens: id3: 14 tokens
        //after this test: id3: 19 tokens
        const id = 5;
        const infoId = await exitTree.getIdInfo(id);
        const siblingsId = utils.arrayBigIntToArrayStr(infoId.siblings);
        const leafId = infoId.foundObject;
        // last batch forged
        const lastBatch = await insRollupTest.getStateDepth();
        // Should trigger error since we are try get withdraw from different sender
        await insRollupTest.withdraw(id, leafId.balance.toString(), leafId.tokenId.toString(),
            BigInt(lastBatch).toString(), leafId.nonce.toString(),
            siblingsId, { from: id3 });
        // Should trigger error since we are repeating the withdraw transaction
    
        // Check token balances for id1 and rollup smart contract
        const resRollup = await insTokenRollup.balanceOf(insRollupTest.address);
        const resId3 = await insTokenRollup.balanceOf(id3);
        expect(resRollup.toString()).to.be.equal("12"); //13-4; 2 2 fees + 2 withdraw
        expect(resId3.toString()).to.be.equal("19");
    });
});