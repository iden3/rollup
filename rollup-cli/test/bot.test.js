/* eslint-disable no-underscore-dangle */
/* global artifacts */
/* global contract */
/* global web3 */

const chai = require("chai");
const { Wallet } = require("../src/wallet.js");
const { expect } = chai;
const fs = require("fs");
const TokenRollup = artifacts.require("../../../../contracts/test/TokenRollup");
const configBot = "../tools/resourcesBot/configBot.json";

const poseidonUnit = require("circomlib/src/poseidon_gencontract");
const Verifier = artifacts.require("../../../../contracts/test/VerifierHelper");
const RollupTest = artifacts.require("../../../../contracts/test/RollupTest");
const process = require("child_process");

contract("Rollup", async (accounts) => {

    let insPoseidonUnit;
    let insTokenRollup;
    let insRollupTest;
    let insVerifier;
    let walletEth;

    const maxTx = 101;
    const maxOnChainTx = 100;

    const tokenInitialAmount = 400;
    const {
        0:owner,
        1: id1,
        2: tokenList,
        4: providerfunds,
    } = accounts;



    before(async () => {

        //contracts: 
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

        insTokenRollup = await TokenRollup.new(id1, tokenInitialAmount);

        
        let walletRollup= await Wallet.createRandom();

        walletEth = walletRollup.ethWallet.wallet;
        
        //update configBot.json with new SC address
        let actualConfigBot = {};
        if (fs.existsSync(configBot)){
            actualConfigBot = JSON.parse(fs.readFileSync(configBot, "utf8"));
        }
        //rewrite contract address in config.json
        actualConfigBot.addressTokens = insTokenRollup.address;
        actualConfigBot.addressRollup = insRollupTest.address;

        let walletBotPath = actualConfigBot.walletFunder;
        fs.writeFileSync(configBot, JSON.stringify(actualConfigBot,null,1), "utf-8");
        //New wallet for Bot
        fs.writeFileSync(walletBotPath, JSON.stringify(await walletRollup.toEncryptedJson("foo"),null,1), "utf-8");


       
       
    });

    it("Distribute tokens and funds", async () => {
        await insTokenRollup.transfer(walletEth.address, 300, { from: id1 });

        let balance = await web3.eth.getBalance(providerfunds);
        let account = 4;
        while (web3.utils.fromWei(balance) <90){
            account++;
            balance=  await web3.eth.getBalance(accounts[account]);
        }
        web3.eth.sendTransaction({to:walletEth.address, from:accounts[account], value: web3.utils.toWei("90", "ether")});//provide funds to our account
    });

    it("Rollup token listing", async () => {
        // Check balances token
        const resWalletEth = await insTokenRollup.balanceOf(walletEth.address);
        const resId1 = await insTokenRollup.balanceOf(id1);
        expect(resWalletEth.toString()).to.be.equal("300");
        expect(resId1.toString()).to.be.equal("100");

        // Add token to rollup token list
        const resAddToken = await insRollupTest.addToken(insTokenRollup.address,
            { from: tokenList, value: web3.utils.toWei("1", "ether") });

        expect(resAddToken.logs[0].event).to.be.equal("AddToken");
        expect(resAddToken.logs[0].args.tokenAddress).to.be.equal(insTokenRollup.address);
        expect(resAddToken.logs[0].args.tokenId.toString()).to.be.equal("0");

    });

    //recommended comment this case and execute yourself, in order to see logs and errors
    it("test bot", async () => {
        process.execSync("node ../tools/bot.js doall");
        const resWalletEth = await insTokenRollup.balanceOf(walletEth.address);
        expect(resWalletEth.toString()).to.be.equal("260"); //300-(10tokens*4wallets)= 260
    });
});
