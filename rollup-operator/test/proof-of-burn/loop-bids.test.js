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

const poseidonUnit = require("../../../node_modules/circomlib/src/poseidon_gencontract.js");
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
const LoopBids = require("../../src/proof-of-burn/loop-bids");
const { fee } = require("../../../js/constants");

// timeouts test
const timeoutSynch = 20000;
const timeoutLoop = 10000;

function to18(e) {
    return Scalar.mul(e, Scalar.pow(10, 18));
}

contract("Loop Bids", async (accounts) => { 

    const {
        0: id0,
        1: id1,
        2: id2,
        // eslint-disable-next-line no-unused-vars
        3: operator2Address,
        // eslint-disable-next-line no-unused-vars
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
    const urlOperator = "localhost";
    const bidPercent = 0.3;
    const nextBidslot = 2;
    const gasLimit = "default";
    const gasMultiplier = 1;
    const url = "localhost";
    const burnAddress = "0x0000000000000000000000000000000000000000";

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
    let loopBids;

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

        // get PoS public data
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

    it("Should initialize loop bids", async () => {
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
        
        // Init PoS Synch
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

        // Init loop bids
        loopBids = new LoopBids(
            configSynchPoB.contractAddress,
            configSynchPoB.abi,
            rollupSynch,
            pobSynch,
            poolTx, 
            opManager,
            urlOperator,
            bidPercent,
            nextBidslot,
            configSynchPoB.logLevel,
            configSynchPoB.ethNodeUrl,
            configSynchPoB.timeouts,
            burnAddress
        );
               
        // Init loops    
        loopManager.startLoop();
        rollupSynch.synchLoop();
        pobSynch.synchLoop();
        loopBids.startBidsLoop();
    });

    it("Should register operators", async () => {
        const url = "localhost";
        const amountBid = 2;
        const minBidSlots = 2;
        
        const currentSlot = await pobSynch.getCurrentSlot();
        const slot = currentSlot + minBidSlots;

        const [txSign, ] = await opManager.getTxBid(slot, url, amountBid);
        const resBid = await web3.eth.sendSignedTransaction(txSign.rawTransaction);
        expect(resBid.status).to.be.equal(true);

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
        await testUtils.assertForgeBatch(rollupSynch, lastBatch + 1, timeoutLoop);

        // Check balances
        await testUtils.assertBalances(rollupSynch, rollupAccounts, [to18(100), to18(100), to18(100), null, null]);
    });

    it("Should add off-chain transaction, forge it and check states", async () => {
        // Account |  0  |  1  |  2  |  3  |  4  |
        // Amount  |  94 | 104 | 100 | Nan | Nan |

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
        await timeTravel.addBlocks(blocksPerSlot);
        await timeout(timeoutSynch);

        const currentSlot = await pobSynch.getCurrentSlot();
        const slotBid = currentSlot + nextBidslot; 

        await timeTravel.addBlocks(blocksPerSlot);
        await timeout(timeoutSynch);

        const winner = await insRollupPoB.getWinner(slotBid);
        expect(winner[1]).to.be.equal(opManager.wallet.address);
    });


});