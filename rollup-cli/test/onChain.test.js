/* eslint-disable no-underscore-dangle */
/* global artifacts */
/* global contract */
/* global web3 */
/* global BigInt */

const chai = require("chai");
const deposit= require("../src/actions/onchain/deposit.js");
const depositOnTop= require("../src/actions/onchain/depositOnTop.js");
const { withdraw }= require("../src/actions/onchain/withdraw.js");
const { forceWithdrawV2 }= require("../src/actions/onchain/forceWithdraw.js");
const walletEthPathDefault="../src/resources/ethWallet.json";
const { BabyJubWallet } = require("../../rollup-utils/babyjub-wallet");
const walletBabyjubPathDefault="../src/resources/babyjubWallet.json";
const { expect } = chai;
const rollupabiPath = "../src/resources/rollupabi.json";
const ethers = require("ethers");
const fs = require("fs");
const RollupTree = require("../../rollup-utils/rollup-tree");
const utils = require("../../rollup-utils/utils");
const rollupUtils = require("../../rollup-utils/rollup-utils.js");
const poseidonUnit = require("circomlib/src/poseidon_gencontract");
const Verifier = artifacts.require("../../../../contracts/test/VerifierHelper");
const RollupTest = artifacts.require("../../../../contracts/test/RollupTest");
const TokenRollup = artifacts.require("../../../../contracts/test/TokenRollup");
const RollupDB = require("../../js/rollupdb");
const SMTMemDB = require("circomlib/src/smt_memdb");


function buildInputSm(bb, beneficiary) {
    return {
        oldStateRoot: bb.getInput().oldStRoot.toString(),
        newStateRoot: bb.getNewStateRoot().toString(),
        newExitRoot: bb.getNewExitRoot().toString(),
        onChainHash: bb.getOnChainHash().toString(),
        feePlan: bb.feePlan.length ? bb.feePlan : [0, 0],
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
contract("Rollup", async (accounts) => {

    async function forgeBlock(events = undefined) {
       
        const block = await rollupDB.buildBlock(maxTx, nLevels);
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
    let insPoseidonUnit;
    let insTokenRollup;
    let insRollupTest;
    let insVerifier;
    let walletEth;
    let exitTree;
    let rollupDB;
    let db;
    const nLevels = 24;

    const maxTx = 10;
    const maxOnChainTx = 3;
    const tokenInitialAmount = 100;
    const {
        0: owner,
        1: id1,
        2: tokenList,
        3: beneficiary,
        4: providerfunds,
    } = accounts;

    let addressSC;
    let password;
    let abi;
    let UrlOperator;
    let babyjubJson;
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

        walletEth = await ethers.Wallet.fromEncryptedJson(fs.readFileSync(walletEthPathDefault, "utf8"), "foo");
      
        db = new SMTMemDB();
        rollupDB = await RollupDB(db);

        babyjubJson= fs.readFileSync(walletBabyjubPathDefault, "utf8");
        exitTree = await RollupTree.newMemRollupTree();
        password = "foo";
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
    // - Transaction to deposit 'TokenRollup' from 'id1' to 'rollup smart contract'(owner)
    // - Check 'tokenRollup' balances
    // - Get event data
    // - Add leaf to balance tree
    // - Check 'filling on-chain' hash
        

       
        const depositAmount = 10;
        const tokenId = 0;
    
        web3.eth.sendTransaction({to:walletEth.address, from:providerfunds, value: web3.utils.toWei("5", "ether")});//provide funds to our account
        
        //const resApprove = await insTokenRollup.approve(insRollupTest.address, depositAmount, { from: id1 });
      
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

       
        //expect(sentTx.logs[0].event).to.be.equal("Approval");
     
        let resDeposit= await deposit.deposit(web3.currentProvider.host, addressSC, depositAmount, tokenId, 
            fs.readFileSync(walletEthPathDefault, "utf8"), babyjubJson,password, abi);

        let receip = await resDeposit.wait();
        //console.log("holoo",receip.events.pop())
        //expect(resDeposit.logs[0].event).to.be.equal("Deposit");

        // Check token balances for id1 and rollup smart contract
        const resRollup = await insTokenRollup.balanceOf(insRollupTest.address);
        const resWalletEth = await insTokenRollup.balanceOf(walletEth.address);
        expect(resRollup.toString()).to.be.equal("10");
        expect(resWalletEth.toString()).to.be.equal("40");
        
        await forgeBlock();

        // Forge block with deposit transaction
        let event = receip.events.pop();
        await forgeBlock([event]);
        //await forgeBlock([resDeposit.logs[0]]);
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
            fs.readFileSync(walletEthPathDefault, "utf8"), babyjubJson,password, abi, UrlOperator);
        //console.log({resDeposit})

        // Check token balances for id1 and rollup smart contract
        const resRollup = await insTokenRollup.balanceOf(insRollupTest.address);
        const resId1 = await insTokenRollup.balanceOf(walletEth.address);
        expect(resRollup.toString()).to.be.equal("15");
        expect(resId1.toString()).to.be.equal("35");

        let receip = await resDeposit.wait();

        let event = receip.events.pop();

        await forgeBlock();

        await forgeBlock([event]);
        //await forgeBlock([resDeposit.logs[0]]);
        // create balance tree and add leaf
        
        checkBatchNumber([event]);

    });

    it("Should add force withdraw", async () => {
        // Steps:
        // - Transaction to force wothdraw 'TokenRollup' from 'id1' to 'rollup smart contract'(owner)
        // - Check 'tokenRollup' balances
        // - Get event data
        // - Update rollupTree
        // - forge blocks to include force withdraw
        // - it creates an exit root, it is created
           
        const amount = 10;
        const tokenId = 0;
        // Should trigger error since id2 is the sender, does not match id1

        const resForceWithdraw= await forceWithdrawV2(web3.currentProvider.host, addressSC, amount, tokenId,
            fs.readFileSync(walletEthPathDefault, "utf8"), babyjubJson,password, abi, UrlOperator);

            
        let walletBaby = await BabyJubWallet.fromEncryptedJson(babyjubJson, password);
        // forge block with no transactions
        // forge block force withdraw
    
        // Simulate exit tree to retrieve siblings
        let receip = await resForceWithdraw.wait();

        let event = receip.events.pop();
    
        await forgeBlock();
    
        await forgeBlock([event]);

        await exitTree.addId(1, amount, 0, BigInt(walletBaby.publicKey[0]), BigInt(walletBaby.publicKey[1]), BigInt(walletEth.address), 0);
    
        //checkBatchNumber([resForceWithdraw.logs[0]]);
    });
    
    it("Should withdraw tokens", async () => {
        // Steps:
        // - Get data from 'exitTree'
        // - Transaction to withdraw amount indicated in previous step
        const id = 1;
        const amount = 10;
        const infoId = await exitTree.getIdInfo(id);
        const siblingsId = utils.arrayBigIntToArrayStr(infoId.siblings);
        const tokenId = 0;

        const leafId = infoId.foundObject;
        // last block forged
        const lastBlock = await insRollupTest.getStateDepth();//??? exit root???
    
        // Should trigger error since we are try get withdraw from different sender
        console.log("hi", BigInt(lastBlock).toString(), leafId.tokenId.toString(),siblingsId);
        await withdraw(web3.currentProvider.host, addressSC, amount, tokenId,
            fs.readFileSync(walletEthPathDefault, "utf8"), babyjubJson,password, abi, UrlOperator);

        const resRollup = await insTokenRollup.balanceOf(insRollupTest.address);
        const reswalletEth = await insTokenRollup.balanceOf(walletEth.address);
        expect(resRollup.toString()).to.be.equal("5");
        expect(reswalletEth.toString()).to.be.equal("45");
    });

});
