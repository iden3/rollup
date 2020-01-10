/* global artifacts */
/* global contract */
/* global web3 */
const poseidonUnit = require("circomlib/src/poseidon_gencontract");
const TokenRollup = artifacts.require("../contracts/test/TokenRollup");
const Verifier = artifacts.require("../contracts/test/VerifierHelper");
const Rollup = artifacts.require("../contracts/test/Rollup");
const Pool = require("../../js/txpool");
const RollupDB = require("../../js/rollupdb");
const MemDb = require("../../rollup-utils/mem-db");
const SMTMemDB = require("circomlib/src/smt_memdb");
const { timeout } = require("../src/utils");
const SynchPool = require("../src/synch-pool");

contract("Synnchronizer Pool", (accounts) => {
    const {
        0: owner,
        1: tokenId,
    } = accounts;

    const maxTx = 10;
    const maxOnChainTx = 5;
    const tokenInitialAmount = 1000;

    let insPoseidonUnit;
    let insTokenRollup;
    let insRollup;
    let insVerifier;
    let pool;
    let synchPool;

    let configSynchPool = {
        synchDb: undefined,
        ethNodeUrl: "http://localhost:8545",
        contractAddress: undefined,
        abi: Rollup.abi,
        pool: undefined,
        logLevel: "debug",
    };

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

        // add token to Rollup
        await insRollup.addToken(insTokenRollup.address,
            { from: tokenId, value: web3.utils.toWei("1", "ether") });
            
        const db = new MemDb();
        const db2 = new SMTMemDB();
        const conversion = {};
        const initRollupDb = await RollupDB(db2);
        const poolConfig = {"maxSlots":10,"executableSlots":1,"nonExecutableSlots":1,"timeout":1000}; 
        pool = await Pool(initRollupDb, conversion, poolConfig);
        
        configSynchPool.synchDb = db;
        configSynchPool.contractAddress = insRollup.address;
        configSynchPool.pool = pool;
    });

    it("Should initialize synchronizer pool", async () => {
        synchPool = new SynchPool(configSynchPool.synchDb, configSynchPool.ethNodeUrl, configSynchPool.contractAddress,
            configSynchPool.abi, configSynchPool.pool, configSynchPool.logLevel);
        synchPool.synchLoop();
        await timeout(6000);
    });
    it("Sholud add token", async () => {
        await insRollup.addToken(insTokenRollup.address,
            { from: tokenId, value: web3.utils.toWei("1", "ether") });
        await timeout(2000);
    });
});