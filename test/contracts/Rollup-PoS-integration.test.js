/* eslint-disable no-underscore-dangle */
/* eslint-disable no-await-in-loop */
/* global artifacts */
/* global contract */
/* global web3 */
/* global BigInt */

const chai = require("chai");
const rollupUtils = require("../../rollup-utils/rollup-utils.js");
const timeTravel = require("./helpers/timeTravel.js");

const { expect } = chai;
const poseidonUnit = require("../../node_modules/circomlib/src/poseidon_gencontract.js");
const { BabyJubWallet } = require("../../rollup-utils/babyjub-wallet");
const TokenRollup = artifacts.require("../contracts/test/TokenRollup");
const Verifier = artifacts.require("../contracts/test/VerifierHelper");
const RollupPoS = artifacts.require("../contracts/RollupPoS");
const Rollup = artifacts.require("../contracts/Rollup");

const RollupDB = require("../../js/rollupdb");
const SMTMemDB = require("circomlib/src/smt_memdb");

const abiDecoder = require("abi-decoder");
abiDecoder.addABI(RollupPoS.abi);
abiDecoder.addABI(Rollup.abi);

async function getEtherBalance(address) {
    let balance = await web3.eth.getBalance(address);
    balance = web3.utils.fromWei(balance, "ether");
    return Number(balance);
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

contract("Rollup - RollupPoS", (accounts) => {
    
    const {
        0: owner,
        1: id1,
        2: ethAddress,
        3: tokenList,
        4: operator1,
    } = accounts;

    let db;
    let rollupDB;

    const tokenId = 0;

    const hashChain = [];
    const slotPerEra = 20;
    const blocksPerSlot = 100;
    const blockPerEra = slotPerEra * blocksPerSlot;
    const amountToStake = 2;

    const maxTx = 10;
    const maxOnChainTx = 3;
    const nLevels = 24;
    const url = "localhost";

    // BabyJubjub public key
    const mnemonic = "urban add pulse prefer exist recycle verb angle sell year more mosquito";
    const wallet = BabyJubWallet.fromMnemonic(mnemonic);
    const Ax = wallet.publicKey[0].toString();
    const Ay = wallet.publicKey[1].toString();

    // tokenRollup initial amount
    const tokenInitialAmount = 50;
    const initialMsg = "rollup";

    let insPoseidonUnit;
    let insTokenRollup;
    let insRollupPoS;
    let insRollup;
    let insVerifier;
    let eventTmp;

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
        insRollup = await Rollup.new(insVerifier.address, insPoseidonUnit._address, maxTx, maxOnChainTx,
            { from: owner });

        // Deploy Staker manager
        insRollupPoS = await RollupPoS.new(insRollup.address, maxTx);

        // Create hash chain for the operator
        hashChain.push(web3.utils.keccak256(initialMsg));
        for (let i = 1; i < 5; i++) {
            hashChain.push(web3.utils.keccak256(hashChain[i - 1]));
        }

        // init rollup database
        db = new SMTMemDB();
        rollupDB = await RollupDB(db);
    });

    it("Initialization", async () => {
    // Add forge batch mechanism
        await insRollup.loadForgeBatchMechanism(insRollupPoS.address, { from: owner });
        // Add token to rollup token list
        await insRollup.addToken(insTokenRollup.address,
            { from: tokenList, value: web3.utils.toWei("1", "ether") });

        // Add operator to PoS
        await insRollupPoS.addOperator(hashChain[4], url,
            { from: operator1, value: web3.utils.toWei(amountToStake.toString(), "ether") });
    });

    it("Deposit", async () => {
        const loadAmount = 10;
        await insTokenRollup.approve(insRollup.address, loadAmount, { from: id1 });

        eventTmp = await insRollup.deposit(loadAmount, tokenId, ethAddress,
            [Ax, Ay], { from: id1, value: web3.utils.toWei("1", "ether") });
    });

    it("Forge batches by operator PoS", async () => {
        const proofA = ["0", "0"];
        const proofB = [["0", "0"], ["0", "0"]];
        const proofC = ["0", "0"];
        // move forward block number to allow the operator to forge a batch
        let currentBlock = await web3.eth.getBlockNumber();
        const genesisBlock = await insRollupPoS.genesisBlock();
        await timeTravel.addBlocks(genesisBlock - currentBlock);
        currentBlock = await web3.eth.getBlockNumber();
        await timeTravel.addBlocks(blockPerEra);
        currentBlock = await web3.eth.getBlockNumber();
        await timeTravel.addBlocks(blockPerEra);
        currentBlock = await web3.eth.getBlockNumber();

        // build inputs
        const block = await rollupDB.buildBatch(maxTx, nLevels);
        await block.build();
        const inputs = buildInputSm(block);

        // Check balances
        const balOpBeforeForge = await getEtherBalance(operator1);
        // Forge genesis batch by operator 1
        await insRollupPoS.commitBatch(hashChain[3], `0x${block.getDataAvailable().toString("hex")}`);
        await insRollupPoS.forgeCommittedBatch(proofA, proofB, proofC, inputs);

        // Build inputs
        const block1 = await rollupDB.buildBatch(maxTx, nLevels);
        const tx = manageEvent(eventTmp.logs[0]);
        block1.addTx(tx);
        await block1.build();
        const inputs1 = buildInputSm(block1);

        // Forge batch by operator 1
        await insRollupPoS.commitBatch(hashChain[2], `0x${block1.getDataAvailable().toString("hex")}`);
        await insRollupPoS.forgeCommittedBatch(proofA, proofB, proofC, inputs1);
        // Check balances
        const balOpAfterForge = await getEtherBalance(operator1);
        expect(Math.ceil(balOpBeforeForge) + 1).to.be.equal(Math.ceil(balOpAfterForge));

        // Retrieve off-chain data forged
        // Step1: Get block number from 'ForgeBatch' event triggered by Rollup.sol
        const logs = await insRollup.getPastEvents("ForgeBatch", {
            fromBlock: 0,
            toBlock: "latest",
        });
        const blockNumber = logs[1].returnValues.blockNumber; // get last event
        // Step2: Get transaction, which was called by the RollupPoS
        const transaction = await web3.eth.getTransactionFromBlock(blockNumber, 0);
        // Step3: Get off-chain hash commited by the user
        const decodedData = abiDecoder.decodeMethod(transaction.input);
        let inputRetrieved;
        decodedData.params.forEach(elem => {
            if (elem.name == "input") {
                inputRetrieved = elem.value;
            }
        });
        const offChainHashCommited = inputRetrieved[4];
        // // Step4: Check all events triggered by the RollupPos 'dataCommited'
        const logs2 = await insRollupPoS.getPastEvents("dataCommitted", {
            fromBlock: 0,
            toBlock: "latest",
        });
        // find event that matches offChainHashCommited and read its input data
        let txHash;
        logs2.forEach(elem => {
            if (elem.returnValues.hashOffChain == offChainHashCommited) {
                txHash = elem.transactionHash;
            }
        });
        const resTx = await web3.eth.getTransaction(txHash);
        const decodedData2 = abiDecoder.decodeMethod(resTx.input);
        expect(decodedData2.params[1].value).to.be.
            equal(`0x${block1.getDataAvailable().toString("hex")}`);
    });
});
