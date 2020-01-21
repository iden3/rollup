/* eslint-disable no-underscore-dangle */
/* eslint-disable no-await-in-loop */
/* global artifacts */
/* global contract */
/* global web3 */

// This test assumes 'server-proof' is running locally on port 10001
// This test assumes 'ganache-cli' is run with flag '-b 1' to enable block time for minning instead of auto-mining 

const chai = require("chai");
const ethers = require("ethers");
const timeTravel = require("../../test/contracts/helpers/timeTravel");
const { timeout } = require("../src/utils");

const { expect } = chai;
const poseidonUnit = require("../../node_modules/circomlib/src/poseidon_gencontract.js");
const MemDb = require("../../rollup-utils/mem-db");
const RollupDB = require("../../js/rollupdb");
const SMTMemDB = require("circomlib/src/smt_memdb");
const utils = require("../../rollup-utils/rollup-utils");

const TokenRollup = artifacts.require("../contracts/test/TokenRollup");
const Verifier = artifacts.require("../contracts/test/VerifierHelper");
const RollupPoS = artifacts.require("../contracts/RollupPoS");
const Rollup = artifacts.require("../contracts/Rollup");

const RollupSynch = require("../src/synch");
const PoSSynch = require("../src/synch-pos");
const OperatorManager = require("../src/operator-manager");
const Pool = require("../src/pool-tx");
const CliServerProof = require("../src/cli-proof-server");
const LoopManager = require("../src/loop-manager");

// timeouts test
const timeoutSynch = 20000;
const timeoutFinal = 40000;

contract("Loop Manager", async (accounts) => { 

    const {
        0: owner,
        1: id1,
        2: rollupSynchAddress,
        3: posSynchAddress,
        4: tokenList,
        5: feeTokenAddress,
    } = accounts;

    const slotPerEra = 20;
    const blocksPerSlot = 100;
    const blockPerEra = slotPerEra * blocksPerSlot;

    const tokenInitialAmount = 50;
    const maxTx = 10;
    const maxOnChainTx = 3;
    const gasLimit = "default";
    const gasMultiplier = 1;

    let insPoseidonUnit;
    let insTokenRollup;
    let insRollupPoS;
    let insRollup;
    let insVerifier;

    // Operator wallet
    let wallet;

    // Instances to load on loop manager
    let rollupSynch;
    let posSynch;
    let poolTx;
    let opManager;
    let cliServerProof;

    let loopManager;

    let synchDb;
    let db;
    let synchRollupDb;
    let synchPoSDb;

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
        insRollup = await Rollup.new(insVerifier.address, insPoseidonUnit._address,
            maxTx, maxOnChainTx, feeTokenAddress, { from: owner });

        // Deploy Staker manager
        insRollupPoS = await RollupPoS.new(insRollup.address, maxTx);

        // Add forge batch mechanism
        await insRollup.loadForgeBatchMechanism(insRollupPoS.address, { from: owner });
        // Add token to rollup token list
        await insRollup.addToken(insTokenRollup.address,
            { from: tokenList, value: web3.utils.toWei("1", "ether") });

        // load wallet with funds
        let privateKey = "0x0123456789012345678901234567890123456789012345678901234567890123";
        wallet = new ethers.Wallet(privateKey);
        const initBalance = 5;
        await web3.eth.sendTransaction({to: wallet.address, from: owner,
            value: web3.utils.toWei(initBalance.toString(), "ether")});
    });

    it("Should initialize loop manager", async () => {
        
        // Init Rollup Synch
        synchDb = new MemDb();
        db = new SMTMemDB();
        synchRollupDb = await RollupDB(db);

        let configRollupSynch = {
            treeDb: synchRollupDb,
            synchDb: synchDb,
            ethNodeUrl: "http://localhost:8545",
            contractAddress: insRollup.address,
            creationHash: insRollup.transactionHash,
            ethAddress: rollupSynchAddress,
            abi: Rollup.abi,
            rollupPoSAddress: insRollupPoS.address,
            rollupPoSABI: RollupPoS.abi,
            logLevel: "debug",
            timeouts: { ERROR: 1000, NEXT_LOOP: 2500, LOGGER: 5000},
        };
        
        rollupSynch = new RollupSynch(configRollupSynch.synchDb,
            configRollupSynch.treeDb,
            configRollupSynch.ethNodeUrl,
            configRollupSynch.contractAddress,
            configRollupSynch.abi,
            configRollupSynch.rollupPoSAddress,
            configRollupSynch.rollupPoSABI, 
            configRollupSynch.creationHash,
            configRollupSynch.ethAddress,
            configRollupSynch.logLevel,
            configRollupSynch.timeouts,
        );
        
        // Init PoS Synch
        synchPoSDb = new MemDb();

        let configSynchPoS = {
            synchDb: synchPoSDb,
            ethNodeUrl: "http://localhost:8545",
            contractAddress: insRollupPoS.address,
            creationHash: insRollupPoS.transactionHash,
            ethAddress: posSynchAddress,
            abi: RollupPoS.abi,
            logLevel: "debug",
            timeouts: { ERROR: 1000, NEXT_LOOP: 2500, LOGGER: 5000},
        };
        
        posSynch = new PoSSynch(
            configSynchPoS.synchDb,
            configSynchPoS.ethNodeUrl,
            configSynchPoS.contractAddress,
            configSynchPoS.abi,
            configSynchPoS.creationHash,
            configSynchPoS.ethAddress,
            configSynchPoS.logLevel,
            configSynchPoS.timeouts);
        
        // Init operator manager
        opManager = new OperatorManager(
            configSynchPoS.ethNodeUrl,
            configSynchPoS.contractAddress, 
            configSynchPoS.abi,
            wallet,
            gasMultiplier,
            gasLimit);
        
        // Init Pool
        poolTx = new Pool(maxTx);

        // Init client to interact with server proof
        const port = 10001;
        const url = `http://localhost:${port}`;
        cliServerProof = new CliServerProof(url);
        await cliServerProof.cancel(); // Reset server proof
        
        // Init loop Manager
        loopManager = new LoopManager(
            rollupSynch,
            posSynch,
            poolTx, 
            opManager,
            cliServerProof,
            configSynchPoS.logLevel,
            configSynchPoS.ethNodeUrl,
            configSynchPoS.timeouts,
        );
               
        // Init loops    
        loopManager.startLoop();
        rollupSynch.synchLoop();
        posSynch.synchLoop();
    });

    let hashChain;
    
    it("Should calculate hashChain", async () => {
        const seed = utils.getSeedFromPrivKey(wallet.privateKey);
        hashChain = utils.loadHashChain(seed);
        await loopManager.loadSeedHashChain(seed);
    });

    it("Should register operator", async () => {
        const url = "localhost";
        const amountToStake = 2;

        const txSign = await opManager.getTxRegister(hashChain[hashChain.length - 1], amountToStake, url);
        const resRegister = await web3.eth.sendSignedTransaction(txSign.rawTransaction);
        expect(resRegister.status).to.be.equal(true);

        const currentBlock = await web3.eth.getBlockNumber();
        const genesisBlock = posSynch.genesisBlock;
        await timeTravel.addBlocks(genesisBlock - currentBlock + 1); // era 0
        await timeout(timeoutSynch);
        const listOperators = await posSynch.getOperators();
        // check address operator is in list operators
        let found = false;
        for (const opInfo of Object.values(listOperators)){
            if (opInfo.controllerAddress == wallet.address.toString()){
                found = true;
            }
        }
        expect(found).to.be.equal(true);
    });

    it("Should wait until operator turn", async () => {
        await timeTravel.addBlocks(blockPerEra); // era 1
        await timeout(timeoutSynch);
    });

    it("Should forge genesis block", async () => {
        await timeTravel.addBlocks(blockPerEra); // era 2
        await timeout(timeoutSynch);
    });

    it("Should forge another empty block", async () => {
        await timeout(timeoutFinal);
    });

    describe("State check", () => {
        let opId;
        it("Should get operator id", async () => {
            const listOperators = await posSynch.getOperators();
            for (const opInfo of Object.values(listOperators)){
                if (opInfo.controllerAddress == wallet.address.toString()){
                    opId = Number(opInfo.operatorId);
                    break;
                }
            }
        });

        it("Should win all the raffles", async () => {
            let winners = await posSynch.getRaffleWinners();
            for(let i = 0; i < winners.length; i++) {
                expect(winners[i]).to.be.equal(opId);
            }
        });

        it("Should forge at least one batch", async () => {
            const lastBatch = await rollupSynch.getLastBatch();
            expect(lastBatch).to.be.above(-1);
        });
    });
});