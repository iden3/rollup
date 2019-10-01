/* global artifacts */
/* global contract */
/* global web3 */
const poseidonUnit = require("circomlib/src/poseidon_gencontract");
const TokenRollup = artifacts.require("../contracts/test/TokenRollup");
const Verifier = artifacts.require("../contracts/test/VerifierHelper");
const RollupPoS = artifacts.require("../contracts/RollupPoS");
const RollupTest = artifacts.require("../contracts/test/RollupTest");
const fs = require("fs");
const path = require("path");

const configPath = path.join(__dirname, "../config/rollup-synch-config-test.json");
const configPathPoS = path.join(__dirname, "../config/pos-synch-config-test.json");
const configPathOpManager = path.join(__dirname, "../config/op-manager-config-test.json");
const configTestPath = path.join(__dirname, "../config/test.json");

contract("Operator Server", (accounts) => {
    const {
        0: owner,
        1: id1,
        2: synchAddress,
        77: debugAddress,
    } = accounts;

    const maxTx = 10;
    const maxOnChainTx = 5;
    const tokenInitialAmount = 1000;

    let insPoseidonUnit;
    let insTokenRollup;
    let insRollupPoS;
    let insRollupTest;
    let insVerifier;

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
        insRollupPoS = await RollupPoS.new(insRollupTest.address);

        // load forge batch mechanism ( not used in this test)
        await insRollupTest.loadForgeBatchMechanism(insRollupPoS.address);
    });

    it("Should create rollup synch config file", async () => {
        const config = {
            syncDb: undefined,
            treeDb: undefined,
            ethNodeUrl:"http://localhost:8545",
            contractAddress: insRollupTest.address,
            creationHash: insRollupTest.transactionHash,
            ethAddress: synchAddress,
            abi: RollupTest.abi,
        };
        fs.writeFileSync(configPath, JSON.stringify(config));
    });

    it("Should create pos synch config file", async () => {
        const config = {
            syncDb: undefined,
            ethNodeUrl:"http://localhost:8545",
            contractAddress: insRollupPoS.address,
            creationHash: insRollupPoS.transactionHash,
            ethAddress: synchAddress,
            abi: RollupPoS.abi,
        };
        fs.writeFileSync(configPathPoS, JSON.stringify(config));
    });

    it("Should create operator manager config file", async () => {
        const config = {
            wallet: undefined,
            pass: undefined,
            ganacheAddress: debugAddress,
        };
        fs.writeFileSync(configPathOpManager, JSON.stringify(config));
    });

    it("Should expose data to run server test", async () => {
        const testConfig = {
            rollupAddress: insRollupTest.address,
            tokenAddress: insTokenRollup.address,
            posAddress: insRollupPoS.address,
        };
        fs.writeFileSync(configTestPath, JSON.stringify(testConfig));
    });
});
