/* global artifacts */
/* global contract */
/* global web3 */

const { expect } = require("chai");
const poseidonUnit = require("circomlib/src/poseidon_gencontract");
const utilsTest = require("./helpers/utils-test");
const Scalar = require("ffjavascript").Scalar;

const TokenRollup = artifacts.require("../contracts/test/TokenRollup");
const Verifier = artifacts.require("../contracts/test/VerifierHelper");
const RollupPoS = artifacts.require("../contracts/RollupPoS");
const RollupTest = artifacts.require("../contracts/test/RollupTest");

const Synchronizer = require("../src/synch");
const MemDb = require("../../rollup-utils/mem-db");
const RollupDB = require("../../js/rollupdb");
const SMTMemDB = require("circomlib/src/smt_memdb");
const { BabyJubWallet } = require("../../rollup-utils/babyjub-wallet");
const { timeout, buildPublicInputsSm, manageEvent } = require("../src/utils");
const { encodeDepositOffchain } = require("../../js/utils");
const timeTravel = require("../../test/contracts/helpers/timeTravel");
const Constants = require("../src/constants");
const GlobalConst = require("../../js/constants");

const proofA = ["0", "0"];
const proofB = [["0", "0"], ["0", "0"]];
const proofC = ["0", "0"];

// timeouts test
const timeoutAddBlocks = 2000;
// timeouts test
const timeoutDelay = 7500;
let timeoutSynch;

contract("Synchronizer - light mode", (accounts) => {
    
    async function forgeBlock(events = undefined, params = undefined) {
        const batch = await opRollupDb.buildBatch(maxTx, nLevels);
        let compressedOnChain = "0x";

        const config = {
            from: op1,
        };

        // Parse params
        if (params){
            if (params.addCoins){
                for (const element of params.addCoins){
                    await batch.addCoin(element.coin, element.fee);
                }
            }

            if (params.depositOffChainData){
                compressedOnChain = `0x${(params.depositOffChainData).toString("hex")}`;
                const numDep = params.depositOffChainData.length / 88;
                const feeDep = Scalar.e(await insRollupTest.FEE_OFFCHAIN_DEPOSIT());
                const amountToPay = Scalar.mul(feeDep, numDep);
                config.value = amountToPay.toString();                
            }
        }
        // Manage events
        if (events) {
            events.forEach(elem => {
                batch.addTx(manageEvent(elem));
            });
        }
        await batch.build();
        const inputSm = buildPublicInputsSm(batch, beneficiary);
        ptr = ptr - 1;
        await insRollupPoS.commitAndForge(hashChain[ptr] , `0x${batch.getDataAvailable().toString("hex")}`,
            proofA, proofB, proofC, inputSm, compressedOnChain, config);
        await opRollupDb.consolidate(batch);
    }

    const {
        0: id1,
        1: id2,
        2: id3,
        3: owner,
        4: synchAddress,
        5: beneficiary,
        6: op1,
        7: feeTokenAddress,
    } = accounts;

    let synchDb;
    let synch;

    const maxTx = 10;
    const maxOnChainTx = 5;
    const nLevels = 24;
    const tokenInitialAmount = 1000;
    const tokenId = 0;
    const url = "localhost";
    const hashChain = [];
    let ptr = 0;
    const initialMsg = "rollup";

    const slotPerEra = 20;
    const blocksPerSlot = 100;
    const blockPerEra = slotPerEra * blocksPerSlot;
    // Operator database
    let opDb;
    let opRollupDb;

    // Synchronizer database
    let db;
    let synchRollupDb;

    let insPoseidonUnit;
    let insTokenRollup;
    let insRollupPoS;
    let insRollupTest;
    let insVerifier;

    let configSynch = {
        treeDb: undefined,
        synchDb: undefined,
        ethNodeUrl: "http://localhost:8545",
        contractAddress: undefined,
        creationHash: undefined,
        ethAddress: synchAddress,
        abi: RollupTest.abi,
        contractPoS: undefined,
        posAbi: RollupPoS.abi,
        logLevel: "debug",
        mode: Constants.mode.light,
        timeouts: { ERROR: 1000, NEXT_LOOP: 2500, LOGGER: 5000},
    }; 

    // BabyJubjub public key
    const rollupAccounts = [];

    for (let i = 0; i < 5; i++){
        const wallet = BabyJubWallet.createRandom();
        const Ax = wallet.publicKey[0].toString();
        const Ay = wallet.publicKey[1].toString();
        const AxHex = wallet.publicKey[0].toString(16);
        const AyHex = wallet.publicKey[1].toString(16);
        rollupAccounts.push({Ax, Ay, AxHex, AyHex, ethAddr: accounts[i]});
    }

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
            maxTx, maxOnChainTx, feeTokenAddress);

        // Deploy Staker manager
        insRollupPoS = await RollupPoS.new(insRollupTest.address, maxTx);

        // load forge batch mechanism
        await insRollupTest.loadForgeBatchMechanism(insRollupPoS.address);
        
        // Init Synch Rollup databases
        synchDb = new MemDb();
        db = new SMTMemDB();
        synchRollupDb = await RollupDB(db);
        // Init operator Rollup Database
        opDb = new SMTMemDB();
        opRollupDb = await RollupDB(opDb);

        // load configuration synchronizer
        configSynch.contractPoS = insRollupPoS.address;
        configSynch.contractAddress = insRollupTest.address;
        configSynch.creationHash = insRollupTest.transactionHash;
        configSynch.treeDb = synchRollupDb;
        configSynch.synchDb = synchDb;

        // Add operator
        // Create hash chain for the operator
        hashChain.push(web3.utils.keccak256(initialMsg));
        for (let i = 1; i < 100; i++) {
            hashChain.push(web3.utils.keccak256(hashChain[i - 1]));
            ptr = i;
        }
        // Add operator to PoS
        const amountToStake = 2;
        await insRollupPoS.addOperator(hashChain[ptr], url,
            { from: op1, value: web3.utils.toWei(amountToStake.toString(), "ether") });
    });

    it("manage rollup token", async () => { 
        const amountDistribution = 100;

        await insRollupTest.addToken(insTokenRollup.address,
            { from: id1, value: web3.utils.toWei("1", "ether") });
        await insTokenRollup.transfer(id2, amountDistribution, { from: id1 });
        await insTokenRollup.transfer(id3, amountDistribution, { from: id1 });
        
        await insTokenRollup.approve(insRollupTest.address, tokenInitialAmount,
            { from: id1 });
        await insTokenRollup.approve(insRollupTest.address, amountDistribution,
            { from: id2 });
        await insTokenRollup.approve(insRollupTest.address, amountDistribution,
            { from: id3 });
    });

    let eventsInitial = [];

    it("Should initialize synchronizer", async () => {
        synch = new Synchronizer(
            configSynch.synchDb,
            configSynch.treeDb,
            configSynch.ethNodeUrl,
            configSynch.contractAddress,
            configSynch.abi,
            configSynch.contractPoS,
            configSynch.posAbi,
            configSynch.creationHash,
            configSynch.ethAddress,
            configSynch.logLevel,
            configSynch.mode,
            configSynch.timeouts
        );
        synch.synchLoop();

        timeoutSynch = synch.timeouts.NEXT_LOOP + timeoutDelay;
    });

    it("Should add one deposit", async () => {
        const loadAmount = 10;
        const event0 = await insRollupTest.deposit(loadAmount, tokenId, rollupAccounts[0].ethAddr,
            [rollupAccounts[0].Ax, rollupAccounts[0].Ay], { from: id1, value: web3.utils.toWei("1", "ether") });
        eventsInitial.push(event0.logs[0]);
    });

    it("Should move to era 2 and synch", async () => {
        let currentBlock = await web3.eth.getBlockNumber();
        const genesisBlock = await insRollupPoS.genesisBlock();
        await timeTravel.addBlocks(genesisBlock - currentBlock); // era 0
        await timeout(timeoutAddBlocks);

        await timeTravel.addBlocks(blockPerEra); // era 1
        await timeout(timeoutAddBlocks);

        await timeTravel.addBlocks(blockPerEra); // era 2
        await timeout(timeoutAddBlocks);
        await forgeBlock(); // genesis
        await timeout(timeoutSynch);
        await utilsTest.checkSynch(synch, opRollupDb);

        await forgeBlock(eventsInitial); // add initial onchain event deposit
        await timeout(timeoutSynch);
        await utilsTest.checkSynch(synch, opRollupDb);
    });

    it("Should add two deposits and synch", async () => {
        const loadAmount = 10;
        const events = [];
        const event0 = await insRollupTest.deposit(loadAmount, tokenId, rollupAccounts[1].ethAddr,
            [rollupAccounts[1].Ax, rollupAccounts[1].Ay], { from: id2, value: web3.utils.toWei("1", "ether") });
        events.push(event0.logs[0]);
        const event1 = await insRollupTest.deposit(loadAmount, tokenId, rollupAccounts[2].ethAddr,
            [rollupAccounts[2].Ax, rollupAccounts[2].Ay], { from: id3, value: web3.utils.toWei("1", "ether") });
        events.push(event1.logs[0]);
        await forgeBlock();
        await forgeBlock(events);
        await timeout(timeoutSynch);
        await utilsTest.checkSynch(synch, opRollupDb);
    });

    it("Should retrieve balance tree information", async () => {
        // Account |  0  |  1  |  2  |  3  |  4  |
        // Amount  |  10 |  10 |  10 | nan | nan |
        
        const coin = 0;
        const totalDeposits = 3;

        for (let i = 0; i < totalDeposits; i++){
            const ax = Scalar.e(rollupAccounts[i].Ax).toString("16");
            const ay = Scalar.e(rollupAccounts[i].Ay).toString("16");
            const ethAddr = rollupAccounts[i].ethAddr.toLowerCase();

            // get info by account
            const resId = await synch.getStateByAccount(coin, ax, ay);
            // check leaf info matches deposit;
            expect(resId.ax).to.be.equal(ax);
            expect(resId.ay).to.be.equal(ay);
            expect(resId.ethAddress).to.be.equal(ethAddr);
            expect(Scalar.eq(resId.amount, 10)).to.be.equal(true);
        
            // get leafs info by AxAy
            const resAxAy = await synch.getStateByAxAy(ax, ay);
            // check leaf info matches deposits
            expect(resAxAy.length).to.be.equal(1); // 1 deposits with equal ax, ay
            expect(resAxAy[0].ethAddress).to.be.equal(ethAddr);

            // get leaf info by ethAddress
            const resEthAddress = await synch.getStateByEthAddr(ethAddr);
            // check leaf info matches deposit
            expect(resEthAddress[0].ax).to.be.equal(ax);
            expect(resEthAddress[0].ay).to.be.equal(ay);
        }
    });

    it("Should add off-chain tx and synch", async () => {
        // Account |  0  |  1  |  2  |  3  |  4  |
        // Amount  |  7  |  13 |  10 | nan | nan |

        const events = [];

        const tx = {
            fromAx: rollupAccounts[0].AxHex,
            fromAy: rollupAccounts[0].AyHex,
            fromEthAddr: rollupAccounts[0].ethAddr,
            toAx: rollupAccounts[1].AxHex,
            toAy: rollupAccounts[1].AyHex,
            toEthAddr: rollupAccounts[1].ethAddr,
            coin: 0,
            amount: 3,
            nonce: 0,
            userFee: 0,
        };

        events.push({event: "OffChainTx", tx: tx});
        await forgeBlock(events);
        await timeout(timeoutSynch);
        await utilsTest.checkSynch(synch, opRollupDb);
    });

    it("Should add deposit off-chain and synch", async () => {
        // Account |  0  |  1  |  2  |  3  |  4  |
        // Amount  |  7  |  13 |  10 |  0  | nan |

        const events = [];

        const tx = {
            fromAx: rollupAccounts[3].AxHex,
            fromAy: rollupAccounts[3].AyHex,
            fromEthAddr: rollupAccounts[3].ethAddr,
            toAx: GlobalConst.exitAx,
            toAy: GlobalConst.exitAy,
            toEthAddr: GlobalConst.exitEthAddr,
            coin: 0,
            amount: 0,
            nonce: 0,
            userFee: 0,
            onChain: true,
        };

        events.push({event: "DepositOffChainTx", tx: tx});
        await forgeBlock(events, {depositOffChainData: encodeDepositOffchain([tx])});
        await timeout(timeoutSynch);
        await utilsTest.checkSynch(synch, opRollupDb);

        // Check new leaf synchronized
        const coin = 0;
        const ax = Scalar.e(rollupAccounts[3].Ax).toString("16");
        const ay = Scalar.e(rollupAccounts[3].Ay).toString("16");
        const ethAddr = rollupAccounts[3].ethAddr.toLowerCase();

        // get info by account
        const resId = await synch.getStateByAccount(coin, ax, ay);
        // check leaf info matches deposit;
        expect(resId.ax).to.be.equal(ax);
        expect(resId.ay).to.be.equal(ay);
        expect(resId.ethAddress).to.be.equal(ethAddr);
        expect(Scalar.eq(resId.amount, 0)).to.be.equal(true);
    });

    it("Should add deposit off-chain and off-chain transfer and synch", async () => {
        // Account |  0  |  1  |  2  |  3  |  4  |
        // Amount  |  4  |  13 |  10 |  0  |  3  |

        const events = [];

        const tx = {
            fromAx: rollupAccounts[4].AxHex,
            fromAy: rollupAccounts[4].AyHex,
            fromEthAddr: rollupAccounts[4].ethAddr,
            toAx: GlobalConst.exitAx,
            toAy: GlobalConst.exitAy,
            toEthAddr: GlobalConst.exitEthAddr,
            coin: 0,
            amount: 0,
            nonce: 0,
            userFee: 0,
            onChain: true,
        };

        const tx2 = {
            fromAx: rollupAccounts[0].AxHex,
            fromAy: rollupAccounts[0].AyHex,
            fromEthAddr: rollupAccounts[0].ethAddr,
            toAx: rollupAccounts[4].AxHex,
            toAy: rollupAccounts[4].AyHex,
            toEthAddr: rollupAccounts[4].ethAddr,
            coin: 0,
            amount: 3,
            nonce: 0,
            userFee: 0,
        };

        events.push({event: "DepositOffChainTx", tx: tx});
        events.push({event: "OffChainTx", tx: tx2});

        await forgeBlock(events, {depositOffChainData: encodeDepositOffchain([tx])});
        await timeout(timeoutSynch);
        await utilsTest.checkSynch(synch, opRollupDb);

        // Check new leaf synchronized
        const coin = 0;
        const ax = Scalar.e(rollupAccounts[4].Ax).toString("16");
        const ay = Scalar.e(rollupAccounts[4].Ay).toString("16");
        const ethAddr = rollupAccounts[4].ethAddr.toLowerCase();

        // get info by account
        const resId = await synch.getStateByAccount(coin, ax, ay);
        // check leaf info matches deposit;
        expect(resId.ax).to.be.equal(ax);
        expect(resId.ay).to.be.equal(ay);
        expect(resId.ethAddress).to.be.equal(ethAddr);
        expect(Scalar.eq(resId.amount, 3)).to.be.equal(true);
    });

    it("Should add two off-chain withdraw tx and synch", async () => {
        // Account |  0  |  1  |  2  |  3  |  4  |
        // Amount  |  4  |  11 |  10 |  0  |  1  |

        const events = [];
        const tx = {
            fromAx: rollupAccounts[1].AxHex,
            fromAy: rollupAccounts[1].AyHex,
            fromEthAddr: rollupAccounts[1].ethAddr,
            toAx: GlobalConst.exitAx,
            toAy: GlobalConst.exitAy,
            toEthAddr: GlobalConst.exitEthAddr,
            coin: 0,
            amount: 2,
            nonce: 0,
            userFee: 0,
        };

        events.push({event: "OffChainTx", tx: tx});
        await forgeBlock(events);
        await timeout(timeoutSynch);
        await utilsTest.checkSynch(synch, opRollupDb);

        const events2 = [];
        const tx2 = {
            fromAx: rollupAccounts[4].AxHex,
            fromAy: rollupAccounts[4].AyHex,
            fromEthAddr: rollupAccounts[4].ethAddr,
            toAx: GlobalConst.exitAx,
            toAy: GlobalConst.exitAy,
            toEthAddr: GlobalConst.exitEthAddr,
            coin: 0,
            amount: 2,
            nonce: 0,
            userFee: 0,
        };

        events2.push({event: "OffChainTx", tx: tx2});
        await forgeBlock(events2);
        await timeout(timeoutSynch);
        await utilsTest.checkSynch(synch, opRollupDb);

        // // Check balances
        const coin = 0;
        const ax = Scalar.e(rollupAccounts[1].Ax).toString("16");
        const ay = Scalar.e(rollupAccounts[1].Ay).toString("16");

        const ax4 = Scalar.e(rollupAccounts[4].Ax).toString("16");
        const ay4 = Scalar.e(rollupAccounts[4].Ay).toString("16");

        const resId = await synch.getStateByAccount(coin, ax, ay);
        expect(Scalar.eq(resId.amount, 11)).to.be.equal(true);

        const resId4 = await synch.getStateByAccount(coin, ax4, ay4);
        expect(Scalar.eq(resId4.amount, 1)).to.be.equal(true);
    });

    it("Should check exit batches by id", async () => {
        // const numExitBatch0 = 5;
        // const numExitBatch1 = 6;
        // let idx = 1;
        // const arrayExits = await synch.getExitsBatchById(idx);
        // expect(arrayExits.length).to.be.equal(2);
        // expect(arrayExits.includes(numExitBatch0)).to.be.equal(true);
        // expect(arrayExits.includes(numExitBatch1)).to.be.equal(true);
        // // Check exit tree for all bacthes
        // for (const numBatch of arrayExits){
        //     const res = await synch.getExitTreeInfo(numBatch, idx);
        //     expect(res.found).to.be.equal(true);
        // }
    });
});
