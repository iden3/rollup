/* eslint-disable no-underscore-dangle */
/* global artifacts */
/* global contract */
/* global web3 */

const { expect } = require("chai");
const poseidonUnit = require("circomlib/src/poseidon_gencontract");
const SMTMemDB = require("circomlib/src/smt_memdb");
const Scalar = require("ffjavascript").Scalar;
const { stringifyBigInts } = require("ffjavascript").utils;

const { buildFullInputSm, ForgerTest, decodeMethod, signRollupTx, getEtherBalance } = require("./helpers/helpers");
const { BabyJubWallet } = require("../../rollup-utils/babyjub-wallet");
const TokenRollup = artifacts.require("../contracts/test/TokenRollup");
const Verifier = artifacts.require("../contracts/test/VerifierHelper");
const StakerManager = artifacts.require("../contracts/RollupPoS");
const RollupTest = artifacts.require("../contracts/test/RollupTest");
const RollupDB = require("../../js/rollupdb");
const { exitAx, exitAy, exitEthAddr} = require("../../js/constants");

contract("Rollup", (accounts) => { 

    const offChainHashInput = 3;
    const maxTx = 10;
    const maxOnChainTx = 5;
    let nLevels;
    let db;
    let rollupDB;
    let forgerTest;

    let insPoseidonUnit;
    let insTokenRollup;
    let insStakerManager;
    let insRollupTest;
    let insVerifier;

    // BabyJubjub public key
    // const mnemonic = "urban add pulse prefer exist recycle verb angle sell year more mosquito";
    const wallets = [];
    for (let i = 0; i<10; i++) {
        wallets.push(BabyJubWallet.createRandom());
    }
    // const wallet = BabyJubWallet.fromMnemonic(mnemonic);
    // const Ax = wallet.publicKey[0].toString();
    // const Ay = wallet.publicKey[1].toString();

    // tokenRollup initial amount
    const tokenInitialAmount = 100;

    const {
        0: owner,
        1: id1,
        2: id2,
        3: id3,
        4: tokenList,
        5: beneficiary,
        6: feeTokenAddress
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
            maxTx, maxOnChainTx, feeTokenAddress);

        // Deploy Staker manager
        insStakerManager = await StakerManager.new(insRollupTest.address, maxTx);
        
        // init rollup database
        db = new SMTMemDB();
        rollupDB = await RollupDB(db);
        nLevels = await insRollupTest.NLevels();
        forgerTest = new ForgerTest(rollupDB, maxTx, nLevels, beneficiary, insRollupTest);
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

        //check if developers win the fee of adding tokens
        let balanceFeeTokenAddress = await web3.eth.getBalance(feeTokenAddress);
        // Add token to rollup token list
        let feeAddToken =  await insRollupTest.feeAddToken();
        const resAddToken = await insRollupTest.addToken(insTokenRollup.address,
            { from: tokenList, value: feeAddToken});

        let balanceFeeTokenAddress2 = await web3.eth.getBalance(feeTokenAddress);
        let feeAddToken2 =  await insRollupTest.feeAddToken();

        //the account get the payment from the add token fee
        expect(Scalar.sub(balanceFeeTokenAddress2, balanceFeeTokenAddress).toString()).to.be.equal(feeAddToken.toString());
        //the add token fee is increased
        expect(feeAddToken2.toString()).to.be.equal((parseInt(feeAddToken)*1.25).toString());
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
        const feeOnChain = await insRollupTest.feeOnchainTx();
        const feeDeposit = await insRollupTest.depositFee();

        // totalFee = feeOnchainTx + depositFee;
        const feeRequired = Scalar.add(feeOnChain, feeDeposit);

        const resApprove = await insTokenRollup.approve(insRollupTest.address, loadAmount, { from: id1 });
        expect(resApprove.logs[0].event).to.be.equal("Approval");

        const resDeposit = await insRollupTest.deposit(loadAmount, tokenId, id1,
            [wallets[1].publicKey[0].toString(), wallets[1].publicKey[1].toString()], { from: id1, value: feeRequired.toString() });
        expect(resDeposit.logs[0].event).to.be.equal("OnChainTx");

        const leafInfo = await insRollupTest.getLeafInfo([wallets[1].publicKey[0].toString(), wallets[1].publicKey[1].toString()], tokenId);
        expect(leafInfo.ethAddress).to.be.equal(id1);
        // Check token balances for id1 and rollup smart contract
        const resRollup = await insTokenRollup.balanceOf(insRollupTest.address);
        const resId1 = await insTokenRollup.balanceOf(id1);
        expect(resRollup.toString()).to.be.equal("10");
        expect(resId1.toString()).to.be.equal("40");

        let balanceBeneficiary = await web3.eth.getBalance(beneficiary);
        // forge genesis batch
        await forgerTest.forgeBatch();

        // Forge batch with deposit transaction
        await forgerTest.forgeBatch([resDeposit.logs[0]]);

        let balanceBeneficiary2 = await web3.eth.getBalance(beneficiary);
        expect(Scalar.sub(balanceBeneficiary2, balanceBeneficiary)).to.be.equal(
            Scalar.sub(feeOnChain, Scalar.div(feeOnChain, maxOnChainTx * 3)));
        const leafId= await insRollupTest.getLeafId([wallets[1].publicKey[0].toString(), wallets[1].publicKey[1].toString()], tokenId);
        expect(leafId.toString()).to.be.equal("1");

        forgerTest.checkBatchNumber([resDeposit.logs[0]]);
    });

    it("Should add two deposits", async () =>{
        // Steps:
        // - Transaction to deposit 'TokenRollup' from 'id2' and 'id3' to 'rollup smart contract'(owner)
        // - Check 'tokenRollup' balances
        // - Get event data
        // - Update rollupTree
        // - forge batches to include both deposits

        const feeOnChain = await insRollupTest.feeOnchainTx();
        const feeDeposit = await insRollupTest.depositFee();

        // totalFee = feeOnchainTx + depositFee;
        const feeRequired = Scalar.add(feeOnChain, feeDeposit);

        const loadAmount = 5;
        const tokenId = 0;

        await insTokenRollup.approve(insRollupTest.address, loadAmount, { from: id2 });
        await insTokenRollup.approve(insRollupTest.address, loadAmount, { from: id3 });

        const resDepositId2 = await insRollupTest.deposit(loadAmount, tokenId, id2,
            [wallets[2].publicKey[0].toString(), wallets[2].publicKey[1].toString()], { from: id2, value: feeRequired.toString() });
        const resDepositId3 = await insRollupTest.deposit(loadAmount, tokenId, id3,
            [wallets[3].publicKey[0].toString(), wallets[3].publicKey[1].toString()], { from: id3, value: feeRequired.toString() });
        
        // Should trigger error since combination AX Ay is already created
        try {
            await insRollupTest.deposit(loadAmount, tokenId, id2,
                [wallets[1].publicKey[0].toString(), wallets[1].publicKey[1].toString()], { from: id2, value: feeRequired.toString() });
        } catch (error) {
            expect((error.message).includes("leaf already exist")).to.be.equal(true);
        }
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
        await forgerTest.forgeBatch();
        
        // forge batch two deposits
        await forgerTest.forgeBatch([resDepositId2.logs[0], resDepositId3.logs[0]]);

        const leafId2= await insRollupTest.getLeafId([wallets[2].publicKey[0].toString(), wallets[2].publicKey[1].toString()], tokenId);
        const leafId3= await insRollupTest.getLeafId([wallets[3].publicKey[0].toString(), wallets[3].publicKey[1].toString()], tokenId);

        expect(leafId2.toString()).to.be.equal("2");
        expect(leafId3.toString()).to.be.equal("3");

        forgerTest.checkBatchNumber([resDepositId2.logs[0], resDepositId3.logs[0]]);
    });

    it("Should add force withdraw", async () => {
        // Steps:
        // - Transaction to force wothdraw 'TokenRollup' from 'id1' to 'rollup smart contract'(owner)
        // - Check 'tokenRollup' balances
        // - Get event data
        // - Update rollupTree
        // - forge batches to include force withdraw
        // - it creates an exit root, it is created
        const amount = 8;
        const tokenId = 0;
        // Should trigger error since id2 is the sender, does not match id1

        const feeOnChain = await insRollupTest.feeOnchainTx();

        try {
            await insRollupTest.forceWithdraw([wallets[2].publicKey[0].toString(), wallets[2].publicKey[1].toString()], tokenId, amount,
                { from: id1, value: feeOnChain.toString() });
        } catch (error) {
            expect((error.message).includes("Sender does not match identifier balance tree")).to.be.equal(true);
        }

        const resForceWithdraw = await insRollupTest.forceWithdraw([wallets[1].publicKey[0].toString(),
            wallets[1].publicKey[1].toString()], tokenId, amount,
        { from: id1, value: feeOnChain.toString() });

        // forge batch with no transactions
        await forgerTest.forgeBatch();
        // forge batch force withdraw
        await forgerTest.forgeBatch([resForceWithdraw.logs[0]]);

        forgerTest.checkBatchNumber([resForceWithdraw.logs[0]]);
    });

    it("Should withdraw tokens", async () => {
        // Steps:
        // - Get data from rollupDB
        // - Transaction to withdraw amount indicated in previous step

        // last batch forged
        const lastBatch = await insRollupTest.getStateDepth();
        const tokenId = 0;
        const ax = wallets[1].publicKey[0].toString(16);
        const ay = wallets[1].publicKey[1].toString(16);

        const infoId = await rollupDB.getExitTreeInfo(lastBatch, tokenId, ax, ay);
        const siblingsId = stringifyBigInts(infoId.siblings);
        const leafId = infoId.state;
        // Should trigger error since we are try get withdraw from different sender
        try {
            await insRollupTest.withdraw(leafId.amount.toString(),
                Scalar.e(lastBatch).toString(), siblingsId, [wallets[1].publicKey[0].toString(), wallets[1].publicKey[1].toString()], 
                tokenId, { from: id2 });
        } catch (error) {
            expect((error.message).includes("invalid proof")).to.be.equal(true);
        }
        // send withdraw transaction
        await insRollupTest.withdraw(leafId.amount.toString(),
            Scalar.e(lastBatch).toString(), siblingsId, [wallets[1].publicKey[0].toString(), wallets[1].publicKey[1].toString()], 
            tokenId, { from: id1 });
        // Should trigger error since we are repeating the withdraw transaction
        try {
            await insRollupTest.withdraw(leafId.amount.toString(),
                Scalar.e(lastBatch).toString(), siblingsId, [wallets[1].publicKey[0].toString(), wallets[1].publicKey[1].toString()], 
                tokenId, { from: id1 });
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

        const fromAxAy = [wallets[3].publicKey[0].toString(), wallets[3].publicKey[1].toString()];
        const onTopAmount = 13;
        const tokenId = 0;

        let initialBalanceId3 = await rollupDB.getStateByIdx(3);
        expect(initialBalanceId3.amount.toString()).to.be.equal("5");

        const resApprove = await insTokenRollup.approve(insRollupTest.address, onTopAmount, { from: id1 });
        expect(resApprove.logs[0].event).to.be.equal("Approval");

        const balanceBefore= await getEtherBalance(id1);

        const resDepositOnTop = await insRollupTest.depositOnTop(fromAxAy,
            onTopAmount, tokenId,
            { from: id1, value: web3.utils.toWei("40", "ether") });

        const balanceAfter= await getEtherBalance(id1);

        // return the remaining ether after paying the fees.
        expect(Math.floor(balanceBefore) - Math.floor(balanceAfter)).to.be.lessThan(1.1);

        // Check token balances for id1 and rollup smart contract
        const resRollup = await insTokenRollup.balanceOf(insRollupTest.address);
        const resId1 = await insTokenRollup.balanceOf(id1);
        expect(resRollup.toString()).to.be.equal("25");
        expect(resId1.toString()).to.be.equal("35");

        // forge empty batch
        await forgerTest.forgeBatch();
        // forge batch with deposit on top transaction
        await forgerTest.forgeBatch([resDepositOnTop.logs[0]]);

        forgerTest.checkBatchNumber([resDepositOnTop.logs[0]]);

        let finalBalanceId3 = await rollupDB.getStateByIdx(3);
        expect(finalBalanceId3.amount.toString()).to.be.equal((parseInt(initialBalanceId3.amount.toString())+onTopAmount).toString());
    });

    it("Should add transfer", async () => {
        // Steps:
        // - Transaction from 'id2' to 'id3'
        // - Get event data
        // - Update rollupTree
        // - forge batches to include transaction
        // Current leaf 2: 5, tokens leaf 3: 18 tokens
        // After leaf 2: 4, tokens leaf 3: 19 tokens

        const fromAxAy = [wallets[2].publicKey[0].toString(), wallets[2].publicKey[1].toString()];
        const toAxAy = [wallets[3].publicKey[0].toString(), wallets[3].publicKey[1].toString()];
        const amount = 1;
        const tokenId = 0;

        let initialBalanceId2 = await rollupDB.getStateByIdx(2);
        let initialBalanceId3 = await rollupDB.getStateByIdx(3);

        expect(initialBalanceId2.amount.toString()).to.be.equal("5");
        expect(initialBalanceId3.amount.toString()).to.be.equal("18");

        const resTransfer = await insRollupTest.transfer(fromAxAy, toAxAy, amount, tokenId,
            { from: id2, value: web3.utils.toWei("1", "ether") });

        // forge empty batch
        await forgerTest.forgeBatch();
        // forge batch with deposit on top transaction
        await forgerTest.forgeBatch([resTransfer.logs[0]]);

        forgerTest.checkBatchNumber([resTransfer.logs[0]]);

        let finalBalanceId2 = await rollupDB.getStateByIdx(2);
        let finalBalanceId3 = await rollupDB.getStateByIdx(3);

        expect(finalBalanceId2.amount.toString()).to.be.equal((parseInt(initialBalanceId2.amount.toString())-amount).toString());
        expect(finalBalanceId3.amount.toString()).to.be.equal((parseInt(initialBalanceId3.amount.toString())+amount).toString());
    });

    it("Should add deposit and transfer", async () => {
        // Current Tokens: id1: 35, rollupSc: 15, leaf 2 : 4 leaf 4: null
        // After this test: id1: 23, rollupSc 27, leaf 2 : 14 leaf 4: 2

        const fromAxAy = [wallets[4].publicKey[0].toString(), wallets[4].publicKey[1].toString()];
        const toAxAy = [wallets[2].publicKey[0].toString(), wallets[2].publicKey[1].toString()];
        const loadAmount = 12;
        const tokenId = 0;
        const amount = 10;

        let initialBalanceId2 = await rollupDB.getStateByIdx(2);
        expect(initialBalanceId2.amount.toString()).to.be.equal("4");

        const resApprove = await insTokenRollup.approve(insRollupTest.address, loadAmount, { from: id1 });
        expect(resApprove.logs[0].event).to.be.equal("Approval");

        const resDepositAndTransfer = await insRollupTest.depositAndTransfer(loadAmount, tokenId, id1,
            fromAxAy, toAxAy, amount, { from: id1, value: web3.utils.toWei("1", "ether") });
        expect(resDepositAndTransfer.logs[0].event).to.be.equal("OnChainTx");

        // Check token balances for id1 and rollup smart contract
        const resRollup = await insTokenRollup.balanceOf(insRollupTest.address);
        const resId1 = await insTokenRollup.balanceOf(id1);
        expect(resRollup.toString()).to.be.equal("37");
        expect(resId1.toString()).to.be.equal("23");

        // forge genesis batch
        await forgerTest.forgeBatch();
        // Forge batch with deposit transaction
        await forgerTest.forgeBatch([resDepositAndTransfer.logs[0]]);
        
        forgerTest.checkBatchNumber([resDepositAndTransfer.logs[0]]);

        let finalBalanceId2 = await rollupDB.getStateByIdx(2);
        let finalBalanceId4 = await rollupDB.getStateByIdx(4); 

        expect(finalBalanceId2.amount.toString()).to.be.equal((parseInt(initialBalanceId2.amount.toString())+amount).toString());
        expect(finalBalanceId4.amount.toString()).to.be.equal((loadAmount-amount).toString());

        const leafId4= await insRollupTest.getLeafId([wallets[4].publicKey[0].toString(), wallets[4].publicKey[1].toString()], tokenId);
        expect(leafId4.toString()).to.be.equal("4");
    });


    it("Should add force withdraw id2", async () => {
        // Steps:
        // - Transaction to force wothdraw 'TokenRollup' from 'id2' to 'rollup smart contract'(owner)
        // - Check 'tokenRollup' balances
        // - Get event data
        // - Update rollupTree
        // - forge batches to include force withdraw
        // - it creates a new exit tree

        const fromAXAy = [wallets[2].publicKey[0].toString(), wallets[2].publicKey[1].toString()];
        const tokenId = 0;
        const amount = 14;
    
        const resForceWithdraw = await insRollupTest.forceWithdraw(fromAXAy, tokenId, amount,
            { from: id2, value: web3.utils.toWei("1", "ether") });
    
        // forge batch with no transactions
        await forgerTest.forgeBatch();
        // forge batch force withdraw
        await forgerTest.forgeBatch([resForceWithdraw.logs[0]]);
    
        forgerTest.checkBatchNumber([resForceWithdraw.logs[0]]);
    });
    
    it("Should withdraw tokens id2", async () => {
        // Steps:
        // - Get data from rollupDB
        // - Transaction to withdraw amount indicated in previous step
        
        // last batch forged
        const lastBatch = await insRollupTest.getStateDepth();
        const tokenId = 0;
        const ax = wallets[2].publicKey[0].toString(16);
        const ay = wallets[2].publicKey[1].toString(16);

        const infoId = await rollupDB.getExitTreeInfo(lastBatch, tokenId, ax, ay);
        const siblingsId = stringifyBigInts(infoId.siblings);
        const leafId = infoId.state;

        await insRollupTest.withdraw(leafId.amount.toString(),
            Scalar.e(lastBatch).toString(), siblingsId, [wallets[2].publicKey[0].toString(), wallets[2].publicKey[1].toString()], 
            tokenId, { from: id2 });

        // Check token balances for id2 and rollup smart contract
        const resRollup = await insTokenRollup.balanceOf(insRollupTest.address);
        expect(resRollup.toString()).to.be.equal("23");
    });
    
    it("Should forge withdraw off-chain transaction with fee", async () => {
        // Steps:
        // - Transaction from 'id3' to '0' --> force withdraw offchain
        // - Update rollupTree
        // - forge batch to include transaction
        // - Check block number information, balance of beneficiary and batch number
        // - Test double withdraw in the same batch
        // Current Tokens: leaf 3: 19 tokens
        // After this test: leaf 3: 13 tokens

        let initialBalanceId3 = await rollupDB.getStateByIdx(3);
        expect(initialBalanceId3.amount.toString()).to.be.equal("19");


        const tx = {
            fromAx: wallets[3].publicKey[0].toString(16),
            fromAy:  wallets[3].publicKey[1].toString(16),
            fromEthAddr: id3,
            toAx: exitAx,
            toAy: exitAy,
            toEthAddr: exitEthAddr,
            coin: 0,
            amount: 2,
            nonce: 0,
            fee: 15
        };
        const tx2 = {
            fromAx: wallets[3].publicKey[0].toString(16),
            fromAy:  wallets[3].publicKey[1].toString(16),
            fromEthAddr: id3,
            toAx: exitAx,
            toAy: exitAy,
            toEthAddr: exitEthAddr,
            coin: 0,
            amount: 2,
            nonce: 1,
            fee: 15
        };

        signRollupTx(wallets[3], tx);
        signRollupTx(wallets[3], tx2);
        const batch = await rollupDB.buildBatch(maxTx, nLevels);
        batch.addTx(tx);
        batch.addTx(tx2);
        // Add fee
        batch.addCoin(0, 1);
        batch.addCoin(1, 5);
        batch.addBeneficiaryAddress(beneficiary);
        await batch.build();
        const inputSm = buildFullInputSm(batch);
        const balanceBefore = await insTokenRollup.balanceOf(beneficiary);
        const resForge = await insRollupTest.forgeBatch(inputSm.proofA,
            inputSm.proofB, inputSm.proofC, inputSm.input, []);
        await rollupDB.consolidate(batch);

        const balanceAfter = await insTokenRollup.balanceOf(beneficiary);
        expect(Scalar.add(balanceBefore, 2)).to.be.equal(Scalar.e(balanceAfter));
        expect(resForge.logs[0].event).to.be.equal("ForgeBatch");
        
        // Off-chain are included next bacth forged
        expect(Scalar.e(rollupDB.lastBatch)).to.be.equal(Scalar.e(resForge.logs[0].args.batchNumber));
        
        // Recover hash off-chain from calldata
        // note: data compressedTx will be available on forge Batch Mechanism
        const blockNumber = resForge.logs[0].args.blockNumber.toString();
        const transaction = await web3.eth.getTransactionFromBlock(blockNumber, 0);
        const decodedData = decodeMethod(transaction.input);
        let inputRetrieved;
        decodedData.params.forEach(elem => {
            if (elem.name == "input") {
                inputRetrieved = elem.value;
            }
        });

        // Off-chain hash is 3th position of the input
        expect(Scalar.e(inputSm.input[offChainHashInput])).to.be.equal(Scalar.e(inputRetrieved[offChainHashInput]));

        let finalBalanceId3 = await rollupDB.getStateByIdx(3);
        expect(finalBalanceId3.amount.toString()).to.be.equal((parseInt(initialBalanceId3.amount.toString())-6).toString()); //2 fees + 4 amountTransfer = 6
    });

    it("Should withdraw previous off-chain transactions", async () => {
        // Steps:
        // - Get data from rollupDB
        // - Transaction to withdraw amount indicated in previous step
        // Current Tokens: id3 --> 20 tokens
        // After this test: id3 --> 22 tokens

        // last batch forged
        const lastBatch = await insRollupTest.getStateDepth();
        const ax = wallets[3].publicKey[0].toString(16);
        const ay = wallets[3].publicKey[1].toString(16);
        const tokenId = 0;
        const infoId = await rollupDB.getExitTreeInfo(lastBatch, tokenId, ax, ay);
        const siblingsId = stringifyBigInts(infoId.siblings);
        const leafId = infoId.state;


        await insRollupTest.withdraw(leafId.amount.toString(),
            Scalar.e(lastBatch).toString(), siblingsId, [wallets[3].publicKey[0].toString(), wallets[3].publicKey[1].toString()], 
            tokenId, { from: id3 });
    
        // Check token balances for id1 and rollup smart contract
        const resRollup = await insTokenRollup.balanceOf(insRollupTest.address);
        const resId3 = await insTokenRollup.balanceOf(id3);
        expect(resRollup.toString()).to.be.equal("17"); // 23-6; --> 2 fees + 4 withdraw
        expect(resId3.toString()).to.be.equal("24");
    });
    
    it("Should deposit and transfer to 0", async () => {
        // Current Tokens: leaf 5 --> undefined, id3 --> 24 tokens
        // After this test: leaf 5 --> 3 tokens, id3 --> 16 tokens

        const fromAxAy = [wallets[5].publicKey[0].toString(), wallets[5].publicKey[1].toString()];
        const toAxAy = [0, 0];
        const loadAmount = 8;
        const tokenId = 0;
        const amount = 5;

        const resApprove = await insTokenRollup.approve(insRollupTest.address, loadAmount, { from: id3 });
        expect(resApprove.logs[0].event).to.be.equal("Approval");

        const resDepositAndTransfer = await insRollupTest.depositAndTransfer(loadAmount, tokenId, id3,
            fromAxAy, toAxAy, amount, { from: id3, value: web3.utils.toWei("1", "ether") });

        expect(resDepositAndTransfer.logs[0].event).to.be.equal("OnChainTx");

        // Check token balances for id1 and rollup smart contract
        const resRollup = await insTokenRollup.balanceOf(insRollupTest.address);
        const resId3 = await insTokenRollup.balanceOf(id3);
        expect(resRollup.toString()).to.be.equal("25");
        expect(resId3.toString()).to.be.equal("16");

        // forge genesis batch
        await forgerTest.forgeBatch();
        // Forge batch with deposit transaction
        await forgerTest.forgeBatch([resDepositAndTransfer.logs[0]]);
        
        forgerTest.checkBatchNumber([resDepositAndTransfer.logs[0]]);

        let finalBalanceId5 = await rollupDB.getStateByIdx(5);
        expect(finalBalanceId5.amount.toString()).to.be.equal("3");

        const leafId5 = await insRollupTest.getLeafId([wallets[5].publicKey[0].toString(), wallets[5].publicKey[1].toString()], tokenId);
        expect(leafId5.toString()).to.be.equal("5");
    });

    it("Should withdraw deposit and transfer", async () => {
        // Steps:
        // - Get data from rollupDB
        // - Transaction to withdraw amount indicated in previous step
        // Current Tokens: id3 --> 16 tokens
        // After this test: id3 --> 21 tokens

        // last batch forged
        const lastBatch = await insRollupTest.getStateDepth();
        const tokenId = 0;
        const ax = wallets[5].publicKey[0].toString(16);
        const ay = wallets[5].publicKey[1].toString(16);

        const infoId = await rollupDB.getExitTreeInfo(lastBatch, tokenId, ax, ay);
        const siblingsId = stringifyBigInts(infoId.siblings);
        const leafId = infoId.state;

        await insRollupTest.withdraw(leafId.amount.toString(),
            Scalar.e(lastBatch).toString(), siblingsId, [wallets[5].publicKey[0].toString(), wallets[5].publicKey[1].toString()], 
            tokenId, { from: id3 });
    
            
        // Check token balances for id1 and rollup smart contract
        const resRollup = await insTokenRollup.balanceOf(insRollupTest.address);
        const resId3 = await insTokenRollup.balanceOf(id3);
        expect(resRollup.toString()).to.be.equal("20"); // 25 - 5
        expect(resId3.toString()).to.be.equal("21");
    });
        
    it("Should forge off-chain transaction with fee", async () => {
        // Steps:
        // - Transaction from 'leaf 3' to 'leaf 1' 
        // - Update rollupTree
        // - forge batch to include transaction
        // - Check block number information and balance of beneficiary
        // Current Tokens: leaf 3 --> 13 tokens
        // After this test: leaf 3 --> 10 tokens

        let initialBalanceId3 = await rollupDB.getStateByIdx(3);
        expect(initialBalanceId3.amount.toString()).to.be.equal("13");
    
        const tx = {
            fromAx: wallets[3].publicKey[0].toString(16),
            fromAy:  wallets[3].publicKey[1].toString(16),
            fromEthAddr: id3,
            toAx: wallets[1].publicKey[0].toString(16),
            toAy: wallets[1].publicKey[1].toString(16),
            toEthAddr: id1,
            coin: 0,
            amount: 2,
            nonce: 2,
            fee: 15
        };
        signRollupTx(wallets[3], tx);
        const batch = await rollupDB.buildBatch(maxTx, nLevels);
        batch.addTx(tx);
        // Add fee
        batch.addCoin(0, 1);
        batch.addBeneficiaryAddress(beneficiary);
        await batch.build();
        const inputSm = buildFullInputSm(batch);
        const balanceBefore = await insTokenRollup.balanceOf(beneficiary);
        const resForge = await insRollupTest.forgeBatch(inputSm.proofA,
            inputSm.proofB, inputSm.proofC, inputSm.input, []);
        await rollupDB.consolidate(batch);
    
        const balanceAfter = await insTokenRollup.balanceOf(beneficiary);
        expect(Scalar.add(balanceBefore, 1)).to.be.
            equal(Scalar.e(balanceAfter));
        expect(resForge.logs[0].event).to.be.equal("ForgeBatch");
            
        // Off-chain are included next bacth forged
        expect(Scalar.e(rollupDB.lastBatch)).to.be.
            equal(Scalar.e(resForge.logs[0].args.batchNumber));
        // Recover hash off-chain from calldata
        // note: data compressedTx will be available on forge Batch Mechanism
        const blockNumber = resForge.logs[0].args.blockNumber.toString();
        const transaction = await web3.eth.getTransactionFromBlock(blockNumber, 0);
        const decodedData = decodeMethod(transaction.input);
        let inputRetrieved;
        decodedData.params.forEach(elem => {
            if (elem.name == "input") {
                inputRetrieved = elem.value;
            }
        });
        // Off-chain hash is 3th position of the input
        expect(Scalar.e(inputSm.input[offChainHashInput])).to.be.equal(Scalar.e(inputRetrieved[offChainHashInput]));
    
        let finalBalanceId3 = await rollupDB.getStateByIdx(3);
        expect(finalBalanceId3.amount.toString()).to.be.equal((parseInt(initialBalanceId3.amount.toString())-3).toString());
    });

    it("Should forge deposit off-chain", async () => {
        // Steps:
        // - Deposit off-chain --> 'leaf6'
        // - Transaction from 'leaf3' to 'leaf6'
        // - Update rollupTree
        // - forge batch to include both transactions
        // - Check block number information and balance of beneficiary
        // Current Tokens:  leaf 3 --> 10 tokens  leaf 6 --> undefined
        // After this test: leaf 3 --> 7 tokens  leaf 6 --> 2 tokens

        const tokenId = 0;
        let initialBalanceId3 = await rollupDB.getStateByIdx(3);
        expect(initialBalanceId3.amount.toString()).to.be.equal("10");
    
        const tx = {
            fromAx: wallets[3].publicKey[0].toString(16),
            fromAy:  wallets[3].publicKey[1].toString(16),
            fromEthAddr: id3,
            toAx: wallets[6].publicKey[0].toString(16),
            toAy: wallets[6].publicKey[1].toString(16),
            toEthAddr: id1,
            coin: 0,
            amount: 2,
            nonce: 3,
            fee: 15
        };
        signRollupTx(wallets[3], tx);
        const batch = await rollupDB.buildBatch(maxTx, nLevels);
        batch.addTx(tx);
        // Add fee
        batch.addCoin(0, 1);

        // Create the off-chain deposit and add it to the Batchbuilder
        const txOnchain = {
            fromAx: wallets[6].publicKey[0].toString(16),
            fromAy:  wallets[6].publicKey[1].toString(16),
            fromEthAddr: id1,
            toAx: exitAx,
            toAy: exitAy,
            toEthAddr: exitEthAddr,
            coin: 0,
            onChain: true
        };
        batch.addTx(txOnchain);
        batch.addDepositOffChain(txOnchain);
        batch.addBeneficiaryAddress(beneficiary);
        // Encode depositOffchain
        await batch.build();
        const encodedDeposits = batch.getDepOffChainData();
        const inputSm = buildFullInputSm(batch);

        // Calculate fees
        const feeOnChain = await insRollupTest.feeOnchainTx();
        const feeDeposit = await insRollupTest.depositFee();
        // totalFee = feeOnchainTx + depositFee;
        const feeRequired = Scalar.add(feeOnChain, feeDeposit);

        // Add the offchainDeposit data
        await insRollupTest.forgeBatch(inputSm.proofA,
            inputSm.proofB, inputSm.proofC, inputSm.input, encodedDeposits, {value: feeRequired.toString() });
        await rollupDB.consolidate(batch);
    
        let finalBalanceId3 = await rollupDB.getStateByIdx(3);
        let finalBalanceId6 = await rollupDB.getStateByIdx(6);
        expect(finalBalanceId3.amount.toString()).to.be.equal((parseInt(initialBalanceId3.amount.toString())-3).toString()); 
        expect(finalBalanceId6.amount.toString()).to.be.equal("2"); 

        const leafId6 = await insRollupTest.getLeafId([wallets[6].publicKey[0].toString(), wallets[6].publicKey[1].toString()], tokenId);
        expect(leafId6.toString()).to.be.equal("6");
    });

    it("Should queue OnChainTx", async () => {
        // Steps:
        // - Perform 20 deposits
        // - forge batch to include both transactions
        // - Check block number information and balance of beneficiary
        // Current Tokens:  id1 --> 23 tokens 
        // After this test: id1 --> 0 tokens 

        const loadAmount = 1;
        const tokenId = 0;

        const initialId1 = await insTokenRollup.balanceOf(id1);
        expect(initialId1.toString()).to.be.equal("23");

        await insTokenRollup.approve(insRollupTest.address, loadAmount*20, { from: id1 });

        const walletsDeposit = [];
        for (let i = 0; i<maxOnChainTx*2; i++) {
            walletsDeposit.push(BabyJubWallet.createRandom());
        }

        let logs = [];

        const feeOnChain = await insRollupTest.feeOnchainTx();
        const feeDeposit = await insRollupTest.depositFee();

        // totalFee = feeOnchainTx + depositFee;
        const feeRequired = Scalar.add(feeOnChain, feeDeposit);


        for (let i = 0; i<maxOnChainTx*2; i++) {
            const response = await insRollupTest.deposit(loadAmount, tokenId, id1,
                [walletsDeposit[i].publicKey[0].toString(), walletsDeposit[i].publicKey[1].toString()], 
                { from: id1, value: feeRequired.toString() });
            logs[i] = response.logs[0];
        }

        // Check token balances for id1 and rollup smart contract
        const resId1 = await insTokenRollup.balanceOf(id1);
        expect(resId1.toString()).to.be.equal("13");

        // forge batch with no transactions
        await forgerTest.forgeBatch();
        
        // forge batch full of onChain Tx
        await forgerTest.forgeBatch(logs.slice(0, maxOnChainTx));

        for (let i = 0; i<maxOnChainTx; i++) {
            const leaf = await insRollupTest.getLeafId([walletsDeposit[i].publicKey[0].toString(), walletsDeposit[i].publicKey[1].toString()], tokenId);
            expect(leaf.toString()).to.be.equal((i+7).toString());
        }
        forgerTest.checkBatchNumber(logs.slice(0, maxOnChainTx));

        try {
            await insRollupTest.getLeafId([walletsDeposit[maxOnChainTx].publicKey[0].toString(), walletsDeposit[maxOnChainTx].publicKey[1].toString()], tokenId);
        } catch(error) {
            expect((error.message).includes("leaf does not exist")).to.be.equal(true);
        }

        await forgerTest.forgeBatch(logs.slice(maxOnChainTx, maxOnChainTx*2));

        for (let i = maxOnChainTx; i<maxOnChainTx*2; i++) {
            const leaf = await insRollupTest.getLeafId([walletsDeposit[i].publicKey[0].toString(), walletsDeposit[i].publicKey[1].toString()], tokenId);
            expect(leaf.toString()).to.be.equal((i+7).toString());
        }
        forgerTest.checkBatchNumber(logs.slice(maxOnChainTx, maxOnChainTx*2));
    });
});