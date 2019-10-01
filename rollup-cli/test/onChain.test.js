/* eslint-disable no-underscore-dangle */
/* global artifacts */
/* global contract */
/* global web3 */
/* global BigInt */

const chai = require("chai");
const deposit= require("../src/actions/onchain/deposit.js");
const depositOnTop= require("../src/actions/onchain/depositOnTop.js");
const { withdraw }= require("../src/actions/onchain/withdraw.js");
const { buildInputSm } = require("../../rollup-operator/src/utils");
const { forceWithdraw }= require("../src/actions/onchain/forceWithdraw.js");
const walletPathDefault="../src/resources/wallet.json";
const { Wallet } = require("../src/wallet.js");

const { expect } = chai;
const rollupabiPath = "../src/resources/rollupabi.json";

const fs = require("fs");
const RollupTree = require("../../rollup-utils/rollup-tree");
const rollupUtils = require("../../rollup-utils/rollup-utils.js");
const poseidonUnit = require("circomlib/src/poseidon_gencontract");
const Verifier = artifacts.require("../../../../contracts/test/VerifierHelper");
const RollupTest = artifacts.require("../../../../contracts/test/RollupTest");
const TokenRollup = artifacts.require("../../../../contracts/test/TokenRollup");
const RollupDB = require("../../js/rollupdb");
const SMTMemDB = require("circomlib/src/smt_memdb");

const abiDecoder = require("abi-decoder");
abiDecoder.addABI(RollupTest.abi);

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

contract("Rollup", async (accounts) => {

    async function forgeBlock(events = undefined) {
       
        const block = await rollupDB.buildBatch(maxTx, nLevels);
        if (events) {
            events.forEach(elem => {
                block.addTx(manageEvent(elem));
            });
        }
        await block.build();
        
        const inputSm = buildFullInputSm(block, beneficiary);
        await insRollupTest.forgeBatch(inputSm.beneficiary, inputSm.proofA,
            inputSm.proofB, inputSm.proofC, inputSm.input);
            
        await rollupDB.consolidate(block);
       
    }
    function checkBatchNumber(events) {
        events.forEach(elem => {
            const eventBatch = BigInt(elem.args.batchNumber); 
            expect(eventBatch.add(BigInt(2)).toString()).to.be.equal(BigInt(rollupDB.lastBatch).toString());
        });
    }
    let insPoseidonUnit;
    let insTokenRollup;
    let insRollupTest;
    let insVerifier;
    let walletEth;
    let walletBaby;
    let exitTree;
    let rollupDB;
    let db;
    const nLevels = 24;

    const maxTx = 10;
    const maxOnChainTx = 6;
    const tokenInitialAmount = 100;
    const {
        0: owner,
        1: id1,
        2: tokenList,
        3: beneficiary,
        4: providerfunds,
    } = accounts;

    let addressSC;
    let password = "foo";
    let abi;
    let UrlOperator;
    let walletJson;

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


        walletJson= JSON.parse(fs.readFileSync(walletPathDefault, "utf8"));
        let walletRollup= await Wallet.fromEncryptedJson(walletJson, password);

        walletEth = walletRollup.ethWallet.wallet;
        walletBaby = walletRollup.babyjubWallet;
      
        db = new SMTMemDB();
        rollupDB = await RollupDB(db);
        exitTree = await RollupTree.newMemRollupTree();
        
        abi = JSON.parse(fs.readFileSync(rollupabiPath, "utf8"));
        UrlOperator ="http://127.0.0.1:9000";
        addressSC= insRollupTest.address;
     
    });

    it("Distribute token rollup", async () => {
        await insTokenRollup.transfer(walletEth.address, 50, { from: id1 });
    });

    it("Rollup token listing", async () => {
        // Check balances token
        const resWalletEth = await insTokenRollup.balanceOf(walletEth.address);
        const resId1 = await insTokenRollup.balanceOf(id1);
        expect(resWalletEth.toString()).to.be.equal("50");
        expect(resId1.toString()).to.be.equal("50");

        // Add token to rollup token list
        const resAddToken = await insRollupTest.addToken(insTokenRollup.address,
            { from: tokenList, value: web3.utils.toWei("1", "ether") });

        expect(resAddToken.logs[0].event).to.be.equal("AddToken");
        expect(resAddToken.logs[0].args.tokenAddress).to.be.equal(insTokenRollup.address);
        expect(resAddToken.logs[0].args.tokenId.toString()).to.be.equal("0");
    });

    it("Deposit balance tree", async () => {
    // Steps:
    // - Transaction to deposit 'TokenRollup' from 'walletEth' to 'rollup smart contract'(owner)
    // - Check 'tokenRollup' balances
    // - Add leaf to balance tree
    // - Check 'filling on-chain' hash
        
        const depositAmount = 10;
        const tokenId = 0;
    
        web3.eth.sendTransaction({to:walletEth.address, from:providerfunds, value: web3.utils.toWei("5", "ether")});//provide funds to our account
      
        const tx = {
            from:  walletEth.address, 
            // target address, this could be a smart contract address
            gasLimit: web3.utils.toHex(800000), // Raise the gas limit to a much higher amount
            gasPrice: web3.utils.toHex(web3.utils.toWei("10", "gwei")),
            to: insTokenRollup.address, 
            // optional if you want to specify the gas limit 
            data: insTokenRollup.contract.methods.approve(insRollupTest.address, depositAmount).encodeABI() 
        };

    
        let signPromise = await web3.eth.accounts.signTransaction(tx, walletEth.privateKey);
        await web3.eth.sendSignedTransaction(signPromise.rawTransaction);
     
        let resDeposit= await deposit.deposit(web3.currentProvider.host, addressSC, depositAmount, tokenId, 
            walletJson, password, abi);

        let receip = await resDeposit.wait();

        // Check token balances for walletEth and rollup smart contract
        const resRollup = await insTokenRollup.balanceOf(insRollupTest.address);
        const resWalletEth = await insTokenRollup.balanceOf(walletEth.address);
        expect(resRollup.toString()).to.be.equal("10");
        expect(resWalletEth.toString()).to.be.equal("40");
        
        await forgeBlock();

        // Forge block with deposit transaction
        let event = receip.events.pop();
        await forgeBlock([event]);
        // create balance tree and add leaf
        
        checkBatchNumber([event]);
    });

    it("Deposit on top and forge it", async () => {
       
        const onTopAmount = 5;
        const tokenId = 0;

        const tx = {
            from:  walletEth.address, 
            // target address, this could be a smart contract address
            gasLimit: web3.utils.toHex(800000), // Raise the gas limit to a much higher amount
            gasPrice: web3.utils.toHex(web3.utils.toWei("10", "gwei")),
            to: insTokenRollup.address, 
            // optional if you want to specify the gas limit 
            data: insTokenRollup.contract.methods.approve(insRollupTest.address, onTopAmount).encodeABI() 
        };

    
        let signPromise = await web3.eth.accounts.signTransaction(tx, walletEth.privateKey);
        await web3.eth.sendSignedTransaction(signPromise.rawTransaction);

        let resDeposit= await depositOnTop.depositOnTop(web3.currentProvider.host, addressSC, onTopAmount, tokenId, 
            walletJson, password, abi, UrlOperator);
        // Check token balances for walletEth and rollup smart contract
        const resRollup = await insTokenRollup.balanceOf(insRollupTest.address);
        const reswalletEth = await insTokenRollup.balanceOf(walletEth.address);
        expect(resRollup.toString()).to.be.equal("15");
        expect(reswalletEth.toString()).to.be.equal("35");

        let receip = await resDeposit.wait();

        let event = receip.events.pop();

        await forgeBlock();

        await forgeBlock([event]);
        // create balance tree and add leaf
        
        checkBatchNumber([event]);

    });

    it("Should add force withdraw", async () => {
        // Steps:
        // - Transaction to force wothdraw 'TokenRollup' from 'walletEth' to 'rollup smart contract'(owner)
        // - Get event data
        // - Update rollupTree
        // - forge blocks to include force withdraw
        // - it creates an exit root, it is created
           
        const amount = 10;
        const tokenId = 0;

        const resForceWithdraw= await forceWithdraw(web3.currentProvider.host, addressSC, amount, tokenId,
            walletJson, password, abi, UrlOperator);

        // forge block with no transactions
        // forge block force withdraw
    
        // Simulate exit tree to retrieve siblings
        let receip = await resForceWithdraw.wait();

        let event = receip.events.pop();
    
        await forgeBlock();
    
        await forgeBlock([event]);

        await exitTree.addId(1, amount, 0, BigInt(walletBaby.publicKey[0]), BigInt(walletBaby.publicKey[1]), BigInt(walletEth.address), 0);
    
    });
    
    it("Should withdraw tokens", async () => {
        // Steps:
        // - Get data from 'exitTree'
        // - Transaction to withdraw amount indicated in previous step
        const amount = 10;
        const tokenId = 0; 
        await withdraw(web3.currentProvider.host, addressSC, amount, tokenId,
            walletJson, password, abi, UrlOperator);

        const resRollup = await insTokenRollup.balanceOf(insRollupTest.address);
        const reswalletEth = await insTokenRollup.balanceOf(walletEth.address);
        expect(resRollup.toString()).to.be.equal("5");
        expect(reswalletEth.toString()).to.be.equal("45");
    });

});
