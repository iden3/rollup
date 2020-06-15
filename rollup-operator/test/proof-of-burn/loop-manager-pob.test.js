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
const testUtils = require("./../helpers/utils-test");

const poseidonUnit = require("circomlib/src/poseidon_gencontract");
const MemDb = require("../../../rollup-utils/mem-db");
const RollupDB = require("../../../js/rollupdb");
const RollupAccount = require("../../../js/rollupaccount");

const TokenRollup = artifacts.require("../../contracts/test/TokenRollup");
const Verifier = artifacts.require("../../contracts/test/VerifierHelper");
const RollupPoB = artifacts.require("../../contracts/RollupPoB");
const Rollup = artifacts.require("../../contracts/Rollup");

const RollupSynch = require("../../src/synch");
const PoBSynch = require("../../src/proof-of-burn/synch-pob");
const OperatorManager = require("../../src/proof-of-burn/interface-pob");
const Pool = require("../../../js/txpool");
const CliServerProof = require("../../src/cli-proof-server");
const LoopManager = require("../../src/proof-of-burn/loop-manager-pob");
const { exitAx, exitEthAddr, exitAy, fee } = require("../../../js/constants");

// timeouts test
const timeoutSynch = 20000;
const timeoutLoop = 10000;

function to18(e) {
    return Scalar.mul(e, Scalar.pow(10, 18));
}

contract("Loop Manager PoB", async (accounts) => { 

    //id3 is not necessary
    const {
        0: id0,
        1: id1,
        2: id2,
        3: operator2Address,
        4: id4,
        5: rollupSynchAddress,
        6: pobSynchAddress,
        7: tokenList,
        8: feeTokenAddress,
        9: owner,
    } = accounts;

    let publicData;
    let blocksPerSlot;
    let genesisBlock;

    const tokenInitialAmount = to18(1000);
    const maxTx = 10;
    const maxOnChainTx = 3;
    const tokenId = 0;
    const gasLimit = "default";
    const gasMultiplier = 1;
    const burnAddress = "0x0000000000000000000000000000000000000000";
    const url = "localhost";

    let insPoseidonUnit;
    let insTokenRollup;
    let insRollupPoB;
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
    let pobSynch;
    let poolTx;
    let opManager;
    let cliServerProof;

    let loopManager;

    let synchDb;
    let db;
    let synchRollupDb;
    let synchPoBDb;

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
        insRollupPoB = await RollupPoB.new(insRollup.address, maxTx, burnAddress, operator2Address, url);

        // Add forge batch mechanism
        await insRollup.loadForgeBatchMechanism(insRollupPoB.address, { from: owner });
        
        // Add token to rollup token list
        await insRollup.addToken(insTokenRollup.address,
            { from: tokenList, value: web3.utils.toWei("1", "ether") });

        // load wallet with funds
        let privateKey = "0x0123456789012345678901234567890123456789012345678901234567890123";
        wallet = new ethers.Wallet(privateKey);
        const initBalance = 20;
        await web3.eth.sendTransaction({to: wallet.address, from: owner,
            value: web3.utils.toWei(initBalance.toString(), "ether")});

        // get PoB public data
        publicData = await testUtils.publicDataPoB(insRollupPoB);
        genesisBlock = publicData.genesisBlock;
        blocksPerSlot = publicData.blocksPerSlot;
    });

    it("manage rollup token", async () => { 
        const amountDistribution = to18(100);

        await insRollup.addToken(insTokenRollup.address,
            { from: owner, value: web3.utils.toWei("1", "ether") });
        await insTokenRollup.transfer(rollupAccounts[1].ethAddr, amountDistribution.toString(), { from: rollupAccounts[0].ethAddr });
        await insTokenRollup.transfer(rollupAccounts[2].ethAddr, amountDistribution.toString(), { from: rollupAccounts[0].ethAddr });
        await insTokenRollup.transfer(rollupAccounts[4].ethAddr, amountDistribution.toString(), { from: rollupAccounts[0].ethAddr });

        await insTokenRollup.approve(insRollup.address, tokenInitialAmount.toString(),
            { from: rollupAccounts[0].ethAddr });
        await insTokenRollup.approve(insRollup.address, amountDistribution.toString(),
            { from: rollupAccounts[1].ethAddr });
        await insTokenRollup.approve(insRollup.address, amountDistribution.toString(),
            { from: rollupAccounts[2].ethAddr });
        await insTokenRollup.approve(insRollup.address, amountDistribution.toString(),
            { from: rollupAccounts[4].ethAddr });
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
            rollupPoBAddress: insRollupPoB.address,
            rollupPoBABI: RollupPoB.abi,
            logLevel: "debug",
            timeouts: { ERROR: 1000, NEXT_LOOP: 2500, LOGGER: 5000},
        };
        
        rollupSynch = new RollupSynch(configRollupSynch.synchDb,
            configRollupSynch.treeDb,
            configRollupSynch.ethNodeUrl,
            configRollupSynch.contractAddress,
            configRollupSynch.abi,
            configRollupSynch.rollupPoBAddress,
            configRollupSynch.rollupPoBABI, 
            configRollupSynch.creationHash,
            configRollupSynch.ethAddress,
            configRollupSynch.logLevel,
            configRollupSynch.timeouts,
        );
        
        // Init PoB Synch
        synchPoBDb = new MemDb();

        let configSynchPoB = {
            synchDb: synchPoBDb,
            ethNodeUrl: "http://localhost:8545",
            contractAddress: insRollupPoB.address,
            creationHash: insRollupPoB.transactionHash,
            ethAddress: pobSynchAddress,
            abi: RollupPoB.abi,
            logLevel: "debug",
            timeouts: { ERROR: 1000, NEXT_LOOP: 2500, LOGGER: 5000},
        };
        
        pobSynch = new PoBSynch(
            configSynchPoB.synchDb,
            configSynchPoB.ethNodeUrl,
            configSynchPoB.contractAddress,
            configSynchPoB.abi,
            configSynchPoB.creationHash,
            configSynchPoB.ethAddress,
            configSynchPoB.logLevel,
            configSynchPoB.timeouts,
            burnAddress);
        
        // Init operator manager
        opManager = new OperatorManager(
            configSynchPoB.ethNodeUrl,
            configSynchPoB.contractAddress, 
            configSynchPoB.abi,
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
            pobSynch,
            poolTx, 
            opManager,
            cliServerProof,
            configSynchPoB.logLevel,
            configSynchPoB.ethNodeUrl,
            configSynchPoB.timeouts,
        );
               
        // Init loops    
        loopManager.startLoop();
        rollupSynch.synchLoop();
        pobSynch.synchLoop();
    });


    it("Should register operators", async () => {
        const url = "localhost";
        const amountBid = 2;
        const minBidSlots = 2;
        
        const currentSlot = await pobSynch.getCurrentSlot();
        const slot = currentSlot + minBidSlots;

        const [txSign,] = await opManager.getTxBid(slot, url, amountBid);
        const resBid = await web3.eth.sendSignedTransaction(txSign.rawTransaction);
        expect(resBid.status).to.be.equal(true);

        const [txSign2,] = await opManager.getTxBid(slot+1, url, amountBid);
        const resBid2 = await web3.eth.sendSignedTransaction(txSign2.rawTransaction);
        expect(resBid2.status).to.be.equal(true);

        const [txSign3,] = await opManager.getTxBid(slot+2, url, amountBid);
        const resBid3 = await web3.eth.sendSignedTransaction(txSign3.rawTransaction);
        expect(resBid3.status).to.be.equal(true);

        const amountNextMinBid = Number(publicData.minBid);
        await insRollupPoB.bid(slot+4, url, {
            from: operator2Address, value: amountNextMinBid
        });

        const currentBlock = await web3.eth.getBlockNumber();
        await timeTravel.addBlocks(genesisBlock - currentBlock + 1); // slot 0
        await timeout(timeoutSynch);
        
        const currentWinners = await pobSynch.getCurrentWinners();
        expect(currentWinners[minBidSlots]).to.be.equal(opManager.wallet.address);
        
    });

    it("Should add one deposit", async () => {
        const loadAmount = to18(100);
        await insRollup.deposit(loadAmount.toString(), tokenId, rollupAccounts[0].ethAddr,
            [rollupAccounts[0].Ax, rollupAccounts[0].Ay], { from: id0, value: web3.utils.toWei("1", "ether") });
    });

    it("Should wait until operator turn", async () => {
        await timeTravel.addBlocks(blocksPerSlot); // slot 1
        await timeout(timeoutSynch);
        await timeTravel.addBlocks(blocksPerSlot); // slot 2
        await timeout(timeoutSynch);
        const currentWinners = await pobSynch.getCurrentWinners();
        expect(currentWinners[0]).to.be.equal(opManager.wallet.address);
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
        await testUtils.assertForgeBatch(rollupSynch, lastBatch + 1, timeoutLoop*2);

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

    it("Should add two deposits, forge them after deadline and check states", async () => {
        // Account |  0  |  1  |  2  |  3  |  4  |
        // Amount  |  94 | 104 |  25 |  47 | 100 |
        let lastBatch = await rollupSynch.getLastBatch();

        const loadAmount = to18(100);
        await insRollup.deposit(loadAmount.toString(), tokenId, rollupAccounts[4].ethAddr,
            [rollupAccounts[4].Ax, rollupAccounts[4].Ay], { from: id4, value: web3.utils.toWei("1", "ether") });

        let currentSlot = await pobSynch.getCurrentSlot();
        let currentBlock = await pobSynch.getCurrentBlock();

        const blocksNextSlot = await pobSynch.getBlockBySlot(currentSlot + 1);
        const addBlocks = blocksNextSlot - currentBlock - 10;
        if (addBlocks > 0) {
            await timeTravel.addBlocks(addBlocks); // slot 8
        } else {
            await timeTravel.addBlocks(blocksPerSlot); // slot 8
            
        }
        await timeout(timeoutSynch);
        // Check forge batch
        await testUtils.assertForgeBatch(rollupSynch, lastBatch, timeoutLoop);

        await timeTravel.addBlocks(blocksPerSlot); // slot 8
        await timeout(timeoutSynch);

        lastBatch = await rollupSynch.getLastBatch();
        await testUtils.assertForgeBatch(rollupSynch, lastBatch, timeoutLoop);

        // Check balances
        await testUtils.assertBalances(rollupSynch, rollupAccounts, [to18(94), to18(104), to18(25), to18(47), to18(100),]);

    });

});