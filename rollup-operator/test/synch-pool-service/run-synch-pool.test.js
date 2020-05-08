/* global artifacts */
/* global contract */
/* global web3 */
const { expect } = require("chai");
const process = require("child_process");

const TokenRollup = artifacts.require("../contracts/test/TokenRollup");
const TokenTest = artifacts.require("../contracts/test/TokenTest");
const Rollup = artifacts.require("../contracts/test/Rollup");
const { timeout } = require("../../src/utils"); 
const fs = require("fs");
const path = require("path");

const configSynchPoolPath = path.join(__dirname, "./config/config-test.json");

contract("Run Synchronizer Pool", (accounts) => {
    const {
        1: tokenAddress,
    } = accounts;

    const tokenInitialAmount = 100;
    const timeoutDelay = 2500;
    let timeoutSynch;

    let insRollup;
    let pathConversionTable;
    let pathCustomTokens;

    after (async () => {
        fs.unlinkSync(pathConversionTable);
        fs.unlinkSync(pathCustomTokens);
    });

    before(async () => {
        // Load test configuration
        const configTest = JSON.parse(fs.readFileSync(configSynchPoolPath));
        // Load Rollup
        insRollup = await Rollup.at(configTest.rollupAddress);
        // Set timeouts
        timeoutSynch = configTest.timeouts.NEXT_LOOP + timeoutDelay;
        // load path conversion table and custom tokens
        pathConversionTable = configTest.pathConversionTable;
        pathCustomTokens = configTest.pathCustomTokens;
    });

    it("Should add token: no api & no custom", async () => {
        // Deploy token
        const insTokenTest = await TokenRollup.new(tokenAddress, tokenInitialAmount);
        
        // Add token to rollup
        const res = await insRollup.addToken(insTokenTest.address,
            { from: tokenAddress, value: web3.utils.toWei("1", "ether") });
        const tokenId = Number(res.logs[0].args.tokenId);
        
        // wait for synch    
        await timeout(timeoutSynch);

        // check conversion table
        const tableJson = JSON.parse(fs.readFileSync(pathConversionTable));
        const infoToken = tableJson.conversion[tokenId];
        const ethPrice = tableJson.ethPrice;

        expect(ethPrice).to.be.not.equal(undefined);
        expect(infoToken.tokenSymbol).to.be.equal("NOT_FOUND");
        expect(infoToken.decimals).to.be.equal(18);
        expect(infoToken.tokenAddress).to.be.equal(insTokenTest.address);
        expect(infoToken.price).to.be.equal(0);
    });

    it("Should add token: no api & yes custom", async () => {
        // Deploy token
        const insTokenTest = await TokenTest.new(tokenAddress, tokenInitialAmount,
            "TOKENTEST", "TEST0", 15);
        
        // Add token to rollup
        const res = await insRollup.addToken(insTokenTest.address,
            { from: tokenAddress, value: web3.utils.toWei("1", "ether") });
        const tokenId = Number(res.logs[0].args.tokenId);
        
        // Write custom table
        const tableConversion = {};
        tableConversion[insTokenTest.address] = {
            price: 20,
            decimals: 15,
        };
        fs.writeFileSync(pathCustomTokens, JSON.stringify(tableConversion));

        // wait for synch
        await timeout(timeoutSynch);

        // check conversion table
        const tableJson = JSON.parse(fs.readFileSync(pathConversionTable));
        const infoToken = tableJson.conversion[tokenId];
        const ethPrice = tableJson.ethPrice;

        expect(ethPrice).to.be.not.equal(undefined);
        expect(infoToken.tokenSymbol).to.be.equal("TEST0");
        expect(infoToken.decimals).to.be.equal(15);
        expect(infoToken.tokenAddress).to.be.equal(insTokenTest.address);
        expect(infoToken.price).to.be.equal(20);
    });

    it("Should add token: yes api", async () => {
        // Deploy token
        const insTokenTest = await TokenTest.new(tokenAddress, tokenInitialAmount,
            "ARAGON", "ANT", 18);
        
        // Add token to rollup
        const res = await insRollup.addToken(insTokenTest.address,
            { from: tokenAddress, value: web3.utils.toWei("1", "ether") });
        const tokenId = Number(res.logs[0].args.tokenId);

        // wait for synch
        await timeout(timeoutSynch);

        // check conversion table
        const tableJson = JSON.parse(fs.readFileSync(pathConversionTable));
        const infoToken = tableJson.conversion[tokenId];
        const ethPrice = tableJson.ethPrice;

        expect(ethPrice).to.be.not.equal(undefined);
        expect(infoToken.tokenSymbol).to.be.equal("ANT");
        expect(infoToken.decimals).to.be.equal(18);
        expect(infoToken.tokenAddress).to.be.equal(insTokenTest.address);
        expect(infoToken.price).to.be.not.equal(0);
    });

    after(async () => {
        process.exec("find . -depth -type d -name 'tmp-*' -prune -exec rm -rf {} +");
    });
});