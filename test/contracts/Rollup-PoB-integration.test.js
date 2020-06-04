/* eslint-disable no-underscore-dangle */
/* eslint-disable no-await-in-loop */
/* global artifacts */
/* global contract */
/* global web3 */

const { expect } = require("chai");
const SMTMemDB = require("circomlib/src/smt_memdb");

const timeTravel = require("./helpers/timeTravel.js");
const { decodeMethod, getEtherBalance, getPublicPoBVariables} = require("./helpers/helpers");
const { buildPublicInputsSm, manageEvent } = require("../../rollup-operator/src/utils");
const poseidonUnit = require("../../node_modules/circomlib/src/poseidon_gencontract.js");
const { BabyJubWallet } = require("../../rollup-utils/babyjub-wallet");
const TokenRollup = artifacts.require("../contracts/test/TokenRollup");
const Verifier = artifacts.require("../contracts/test/VerifierHelper");
const RollupPoB = artifacts.require("../contracts/RollupPoB");
const Rollup = artifacts.require("../contracts/Rollup");
const RollupDB = require("../../js/rollupdb");
const { exitAx, exitAy, exitEthAddr} = require("../../js/constants");

const abiDecoder = require("abi-decoder");
abiDecoder.addABI(RollupPoB.abi);

contract("Rollup - RollupPoB", (accounts) => {
    
    const {
        0: owner,
        1: id1,
        2: ethAddress,
        3: tokenList,
        4: operator1,
        5: feeTokenAddress,
        6: defaultOperator,
    } = accounts;

    let db;
    let rollupDB;

    const tokenId = 0;

    let blocksPerSlot;
    let amountMinBid;
    let genesisBlock;

    const maxTx = 10;
    const maxOnChainTx = 3;
    const url = "localhost";
    let nLevels;

    // BabyJubjub public key
    const mnemonic = "urban add pulse prefer exist recycle verb angle sell year more mosquito";
    const wallet = BabyJubWallet.fromMnemonic(mnemonic);
    const Ax = wallet.publicKey[0].toString();
    const Ay = wallet.publicKey[1].toString();

    // tokenRollup initial amount
    const tokenInitialAmount = 50;
    // PoB constants
    const firstSlot = 3;
    const burnAddress = "0x0000000000000000000000000000000000000000";

    let insPoseidonUnit;
    let insTokenRollup;
    let insRollupPoB;
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
        insRollup = await Rollup.new(insVerifier.address, insPoseidonUnit._address,
            maxTx, maxOnChainTx, feeTokenAddress, { from: owner });

        // Deploy Staker manager
        insRollupPoB = await RollupPoB.new(insRollup.address, maxTx, burnAddress, defaultOperator, url);

        // init rollup database
        db = new SMTMemDB();
        rollupDB = await RollupDB(db);
        nLevels = await insRollup.NLevels();
        [blocksPerSlot, amountMinBid, genesisBlock, ] = await getPublicPoBVariables(insRollupPoB);
    });

    it("Initialization", async () => {
    // Add forge batch mechanism
        await insRollup.loadForgeBatchMechanism(insRollupPoB.address, { from: owner });
        // Add token to rollup token list
        await insRollup.addToken(insTokenRollup.address,
            { from: tokenList, value: web3.utils.toWei("1", "ether") });

        // Add operator to PoB
        await insRollupPoB.bid(firstSlot, url, {
            from: operator1, value: amountMinBid
        });
    });

    it("Deposit", async () => {
        const loadAmount = 10;
        await insTokenRollup.approve(insRollup.address, loadAmount, { from: id1 });

        eventTmp = await insRollup.deposit(loadAmount, tokenId, ethAddress,
            [Ax, Ay], { from: id1, value: web3.utils.toWei("1", "ether") });
    });

    it("Forge batches by operator PoB", async () => {
        const offChainHashInput = 4;

        const proofA = ["0", "0"];
        const proofB = [["0", "0"], ["0", "0"]];
        const proofC = ["0", "0"];

        // move forward block number to allow the operator to forge a batch
        let currentBlock = await web3.eth.getBlockNumber();
        await timeTravel.addBlocks(genesisBlock - currentBlock);
        currentBlock = await web3.eth.getBlockNumber();
        await timeTravel.addBlocks(blocksPerSlot*2);
        currentBlock = await web3.eth.getBlockNumber();
        await timeTravel.addBlocks(blocksPerSlot);
        currentBlock = await web3.eth.getBlockNumber();
        let currentSlot = await insRollupPoB.currentSlot();
        expect(currentSlot.toString()).to.be.equal("3");
        
        // build inputs
        const block = await rollupDB.buildBatch(maxTx, nLevels);
        block.addBeneficiaryAddress(operator1);
        await block.build();
        const inputs = buildPublicInputsSm(block);

        // Check balances
        const balOpBeforeForge = await getEtherBalance(operator1);
        // Forge genesis batch by operator 1
        let compressedTxTest = `0x${block.getDataAvailable().toString("hex")}`;
        await insRollupPoB.commitAndForge(compressedTxTest, proofA, proofB, proofC, inputs, [], {from: operator1});
        // Build inputs
        const block1 = await rollupDB.buildBatch(maxTx, nLevels);
        block1.addBeneficiaryAddress(operator1);
        const tx = manageEvent(eventTmp.logs[0]);
        block1.addTx(tx);
        await block1.build();
        const inputs1 = buildPublicInputsSm(block1);

        // Forge batch by operator 1
        let compressedTxTest1 = `0x${block1.getDataAvailable().toString("hex")}`;
        await insRollupPoB.commitAndForge(compressedTxTest1, proofA, proofB, proofC, inputs1, [], {from: operator1});
        // Consolidate Batch
        await rollupDB.consolidate(block1);
        // Check balances
        const balOpAfterForge = await getEtherBalance(operator1);

        expect(balOpBeforeForge).to.be.lessThan(balOpAfterForge);

        // Retrieve off-chain data forged
        // Step1: Get block number from 'ForgeBatch' event triggered by Rollup.sol
        const logs = await insRollup.getPastEvents("ForgeBatch", {
            fromBlock: 0,
            toBlock: "latest",
        });
        const blockNumber = logs[1].returnValues.blockNumber; // get last event
        // Step2: Get transaction, which was called by the RollupPoB
        const transaction = await web3.eth.getTransactionFromBlock(blockNumber, 0);
        // Step3: Get off-chain hash commited by the user
        const decodedData = decodeMethod(transaction.input);
        let inputRetrieved;
        decodedData.params.forEach(elem => {
            if (elem.name == "input") {
                inputRetrieved = elem.value;
            }
        });
        const offChainHashCommited = inputRetrieved[offChainHashInput];
        // // Step4: Check all events triggered by the RollupPoB 'dataCommited'
        const logs2 = await insRollupPoB.getPastEvents("dataCommitted", {
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
        const decodedData2 = decodeMethod(resTx.input);
        if(block1.getDataAvailableSM() === "0x"){
            expect(decodedData2.params[0].value).to.be.equal(null);
        } else {
            expect(decodedData2.params[0].value).to.equal(block1.getDataAvailableSM());
        }
    });

    it("Forge off-chain deposit", async () => {
        const proofA = ["0", "0"];
        const proofB = [["0", "0"], ["0", "0"]];
        const proofC = ["0", "0"];

        // Babyjub random wallet
        const wallet2 = BabyJubWallet.createRandom();
        const Ax2 = wallet2.publicKey[0].toString(16);
        const Ay2 = wallet2.publicKey[1].toString(16);

        // Create the off-chain deposit and add it to the Batchbuilder
        const batch = await rollupDB.buildBatch(maxTx, nLevels);
        batch.addBeneficiaryAddress(operator1);

        const txOnchain = {
            fromAx: Ax2,
            fromAy:  Ay2,
            fromEthAddr: id1,
            toAx: exitAx,
            toAy: exitAy,
            toEthAddr: exitEthAddr,
            coin: tokenId,
            onChain: true
        };
        batch.addTx(txOnchain);
        batch.addDepositOffChain(txOnchain);

        await batch.build();

        // Encode depositOffchain
        const encodedDeposits =  batch.getDepOffChainData();

        // Build inputs
        const inputs = buildPublicInputsSm(batch);

        // Forge batch by operator 1
        await insRollupPoB.commitAndForge(batch.getDataAvailableSM(), proofA, proofB, proofC, inputs, encodedDeposits, {from: operator1, value: web3.utils.toWei("1", "ether")});
        await rollupDB.consolidate(batch);
    });
});
