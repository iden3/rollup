/* global artifacts */
/* global contract */
/* global web3 */
/* global BigInt */

const chai = require("chai");
const { expect } = chai;
const poseidonUnit = require("circomlib/src/poseidon_gencontract");
const TokenRollup = artifacts.require("../contracts/test/TokenRollup");
const Verifier = artifacts.require("../contracts/test/VerifierHelper");
const StakerManager = artifacts.require("../contracts/RollupPoS");
const RollupTest = artifacts.require("../contracts/test/RollupTest");
const Synchronizer = require("../src/synchronizer/synch");
const MemDb = require("../../rollup-utils/mem-db");
const RollupDB = require("../../js/rollupdb");
const SMTMemDB = require("circomlib/src/smt_memdb");
const rollupUtils = require("../../rollup-utils/rollup-utils");
const { BabyJubWallet } = require("../../rollup-utils/babyjub-wallet");

function timeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function buildInputSm(bb) {
    const feePlan = rollupUtils.buildFeeInputSm(bb.feePlan);
    return [
        bb.getInput().oldStRoot.toString(),
        bb.getNewStateRoot().toString(),
        bb.getNewExitRoot().toString(),
        bb.getOnChainHash().toString(),
        bb.getOffChainHash().toString(),
        feePlan[0],
        feePlan[1],
        bb.getCountersOut().toString(),
    ];
}

function manageEvent(event) {
    if (event.event == "OnChainTx") {
        const txData = rollupUtils.decodeTxData(event.args.txData);
        return {
            fromIdx: txData.fromId,
            toIdx: txData.toId,
            amount: txData.amount,
            loadAmount: BigInt(event.args.loadAmount),
            coin: txData.tokenId,
            ax: BigInt(event.args.Ax).toString(16),
            ay: BigInt(event.args.Ay).toString(16),
            ethAddress: BigInt(event.args.ethAddress).toString(),
            onChain: true
        };
    }
}

contract("Synchronizer", (accounts) => {
    
    async function forgeBlock(events = undefined) {
        const block = await opRollupDb.buildBlock(maxTx, nLevels);
        if (events) {
            events.forEach(elem => {
                block.addTx(manageEvent(elem));
            });
        }
        await block.build();
        const inputSm = buildInputSm(block, beneficiary);
        const compressedTx = `0x${block.getDataAvailable().toString("hex")}`;
        await insRollupTest.forgeBatch(beneficiary, proofA, proofB, proofC, inputSm, compressedTx);
        await opRollupDb.consolidate(block);
    }

    const {
        0: owner,
        1: id1,
        2: synchAddress,
        3: beneficiary,
    } = accounts;

    let synchDb;
    let synch;

    const maxTx = 10;
    const maxOnChainTx = 3;
    const nLevels = 24;
    const tokenInitialAmount = 1000;
    const tokenId = 0;

    // Operator databse
    let opDb;
    let opRollupDb;

    // Synchronizer database
    let db;
    let synchRollupDb;

    let insPoseidonUnit;
    let insTokenRollup;
    let insStakerManager;
    let insRollupTest;
    let insVerifier;

    const pathDb = `${__dirname}/tmp`;

    let configSynch = {
        pathTreeDb: pathDb,
        pathSynchDb: `${pathDb}-synch`,
        ethNodeUrl: "http://localhost:8545",
        contractAddress: undefined,
        creationHash: undefined,
        ethAddress: synchAddress,
        abi: RollupTest.abi,
    }; 

    // BabyJubjub public key
    const mnemonic = "urban add pulse prefer exist recycle verb angle sell year more mosquito";
    const wallet = BabyJubWallet.fromMnemonic(mnemonic);
    const Ax = wallet.publicKey[0].toString();
    const Ay = wallet.publicKey[1].toString();

    // Fake proofs
    const proofA = ["0", "0"];
    const proofB = [["0", "0"], ["0", "0"]];
    const proofC = ["0", "0"];

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
        insStakerManager = await StakerManager.new(insRollupTest.address);

        // load forge batch mechanism ( not used in this test)
        await insRollupTest.loadForgeBatchMechanism(insStakerManager.address);

        // load configuration synchronizer
        configSynch.contractAddress = insRollupTest.address;
        configSynch.creationHash = insRollupTest.transactionHash;
        
        // Init Synch Rollup databases
        db = new SMTMemDB();
        synchRollupDb = await RollupDB(db);
        // Init operator Rollup Database
        opDb = new SMTMemDB();
        opRollupDb = await RollupDB(opDb);
    });

    it("manage rollup token", async () => { 
        await insRollupTest.addToken(insTokenRollup.address,
            { from: id1, value: web3.utils.toWei("1", "ether") });

        await insTokenRollup.approve(insRollupTest.address, tokenInitialAmount,
            { from: id1 });
    });

    it("Should initialize synchronizer", async () => {
        synchDb = new MemDb();
        synch = new Synchronizer(synchDb, synchRollupDb, configSynch.ethNodeUrl,
            configSynch.contractAddress, configSynch.abi, configSynch.creationHash, configSynch.ethAddress);
    });

    it("Should add deposits and synchronize", async () => {
        const loadAmount = 10;
        const event = await insRollupTest.deposit(loadAmount, tokenId, id1,
            [Ax, Ay], { from: id1, value: web3.utils.toWei("1", "ether") });
        await forgeBlock();
        await forgeBlock([event.logs[0]]);
    });

    it("Should start synchronizer", async () => {
        synch.synchLoop();
    });

    it("timeout test", async () => {
        await timeout(10000);
    });
});
