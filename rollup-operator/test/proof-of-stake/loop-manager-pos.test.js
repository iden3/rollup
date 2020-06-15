/* eslint-disable no-underscore-dangle */
/* eslint-disable no-await-in-loop */
/* global artifacts */
/* global contract */
/* global web3 */

// This test assumes 'server-proof' is running locally on port 10001
// This test assumes 'ganache-cli' is run with flag '-b 1' to enable block time for minning instead of auto-mining 

const { expect } = require("chai");
const ethers = require("ethers");
const SMTMemDB = require("circomlib/src/smt_memdb");
const Scalar = require("ffjavascript").Scalar;

const timeTravel = require("../../../test/contracts/helpers/timeTravel");
const { timeout } = require("../../src/utils");
const testUtils = require("../helpers/utils-test");

const poseidonUnit = require("circomlib/src/poseidon_gencontract");
const MemDb = require("../../../rollup-utils/mem-db");
const RollupDB = require("../../../js/rollupdb");
const utils = require("../../../rollup-utils/rollup-utils");
const RollupAccount = require("../../../js/rollupaccount");

const TokenRollup = artifacts.require("../contracts/test/TokenRollup");
const Verifier = artifacts.require("../contracts/test/VerifierHelper");
const RollupPoS = artifacts.require("../contracts/RollupPoS");
const Rollup = artifacts.require("../contracts/Rollup");

const RollupSynch = require("../../src/synch");
const PoSSynch = require("../../src/proof-of-stake/synch-pos");
const OperatorManager = require("../../src/proof-of-stake/interface-pos");
const Pool = require("../../../js/txpool");
const CliServerProof = require("../../src/cli-proof-server");
const LoopManager = require("../../src/proof-of-stake/loop-manager-pos");
const { exitAx, exitEthAddr, exitAy, fee } = require("../../../js/constants");

// timeouts test
const timeoutSynch = 20000;
const timeoutLoop = 10000;

function to18(e) {
    return Scalar.mul(e, Scalar.pow(10, 18));
}

contract("Loop Manager", async (accounts) => { 

    const {
        0: id0,
        1: id1,
        2: id2,
        // eslint-disable-next-line no-unused-vars
        3: id3,
        // eslint-disable-next-line no-unused-vars
        4: id4,
        5: rollupSynchAddress,
        6: posSynchAddress,
        7: tokenList,
        8: feeTokenAddress,
        9: owner,
    } = accounts;

    let publicData;
    let slotPerEra;
    let blocksPerSlot;
    let blockPerEra;
    let genesisBlock;

    const tokenInitialAmount = to18(1000);
    const maxTx = 10;
    const maxOnChainTx = 3;
    const tokenId = 0;
    const gasLimit = "default";
    const gasMultiplier = 1;

    let insPoseidonUnit;
    let insTokenRollup;
    let insRollupPoS;
    let insRollup;
    let insVerifier;

    // BabyJubjub public key
    const rollupAccounts = [];

    for (let i = 0; i < 5; i++){
        const wallet = new RollupAccount(i);
        const Ax = Scalar.fromString(wallet.ax, 16).toString();
        const Ay = Scalar.fromString(wallet.ay, 16).toString();
        const AxHex = wallet.ax;
        const AyHex = wallet.ay;
        rollupAccounts.push({Ax, Ay, AxHex, AyHex, ethAddr: accounts[i], wallet});
    }

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
        insTokenRollup = await TokenRollup.new(rollupAccounts[0].ethAddr, tokenInitialAmount.toString());

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

        // get PoS public data
        publicData = await testUtils.publicDataPoS(insRollupPoS);
        genesisBlock = publicData.genesisBlock;
        slotPerEra = publicData.slotsPerEra;
        blocksPerSlot = publicData.blocksPerSlot;
        blockPerEra = slotPerEra * blocksPerSlot;
    });

    it("manage rollup token", async () => { 
        const amountDistribution = to18(100);

        await insRollup.addToken(insTokenRollup.address,
            { from: owner, value: web3.utils.toWei("1", "ether") });
        await insTokenRollup.transfer(rollupAccounts[1].ethAddr, amountDistribution.toString(), { from: rollupAccounts[0].ethAddr });
        await insTokenRollup.transfer(rollupAccounts[2].ethAddr, amountDistribution.toString(), { from: rollupAccounts[0].ethAddr });
        
        await insTokenRollup.approve(insRollup.address, tokenInitialAmount.toString(),
            { from: rollupAccounts[0].ethAddr });
        await insTokenRollup.approve(insRollup.address, amountDistribution.toString(),
            { from: rollupAccounts[1].ethAddr });
        await insTokenRollup.approve(insRollup.address, amountDistribution.toString(),
            { from: rollupAccounts[2].ethAddr });
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
        const conversion = {
            0: {   
                token: "ROLL",
                price: 1,
                decimals: 18
            },
        };

        poolTx = await Pool(synchRollupDb, conversion);
        poolTx.setEthPrice(210);

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

    it("Should add one deposit", async () => {
        const loadAmount = to18(100);
        await insRollup.deposit(loadAmount.toString(), tokenId, rollupAccounts[0].ethAddr,
            [rollupAccounts[0].Ax, rollupAccounts[0].Ay], { from: id0, value: web3.utils.toWei("1", "ether") });
    });

    it("Should wait until operator turn", async () => {
        await timeTravel.addBlocks(blockPerEra); // era 1
        await timeout(timeoutSynch);
        await timeTravel.addBlocks(blockPerEra); // era 2
        await timeout(timeoutSynch);
    });

    it("Should forge genesis and on-chain transaction", async () => {
        // Account |  0  |  1  |  2  |  3  |  4  |
        // Amount  | 100 | Nan | Nan | Nan | Nan |

        // Check forge batch
        await testUtils.assertForgeBatch(rollupSynch, 1, timeoutLoop);
        // Check balances
        await testUtils.assertBalances(rollupSynch, rollupAccounts, [to18(100), null, null, null, null]);
    });

    it("Should add two deposits, forge them and check states", async () => {
        // Account |  0  |  1  |  2  |  3  |  4  |
        // Amount  | 100 | 100 | 100 | Nan | Nan |

        const lastBatch = await rollupSynch.getLastBatch();

        const loadAmount = to18(100);
        await insRollup.deposit(loadAmount.toString(), tokenId, rollupAccounts[1].ethAddr,
            [rollupAccounts[1].Ax, rollupAccounts[1].Ay], { from: id1, value: web3.utils.toWei("1", "ether") });
        await insRollup.deposit(loadAmount.toString(), tokenId, rollupAccounts[0].ethAddr,
            [rollupAccounts[2].Ax, rollupAccounts[2].Ay], { from: id2, value: web3.utils.toWei("1", "ether") });

        // Check forge batch
        await testUtils.assertForgeBatch(rollupSynch, lastBatch + 1, timeoutLoop);

        // Check balances
        await testUtils.assertBalances(rollupSynch, rollupAccounts, [to18(100), to18(100), to18(100), null, null]);
    });

    it("Should add off-chain transaction, forge it and check states", async () => {
        // Account |  0  |  1  |  2  |  3  |  4  |
        // Amount  |  94 | 104 | 100 | Nan | Nan |

        const lastBatch = await rollupSynch.getLastBatch();

        const tx = {
            toAx: rollupAccounts[1].AxHex,
            toAy: rollupAccounts[1].AyHex,
            toEthAddr: rollupAccounts[1].ethAddr,
            coin: 0,
            amount: to18(4),
            nonce: 0,
            fee: fee["50%"],
        };
        await rollupAccounts[0].wallet.signTx(tx);
        tx.fromEthAddr = rollupAccounts[0].ethAddr;

        await poolTx.addTx(tx);
        
        // Check forge batch
        await testUtils.assertForgeBatch(rollupSynch, lastBatch + 1, timeoutLoop);
        // Check balances
        await testUtils.assertBalances(rollupSynch, rollupAccounts, [to18(94), to18(104), to18(100), null, null]);
    });

    it("Should add deposit off-chain, forge it and check states", async () => {
        // Account |  0  |  1  |  2  |  3  |  4  |
        // Amount  |  94 | 104 |  25 | 50  | Nan |

        const lastBatch = await rollupSynch.getLastBatch();

        const tx = {
            toAx: rollupAccounts[3].AxHex,
            toAy: rollupAccounts[3].AyHex,
            toEthAddr: rollupAccounts[3].ethAddr,
            coin: 0,
            amount: to18(50),
            nonce: 0,
            fee: fee["50%"],
        };
        await rollupAccounts[2].wallet.signTx(tx);
        tx.fromEthAddr = rollupAccounts[2].ethAddr;

        await poolTx.addTx(tx);
        
        // Check forge batch
        await testUtils.assertForgeBatch(rollupSynch, lastBatch + 1, timeoutLoop);
        // Check balances
        await testUtils.assertBalances(rollupSynch, rollupAccounts, [to18(94), to18(104), to18(25), to18(50), null]);
    });

    it("Should add withdraw off-chain transaction, forge it and check states", async () => {
        // Account |  0  |  1  |  2  |  3  |  4  |
        // Amount  |  94 | 104 |  25 |  47 | Nan |

        const lastBatch = await rollupSynch.getLastBatch();

        const tx = {
            toAx: exitAx,
            toAy: exitAy,
            toEthAddr: exitEthAddr,
            coin: 0,
            amount: to18(2),
            nonce: 0,
            fee: fee["50%"],
        };
        await rollupAccounts[3].wallet.signTx(tx);
        tx.fromEthAddr = rollupAccounts[3].ethAddr;

        await poolTx.addTx(tx);
        
        // Check forge batch
        await testUtils.assertForgeBatch(rollupSynch, lastBatch + 1, timeoutLoop);
        // Check balances
        await testUtils.assertBalances(rollupSynch, rollupAccounts, [to18(94), to18(104), to18(25), to18(47), null]);
    });
});