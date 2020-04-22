/* eslint-disable no-underscore-dangle */
/* eslint-disable no-await-in-loop */
/* global artifacts */
/* global contract */
/* global web3 */

const { expect } = require("chai");
const SMTMemDB = require("circomlib/src/smt_memdb");

const timeTravel = require("./helpers/timeTravel.js");
const { decodeMethod, getEtherBalance, getPublicPoSVariables} = require("./helpers/helpers");
const { buildPublicInputsSm, manageEvent } = require("../../rollup-operator/src/utils");
const poseidonUnit = require("../../node_modules/circomlib/src/poseidon_gencontract.js");
const { BabyJubWallet } = require("../../rollup-utils/babyjub-wallet");
const TokenRollup = artifacts.require("../contracts/test/TokenRollup");
const Verifier = artifacts.require("../contracts/test/VerifierHelper");
const RollupPoS = artifacts.require("../contracts/RollupPoS");
const Rollup = artifacts.require("../contracts/Rollup");
const RollupDB = require("../../js/rollupdb");


contract("Rollup - RollupPoS", (accounts) => {
    
    const {
        0: owner,
        1: id1,
        2: ethAddress,
        3: tokenList,
        4: operator1,
        5: feeTokenAddress
    } = accounts;

    let db;
    let rollupDB;

    const tokenId = 0;

    const hashChain = [];
    let blockPerEra;
    let amountToStake;
    let genesisBlock;

    const maxTx = 10;
    const maxOnChainTx = 3;
    let nLevels;
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
        insRollup = await Rollup.new(insVerifier.address, insPoseidonUnit._address,
            maxTx, maxOnChainTx, feeTokenAddress, { from: owner });

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
        nLevels = await insRollup.NLevels();
        [ , , blockPerEra, amountToStake, genesisBlock] = await getPublicPoSVariables(insRollupPoS);
    });

    it("Initialization", async () => {
    // Add forge batch mechanism
        await insRollup.loadForgeBatchMechanism(insRollupPoS.address, { from: owner });
        // Add token to rollup token list
        await insRollup.addToken(insTokenRollup.address,
            { from: tokenList, value: web3.utils.toWei("1", "ether") });

        // Add operator to PoS
        await insRollupPoS.addOperator(hashChain.pop(), url,
            { from: operator1, value: amountToStake });
    });

    it("Deposit", async () => {
        const loadAmount = 10;
        await insTokenRollup.approve(insRollup.address, loadAmount, { from: id1 });

        eventTmp = await insRollup.deposit(loadAmount, tokenId, ethAddress,
            [Ax, Ay], { from: id1, value: web3.utils.toWei("1", "ether") });
    });

    it("Forge batches by operator PoS", async () => {
        const offChainHashInput = 4;

        const proofA = ["0", "0"];
        const proofB = [["0", "0"], ["0", "0"]];
        const proofC = ["0", "0"];
        // move forward block number to allow the operator to forge a batch
        let currentBlock = await web3.eth.getBlockNumber();
        await timeTravel.addBlocks(genesisBlock - currentBlock);
        currentBlock = await web3.eth.getBlockNumber();
        await timeTravel.addBlocks(blockPerEra*2);
        currentBlock = await web3.eth.getBlockNumber();
        await timeTravel.addBlocks(blockPerEra);
        currentBlock = await web3.eth.getBlockNumber();

        // build inputs
        const block = await rollupDB.buildBatch(maxTx, nLevels);
        await block.build();
        const inputs = buildPublicInputsSm(block);

        // Check balances
        const balOpBeforeForge = await getEtherBalance(operator1);
        // Forge genesis batch by operator 1
        await insRollupPoS.commitBatch(hashChain.pop(), `0x${block.getDataAvailable().toString("hex")}`, [], {from: operator1});
        await insRollupPoS.forgeCommittedBatch(proofA, proofB, proofC, inputs, [], {from: operator1});
        // Build inputs
        const block1 = await rollupDB.buildBatch(maxTx, nLevels);
        const tx = manageEvent(eventTmp.logs[0]);
        block1.addTx(tx);
        await block1.build();
        const inputs1 = buildPublicInputsSm(block1);

        // Forge batch by operator 1
        await insRollupPoS.commitBatch(hashChain.pop(), `0x${block1.getDataAvailable().toString("hex")}`, [], {from: operator1});
        await insRollupPoS.forgeCommittedBatch(proofA, proofB, proofC, inputs1, [], {from: operator1});
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
        const decodedData = decodeMethod(transaction.input);
        let inputRetrieved;
        decodedData.params.forEach(elem => {
            if (elem.name == "input") {
                inputRetrieved = elem.value;
            }
        });
        const offChainHashCommited = inputRetrieved[offChainHashInput];
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
        const decodedData2 = decodeMethod(resTx.input);
        expect(decodedData2.params[1].value).to.be.
            equal(`0x${block1.getDataAvailable().toString("hex")}`);
    });
});
