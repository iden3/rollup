/* global artifacts */
/* global contract */
/* global web3 */
const poseidonUnit = require("circomlib/src/poseidon_gencontract");
const TokenRollup = artifacts.require("../contracts/test/TokenRollup");
const Verifier = artifacts.require("../contracts/test/VerifierHelper");
const RollupPoS = artifacts.require("../contracts/RollupPoS");
const Rollup = artifacts.require("../contracts/test/Rollup");
const fs = require("fs");
const path = require("path");

const configSynchPath = path.join(__dirname, "../config/synch-config-test.json");
const configPoolPath = path.join(__dirname, "../config/pool-config-test.json");
const configTestPath = path.join(__dirname, "../config/test.json");

contract("Operator Server", (accounts) => {
    const {
        0: owner,
        1: tokenId,
        2: callerAddress,
    } = accounts;

    const maxTx = 10;
    const maxOnChainTx = 5;
    const tokenInitialAmount = 1000;

    let insPoseidonUnit;
    let insTokenRollup;
    let insRollupPoS;
    let insRollup;
    let insVerifier;

    before(async () => {
        // Deploy poseidon
        const C = new web3.eth.Contract(poseidonUnit.abi);
        insPoseidonUnit = await C.deploy({ data: poseidonUnit.createCode() })
            .send({ gas: 2500000, from: owner });

        // Deploy TokenRollup
        insTokenRollup = await TokenRollup.new(tokenId, tokenInitialAmount);

        // Deploy Verifier
        insVerifier = await Verifier.new();

        // Deploy Rollup test
        insRollup = await Rollup.new(insVerifier.address, insPoseidonUnit._address,
            maxTx, maxOnChainTx);

        // Deploy Staker manager
        insRollupPoS = await RollupPoS.new(insRollup.address, maxTx);

        // load forge batch mechanism
        await insRollup.loadForgeBatchMechanism(insRollupPoS.address);

        // add token to Rollup
        await insRollup.addToken(insTokenRollup.address,
            { from: tokenId, value: web3.utils.toWei("1", "ether") });
    });

    it("Should create rollup synch config file", async () => {
        const pathRollupSynch = `${__dirname}/tmp-0`;
        const pathRollupTree = `${__dirname}/tmp-1`;
        const pathRollupPoSSynch = `${__dirname}/tmp-2`;
        
        const config = {
            rollup: {
                synchDb: pathRollupSynch,
                treeDb: pathRollupTree,
                address: insRollup.address,
                abi: Rollup.abi,
                creationHash: insRollup.transactionHash,
            },
            rollupPoS: {
                synchDb: pathRollupPoSSynch,
                address: insRollupPoS.address,
                abi: RollupPoS.abi,
                creationHash: insRollupPoS.transactionHash,
            },
            ethNodeUrl:"http://localhost:8545",
            ethAddressCaller: callerAddress,
        };
        fs.writeFileSync(configSynchPath, JSON.stringify(config));
    });

    it("Should create pool config file", async () => {
        const config = {
            maxSlots: 10,               
            executableSlots: 1,      
            nonExecutableSlots: 1,      
            timeout: 1000            
        };
        fs.writeFileSync(configPoolPath, JSON.stringify(config));
    });

    it("Should expose data to run server test", async () => {
        const testConfig = {
            rollupAddress: insRollup.address,
            tokenAddress: insTokenRollup.address,
            posAddress: insRollupPoS.address,
        };
        fs.writeFileSync(configTestPath, JSON.stringify(testConfig));
    });
});
