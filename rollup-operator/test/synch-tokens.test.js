/* global artifacts */
/* global contract */
/* global web3 */

const { expect } = require("chai");
const Scalar = require("ffjavascript").Scalar;
const poseidonUnit = require("circomlib/src/poseidon_gencontract");

const TokenRollup = artifacts.require("TokenRollup");
const Verifier = artifacts.require("VerifierHelper");
const Rollup = artifacts.require("Rollup");
const MemDb = require("../../rollup-utils/mem-db");
const { timeout } = require("../src/utils");
const SynchTokens = require("../src/synch-tokens");

contract("Synnchronizer Tokens", (accounts) => {
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
    let synchTokens;

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

    it("Should initialize synchronizer tokens", async () => {
        const db = new MemDb();

        let config = {
            synchDb: db,
            ethNodeUrl: "http://localhost:8545",
            ethAddress: ethAddress,
            rollupAddress: insRollup.address,
            rollupAbi: Rollup.abi,
            logLevel: "debug",
            timeouts: { ERROR: 5000, NEXT_LOOP: 5000},
        };

        synchTokens = new SynchTokens(
            config.synchDb,
            config.ethNodeUrl,
            config.ethAddress,
            config.rollupAddress,
            config.rollupAbi,
            config.logLevel,
            config.timeouts);
        synchTokens.synchLoop();

        timeoutSynch = synchTokens.timeouts.NEXT_LOOP + timeoutDelay;
    });

    it("Should add token", async () => {
        // get current token fee
        const feeToken = Scalar.e(await insRollup.feeAddToken()).toString();
        const feeTokenSynch = synchTokens.getCurrentFee();

        expect(feeToken).to.be.equal(feeTokenSynch);
        
        // Add token to rollup
        await insRollup.addToken(insTokenRollup.address,
            { from: tokenAddress, value: feeToken });

        // wait for synch
        await timeout(2*timeoutSynch);        
    });

    it("Should get token information", async () => {
        // id first token added
        const tokenId = 0;
        // check fee tokens
        const feeToken = Scalar.e(await insRollup.feeAddToken()).toString();
        const feeTokenSynch = synchTokens.getCurrentFee();

        expect(feeToken).to.be.equal(feeTokenSynch);
    
        // check token list
        const tokenList = synchTokens.getTokensList();
        expect(tokenList[tokenId]).to.be.equal(insTokenRollup.address);
    });

    it("Should add bunch of tokens and synchronize", async () => {
        // Add tokens
        const numTokens = 20;
        const tokenIds = {};
        let insToken;
        for (let i = 0; i < numTokens; i++){
            const feeToken = Scalar.e(await insRollup.feeAddToken()).toString();
            insToken = await TokenRollup.new(tokenAddress, tokenInitialAmount);
            const res = await insRollup.addToken(insToken.address,
                { from: tokenAddress, value: feeToken });
            tokenIds[Number(res.logs[0].args.tokenId)] = res.logs[0].args.tokenAddress;
        }

        // wait for synch
        await timeout(2*timeoutSynch);

        // check fee tokens
        const feeToken = Scalar.e(await insRollup.feeAddToken()).toString();
        const feeTokenSynch = synchTokens.getCurrentFee();

        expect(feeToken).to.be.equal(feeTokenSynch);

        // check token list
        const tokenList = synchTokens.getTokensList();
        
        for (let tokenId of Object.keys(tokenIds)){
            const tokenAddress = tokenIds[tokenId];
            expect(tokenAddress).to.be.equal(tokenList[tokenId]);
        }
    });
});