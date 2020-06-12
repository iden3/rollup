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

function to18(e) {
    return Scalar.mul(e, Scalar.pow(10, 18));
}

// timeouts test
const timeoutAddBlocks = 2000;
// timeouts test
const timeoutDelay = 7500;
let timeoutSynch;

contract("Synchronizer", (accounts) => {
    
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
                    await batch.addCoin(element.coin);
                }
            }

            if (params.depositOffChainData){
                compressedOnChain = `0x${(params.depositOffChainData).toString("hex")}`;
                const numDep = params.depositOffChainData.length / 88;
                const feeDep = Scalar.e(await insRollupTest.depositFee());
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
        batch.addBeneficiaryAddress(op1);

        await batch.build();
        const inputSm = buildPublicInputsSm(batch);
        ptr = ptr - 1;
        await insRollupPoS.commitAndForge(hashChain[ptr] , batch.getDataAvailableSM(),
            proofA, proofB, proofC, inputSm, compressedOnChain, config);
        await opRollupDb.consolidate(batch);

        // Test vector deposit off-chain
        depositOffChainDataTest.push(compressedOnChain);

        // Test vectors off-chain
        offChainDataTest.push({
            compressedTxs: batch.getDataAvailableSM(), 
            feePlanCoins: Scalar.fromString(inputSm[7], 16),
            feeTotals: Scalar.fromString(inputSm[8], 16),
            totalAccounts: Scalar.fromString(inputSm[0], 16),
        });

        // Test vector on-chain
        const tmpOnChain = [];
        if (events) {
            events.forEach(elem => {
                const tx = manageEvent(elem);
                if (tx.onChain && elem.event == "OnChainTx") tmpOnChain.push(tx);
            });
        }
        onChainDataTest.push(tmpOnChain);
    }

    const {
        0: id1,
        1: id2,
        2: id3,
        3: owner,
        4: synchAddress,
        5: op1,
        6: feeTokenAddress,
    } = accounts;

    let synchDb;
    let synch;

    const maxTx = 10;
    const maxOnChainTx = 5;
    const nLevels = 24;
    const tokenInitialAmount = to18(1000);
    const tokenId = 0;
    const url = "localhost";
    const hashChain = [];
    let ptr = 0;
    const initialMsg = "rollup";

    // Test vectors
    const offChainDataTest = [];
    const onChainDataTest = [];
    const depositOffChainDataTest = [];

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
        mode: Constants.mode.archive,
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
        insTokenRollup = await TokenRollup.new(id1, tokenInitialAmount.toString());

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
        const amountDistribution = to18(100);

        await insRollupTest.addToken(insTokenRollup.address,
            { from: id1, value: web3.utils.toWei("1", "ether") });
        await insTokenRollup.transfer(id2, amountDistribution.toString(), { from: id1 });
        await insTokenRollup.transfer(id3, amountDistribution.toString(), { from: id1 });
        
        await insTokenRollup.approve(insRollupTest.address, tokenInitialAmount.toString(),
            { from: id1 });
        await insTokenRollup.approve(insRollupTest.address, amountDistribution.toString(),
            { from: id2 });
        await insTokenRollup.approve(insRollupTest.address, amountDistribution.toString(),
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
        const loadAmount = to18(10);
        const event0 = await insRollupTest.deposit(loadAmount.toString(), tokenId, rollupAccounts[0].ethAddr,
            [rollupAccounts[0].Ax, rollupAccounts[0].Ay], { from: id1, value: web3.utils.toWei("1", "ether") });
        eventsInitial.push(event0.logs[0]);
        // { txData:
        //     '0x0000000000000000000001800000000000000000000000004327a53486aa4e99',
        //    loadAmount: 10000000000000000000n,
        //    fromAx:
        //     20566531304548732851571786311172719427795820689023288667301816573498893123196n,
        //    fromAy:
        //     18733853983043078605675170125606193733392672005115671605023181815590573081083n,
        //    toAx: 0n,
        //    toAy: 0n,
        //    toEthAddr: '0x0000000000000000000000000000000000000000' }
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

        await forgeBlock(eventsInitial); // add initial on-chain event deposit
        await timeout(timeoutSynch);
        await utilsTest.checkSynch(synch, opRollupDb);
    });

    it("Should add two deposits and synch", async () => {
        const loadAmount = to18(10);
        const events = [];
        const event0 = await insRollupTest.deposit(loadAmount.toString(), tokenId, rollupAccounts[1].ethAddr,
            [rollupAccounts[1].Ax, rollupAccounts[1].Ay], { from: id2, value: web3.utils.toWei("1", "ether") });
        events.push(event0.logs[0]);
        const event1 = await insRollupTest.deposit(loadAmount.toString(), tokenId, rollupAccounts[2].ethAddr,
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

        await utilsTest.assertBalancesDb(synch, rollupAccounts, opRollupDb);
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
            amount: to18(3),
            nonce: 0,
            fee: GlobalConst.fee["0%"],
        };

        events.push({event: "OffChainTx", tx: tx});
        await forgeBlock(events);
        await timeout(timeoutSynch);
        await utilsTest.checkSynch(synch, opRollupDb);

        await utilsTest.assertBalancesDb(synch, rollupAccounts, opRollupDb);
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
            fee: GlobalConst.fee["0%"],
            onChain: true,
            newAccount: true,
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
        
        await utilsTest.assertBalancesDb(synch, rollupAccounts, opRollupDb);
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
            fee: GlobalConst.fee["0%"],
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
            amount: to18(3),
            nonce: 0,
            fee: GlobalConst.fee["0%"],
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
        
        await utilsTest.assertBalancesDb(synch, rollupAccounts, opRollupDb);
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
            amount: to18(2),
            nonce: 0,
            fee: GlobalConst.fee["0%"],
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
            amount: to18(2),
            nonce: 0,
            fee: GlobalConst.fee["0%"],
        };

        events2.push({event: "OffChainTx", tx: tx2});
        await forgeBlock(events2);
        await timeout(timeoutSynch);
        await utilsTest.checkSynch(synch, opRollupDb);

        await utilsTest.assertBalancesDb(synch, rollupAccounts, opRollupDb);
    });

    it("Should check exit batches by account", async () => {
        const numExitBatch0 = 8;
        const numExitBatch1 = 9;

        // Check exit information
        const coin = 0;
        const ax = Scalar.e(rollupAccounts[1].Ax).toString("16");
        const ay = Scalar.e(rollupAccounts[1].Ay).toString("16");

        const arrayExits = await synch.getExitsBatchById(coin, ax, ay);
        expect(arrayExits.length).to.be.equal(1);
        expect(arrayExits.includes(numExitBatch0)).to.be.equal(true);
        
        // Check exit tree for all bacthes
        for (const numBatch of arrayExits){
            const res = await synch.getExitTreeInfo(numBatch, coin, ax, ay);
            expect(res.found).to.be.equal(true);
            expect(Scalar.eq(res.state.amount, to18(2))).to.be.equal(true);
        }

        const ax4 = Scalar.e(rollupAccounts[4].Ax).toString("16");
        const ay4 = Scalar.e(rollupAccounts[4].Ay).toString("16");

        const arrayExits4 = await synch.getExitsBatchById(coin, ax4, ay4);
        expect(arrayExits4.includes(numExitBatch1)).to.be.equal(true);

        for (const numBatch of arrayExits4){
            const res = await synch.getExitTreeInfo(numBatch, coin, ax4, ay4);
            expect(res.found).to.be.equal(true);
            expect(Scalar.eq(res.state.amount, to18(2))).to.be.equal(true);
        }
    });

    it("Should add off-chain tx with fee and synch", async () => {
        // Account |  0  |  1  |  2  |  3  |  4  |
        // Amount  |  4  |  5  |  10 |  5  |  1  |

        const tx = {
            fromAx: rollupAccounts[1].AxHex,
            fromAy: rollupAccounts[1].AyHex,
            fromEthAddr: rollupAccounts[1].ethAddr,
            toAx: rollupAccounts[3].AxHex,
            toAy: rollupAccounts[3].AyHex,
            toEthAddr: rollupAccounts[3].ethAddr,
            coin: 0,
            amount: to18(5),
            nonce: 0,
            fee: GlobalConst.fee["20%"],
        };

        const params = {
            addCoins: [{coin: 0}]
        };
        
        const events = [];
        events.push({event:"OffChainTx", tx: tx});
        await forgeBlock(events, params);
        await timeout(timeoutSynch);
        await utilsTest.checkSynch(synch, opRollupDb);

        await utilsTest.assertBalancesDb(synch, rollupAccounts, opRollupDb);
    });

    it("Should add on-chain and two off-chain tx and synch", async () => {
        // Account |  0  |  1  |  2  |  3  |  4  |
        // Amount  |  4  |  5  |  20 |  3  |  0  |
        
        const events = [];
        
        // on-chain tx
        const onTopAmount = to18(10);
        const tokenId = 0;
        const event = await insRollupTest.depositOnTop([rollupAccounts[4].Ax, rollupAccounts[4].Ay], onTopAmount.toString(), tokenId,
            { from: id1, value: web3.utils.toWei("1", "ether") });
        events.push(event.logs[0]);
        
        // off-chain tx
        const tx1 = {
            fromAx: rollupAccounts[4].AxHex,
            fromAy: rollupAccounts[4].AyHex,
            fromEthAddr: rollupAccounts[4].ethAddr,
            toAx: rollupAccounts[3].AxHex,
            toAy: rollupAccounts[3].AyHex,
            toEthAddr: rollupAccounts[3].ethAddr,
            coin: 0,
            amount: to18(10),
            nonce: 0,
            fee: GlobalConst.fee["10%"],
        };

        events.push({event:"OffChainTx", tx: tx1});
        const tx2 = {
            fromAx: rollupAccounts[3].AxHex,
            fromAy: rollupAccounts[3].AyHex,
            fromEthAddr: rollupAccounts[3].ethAddr,
            toAx: rollupAccounts[2].AxHex,
            toAy: rollupAccounts[2].AyHex,
            toEthAddr: rollupAccounts[2].ethAddr,
            coin: 0,
            amount: to18(10),
            nonce: 0,
            fee: GlobalConst.fee["20%"],
        };

        const params = {
            addCoins: [{coin: 0}]
        };

        events.push({event:"OffChainTx", tx: tx2});
        await forgeBlock();
        await forgeBlock(events, params);
        await timeout(timeoutSynch);
        await utilsTest.checkSynch(synch, opRollupDb);

        await utilsTest.assertBalancesDb(synch, rollupAccounts, opRollupDb);
    });

    it("Should add two off-chain withdraw and synch", async () => {
        // Account |  0  |  1  |  2  |  3  |  4  |
        // Amount  |  4  |  5  |  10 |  3  |  0  |
        
        const events = [];
        
        // off-chain tx
        const tx = {
            fromAx: rollupAccounts[2].AxHex,
            fromAy: rollupAccounts[2].AyHex,
            fromEthAddr: rollupAccounts[2].ethAddr,
            toAx: GlobalConst.exitAx,
            toAy: GlobalConst.exitAy,
            toEthAddr: GlobalConst.exitEthAddr,
            coin: 0,
            amount: to18(10),
            nonce: 0,
            fee: GlobalConst.fee["20%"],
        };

        events.push({event:"OffChainTx", tx: tx});

        const params = {
            addCoins: [{coin: 0}]
        };

        await forgeBlock(events, params);
        await timeout(timeoutSynch);
        await utilsTest.checkSynch(synch, opRollupDb);

        await utilsTest.assertBalancesDb(synch, rollupAccounts, opRollupDb);

        // Check exit batches
        const numExitBatch = 13;
        const coin = 0;
        const ax = Scalar.e(rollupAccounts[2].Ax).toString("16");
        const ay = Scalar.e(rollupAccounts[2].Ay).toString("16");

        const arrayExits = await synch.getExitsBatchById(coin, ax, ay);
        expect(arrayExits.length).to.be.equal(1);
        expect(arrayExits.includes(numExitBatch)).to.be.equal(true);
        
        // Check exit tree for all bacthes
        for (const numBatch of arrayExits){
            const res = await synch.getExitTreeInfo(numBatch, coin, ax, ay);
            expect(res.found).to.be.equal(true);
            expect(Scalar.eq(res.state.amount, to18(10))).to.be.equal(true);
        }
    });

    it("Should check static data", async () => {
        const staticData = await synch.getStaticData();

        expect(staticData.contractAddress).to.be.equal(insRollupTest.address);
        expect(staticData.maxTx).to.be.equal(maxTx);
        expect(staticData.maxOnChainTx).to.be.equal(maxOnChainTx);
        expect(staticData.nLevels).to.be.equal(nLevels);
    });

    it("Should check fees", async () => {
        const feeDepositSM = Scalar.e(await insRollupTest.depositFee());
        const feeOnChainTxSM = Scalar.e(await insRollupTest.feeOnchainTx());
        
        const feeDeposit = await synch.getFeeDepOffChain();
        const feeOnChainTx = await synch.getFeeOnChainTx();

        expect(feeDeposit.toString()).to.be.equal(feeDepositSM.toString());
        expect(feeOnChainTx.toString()).to.be.equal(feeOnChainTxSM.toString());
    });

    it("Should get individual batch data", async () => {
        // wait until is fully synched
        let isSynched = await synch.isSynched();
        
        while (!isSynched){
            await timeout(timeoutDelay);
            isSynched = await synch.isSynched();
        }

        const batchData = await synch.getBatchInfo(0);
        expect(batchData).to.be.equal(null);

        // Check test data vector length
        expect(offChainDataTest.length).to.be.equal(onChainDataTest.length);

        for (let i = 0; i < offChainDataTest.length; i++){
            const batchData = await synch.getBatchInfo(i+1);

            // Check off-chain data
            const offChainData = batchData.offChainData[0];
            const offDataTest = offChainDataTest[i]; 
            expect(offDataTest.compressedTxs).to.be.equal(offChainData.compressedTxs);
            expect(Scalar.eq(offDataTest.feePlanCoins, offChainData.feePlanCoins)).to.be.equal(true);
            expect(Scalar.eq(offDataTest.feeTotals, offChainData.feeTotals)).to.be.equal(true);
            expect(Scalar.eq(offDataTest.totalAccounts, offChainData.totalAccounts)).to.be.equal(true);
        
            // Check on-chain data test
            const onChainData = batchData.onChainData;
            const onDataTest = onChainDataTest[i];

            expect(onChainData.length).to.be.equal(onDataTest.length);

            for (let j = 0; j < onChainData.length; j++){
                const onChainTx = onChainData[j];
                const onChainTxTest = onDataTest[j];

                expect(onChainTx.txData).to.be.equal(onChainTxTest.txData);
                expect(Scalar.eq(onChainTx.loadAmount, onChainTxTest.loadAmount)).to.be.equal(true);

                expect(onChainTx.fromAx).to.be.equal(onChainTxTest.fromAx);
                expect(onChainTx.fromAy).to.be.equal(onChainTxTest.fromAy);
                expect(onChainTx.fromEthAddr).to.be.equal(onChainTxTest.fromEthAddr);

                expect(onChainTx.toAx).to.be.equal(onChainTxTest.toAx);
                expect(onChainTx.toAy).to.be.equal(onChainTxTest.toAy);
                expect(onChainTx.toEthAddr).to.be.equal(onChainTxTest.toEthAddr);
            }

            // Check deposit off-chain data test
            const depositOffChainData = batchData.depositOffChainData[0];
            const depositOffDataTest = depositOffChainDataTest[i];
            
            expect(depositOffChainData).to.be.equal(depositOffDataTest);
        }
    });
});
