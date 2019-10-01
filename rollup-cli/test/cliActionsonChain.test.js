/* eslint-disable no-underscore-dangle */
/* global artifacts */
/* global contract */
/* global web3 */
/* global BigInt */

const chai = require("chai");
const walletPathDefault="../src/resources/wallet.json";
const { Wallet } = require("../src/wallet.js");
const { expect } = chai;
const fs = require("fs");
const RollupTree = require("../../rollup-utils/rollup-tree");
const rollupUtils = require("../../rollup-utils/rollup-utils.js");
const poseidonUnit = require("circomlib/src/poseidon_gencontract");
const Verifier = artifacts.require("../../../../contracts/test/VerifierHelper");
const RollupTest = artifacts.require("../../../../contracts/test/RollupTest");
const TokenRollup = artifacts.require("../../../../contracts/test/TokenRollup");
const RollupDB = require("../../js/rollupdb");
const SMTMemDB = require("circomlib/src/smt_memdb");
const process = require("child_process");
const config = "../src/resources/config.json";
const { buildInputSm } = require("../../rollup-operator/src/utils");

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
    let exitTree;
    let rollupDB;
    let db;
    let walletJson;
    let walletBaby;
    const nLevels = 24;

    const maxTx = 10;
    const maxOnChainTx = 5;
    const tokenInitialAmount = 100;
    const {
        0: owner,
        1: id1,
        2: tokenList,
        3: beneficiary,
        4: providerfunds,
    } = accounts;

    let password;

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

      
      
        db = new SMTMemDB();
        rollupDB = await RollupDB(db);

       
        exitTree = await RollupTree.newMemRollupTree();
        password = "foo";
        let actualConfig = {};
        if (fs.existsSync(config)){
            actualConfig = JSON.parse(fs.readFileSync(config, "utf8"));
        }
        actualConfig.address = insRollupTest.address;
        fs.writeFileSync(config, JSON.stringify(actualConfig,null,1), "utf-8");

        walletJson= JSON.parse(fs.readFileSync(walletPathDefault, "utf8"));
        let walletRollup= await Wallet.fromEncryptedJson(walletJson, password);

        walletEth = walletRollup.ethWallet.wallet;
        walletBaby = walletRollup.babyjubWallet;

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
     
        const promise = new Promise (function(resolve){
            let out = process.exec(`cd ..; node cli.js onchaintx --type deposit --pass ${password} --amount ${depositAmount} --tokenid ${tokenId}`);
            out.stdout.on("data", (data) => {
                resolve(JSON.parse(data));
            });
        });
        let event = await promise;

        for (var key in event.args) {
            if (event.args[key]._hex != undefined){
                event.args[key] = event.args[key]._hex;
            }
        }
        
       
        const resRollup = await insTokenRollup.balanceOf(insRollupTest.address);
        const resWalletEth = await insTokenRollup.balanceOf(walletEth.address);
        expect(resRollup.toString()).to.be.equal("10");
        expect(resWalletEth.toString()).to.be.equal("40");
        
        await forgeBlock();

        // Forge block with deposit transaction

        // let event = receip.events.pop();
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


        const promise = new Promise (function(resolve){
            let out = process.exec(`cd ..; node cli.js onchaintx --type depositontop --pass ${password} --amount ${onTopAmount} --tokenid ${tokenId}`);
            out.stdout.on("data", (data) => {
                resolve(JSON.parse(data));
            });
        });
        let event = await promise;

        for (var key in event.args) {
            if (event.args[key]._hex != undefined){
                event.args[key] = event.args[key]._hex;
            }
        }
     
        const resRollup = await insTokenRollup.balanceOf(insRollupTest.address);
        const resId1 = await insTokenRollup.balanceOf(walletEth.address);
        expect(resRollup.toString()).to.be.equal("15");
        expect(resId1.toString()).to.be.equal("35");

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
        const promise = new Promise (function(resolve){
            let out = process.exec(`cd ..; node cli.js onchaintx --type forcewithdraw --pass ${password} --amount ${amount} --tokenid ${tokenId}`);
            out.stdout.on("data", (data) => {
                resolve(JSON.parse(data));
            });
        });
        let event = await promise;

        for (var key in event.args) {
            if (event.args[key]._hex != undefined){
                event.args[key] = event.args[key]._hex;
            }
        }
        // forge block with no transactions
        // forge block force withdraw
    
        // Simulate exit tree to retrieve siblings

        await forgeBlock();
    
        await forgeBlock([event]);

        await exitTree.addId(1, amount, 0, BigInt(walletBaby.publicKey[0]), BigInt(walletBaby.publicKey[1]), BigInt(walletEth.address), 0);
    
        //checkBatchNumber([resForceWithdraw.logs[0]]);
    });
    
    it("Should withdraw tokens", async () => {
        // Steps:
        // - Get data from 'exitTree'
        // - Transaction to withdraw amount indicated in previous step
        const amount = 10;
        const tokenId = 0;

        const promise = new Promise (function(resolve){
            let out = process.exec(`cd ..; node cli.js onchaintx --type withdraw --pass ${password} --amount ${amount} --tokenid ${tokenId}`);
            out.stdout.on("data", (data) => {
                resolve((data));
            });
        });
        await promise;

        const resRollup = await insTokenRollup.balanceOf(insRollupTest.address);
        const reswalletEth = await insTokenRollup.balanceOf(walletEth.address);
        expect(resRollup.toString()).to.be.equal("5");
        expect(reswalletEth.toString()).to.be.equal("45");
    });

});
