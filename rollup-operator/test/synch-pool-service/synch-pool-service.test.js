/* global artifacts */
/* global contract */
/* global web3 */
const { expect } = require("chai");

const poseidonUnit = require("circomlib/src/poseidon_gencontract");
const TokenRollup = artifacts.require("../contracts/test/TokenRollup");
const TokenTest = artifacts.require("../contracts/test/TokenTest");
const Verifier = artifacts.require("../contracts/test/VerifierHelper");
const Rollup = artifacts.require("../contracts/test/Rollup");
const MemDb = require("../../../rollup-utils/mem-db");
const { timeout } = require("../../src/utils");
const SynchPool = require("../../src/synch-pool-service/synch-pool-service");
const fs = require("fs");
const path = require("path");

const pathConversionTable = path.join(__dirname,"./config/table-conversion-test.json");
const pathCustomTokens = path.join(__dirname,"./config/custom-test.json");

contract("Synnchronizer Pool", (accounts) => {
    const {
        0: owner,
        1: tokenAddress,
        2: feeTokenAddress,
        3: ethAddress,
    } = accounts;

    const timeoutDelay = 2500;
    const maxTx = 10;
    const maxOnChainTx = 5;
    const tokenInitialAmount = 1000;

    let timeoutSynch;
    let insPoseidonUnit;
    let insTokenRollup;
    let insRollup;
    let insVerifier;
    let synchPool;

    after (async () => {
        fs.unlinkSync(pathConversionTable);
        fs.unlinkSync(pathCustomTokens);
    });

    before(async () => {
        // Deploy poseidon
        const C = new web3.eth.Contract(poseidonUnit.abi);
        insPoseidonUnit = await C.deploy({ data: poseidonUnit.createCode() })
            .send({ gas: 2500000, from: owner });

        // Deploy TokenRollup
        insTokenRollup = await TokenRollup.new(tokenAddress, tokenInitialAmount);

        // Deploy Verifier
        insVerifier = await Verifier.new();

        // Deploy Rollup
        insRollup = await Rollup.new(insVerifier.address, insPoseidonUnit._address,
            maxTx, maxOnChainTx, feeTokenAddress);
    });

    it("Should initialize synchronizer pool", async () => {
        const db = new MemDb();

        let config = {
            synchDb: db,
            ethNodeUrl: "http://localhost:8545",
            ethAddress: ethAddress,
            rollupAddress: insRollup.address,
            rollupAbi: Rollup.abi,
            logLevel: "debug",
            pathConversionTable: pathConversionTable,
            pathCustomTokens: pathCustomTokens,
            timeouts: { ERROR: 6000, NEXT_LOOP: 5000},
        };

        synchPool = new SynchPool(
            config.synchDb,
            config.ethNodeUrl,
            config.ethAddress,
            config.rollupAddress,
            config.rollupAbi,
            config.logLevel,
            config.pathConversionTable,
            config.pathCustomTokens,
            config.timeouts);
        synchPool.synchLoop();

        timeoutSynch = synchPool.timeouts.NEXT_LOOP + timeoutDelay;
    });

    it("Should add token: no api & no custom", async () => {
        // Add token to rollup
        const res = await insRollup.addToken(insTokenRollup.address,
            { from: tokenAddress, value: web3.utils.toWei("1", "ether") });
        const tokenId = Number(res.logs[0].args.tokenId);

        // wait for synch
        await timeout(timeoutSynch);

        // check conversion table
        const tableJson = JSON.parse(fs.readFileSync(pathConversionTable));
        const infoToken = tableJson[tokenId];
        expect(infoToken.tokenSymbol).to.be.equal("NOT_FOUND");
        expect(infoToken.decimals).to.be.equal(18);
        expect(infoToken.tokenAddress).to.be.equal(insTokenRollup.address);
        expect(infoToken.price).to.be.equal(0);
    });

    it("Should add token: no api & yes custom", async () => {
        // Deploy token
        const insTokenTest = await TokenTest.new(tokenAddress, tokenInitialAmount,
            "TOKENTEST", "TEST0", 15 );
        
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

        // Wait for synch
        await timeout(timeoutSynch);

        // check conversion table
        const tableJson = JSON.parse(fs.readFileSync(pathConversionTable));
        const infoToken = tableJson[tokenId];
        expect(infoToken.tokenSymbol).to.be.equal("TEST0");
        expect(infoToken.decimals).to.be.equal(15);
        expect(infoToken.tokenAddress).to.be.equal(insTokenTest.address);
        expect(infoToken.price).to.be.equal(20);
    });

    it("Should add token: yes api", async () => {
        // Deploy token
        const insTokenTest = await TokenTest.new(tokenAddress, tokenInitialAmount,
            "ARAGON", "ANT", 15 );

        // Add token to rollup
        const res = await insRollup.addToken(insTokenTest.address,
            { from: tokenAddress, value: web3.utils.toWei("1", "ether") });
        const tokenId = Number(res.logs[0].args.tokenId);    
        
        // Wait to synch
        await timeout(timeoutSynch);

        // check conversion table
        const tableJson = JSON.parse(fs.readFileSync(pathConversionTable));
        const infoToken = tableJson[tokenId];
        expect(infoToken.tokenSymbol).to.be.equal("ANT");
        expect(infoToken.decimals).to.be.equal(15);
        expect(infoToken.tokenAddress).to.be.equal(insTokenTest.address);
        expect(infoToken.price).to.be.not.equal(0);
    });
});