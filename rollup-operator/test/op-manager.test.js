/* global artifacts */
/* global contract */
/* global web3 */

const chai = require("chai");
const ethers = require("ethers");
const { expect } = chai;

const poseidonUnit = require("../../node_modules/circomlib/src/poseidon_gencontract.js");
const Verifier = artifacts.require("../contracts/test/VerifierHelper");
const RollupPoS = artifacts.require("../contracts/test/RollupPoSTest");
const Rollup = artifacts.require("../contracts/Rollup");

const RollupDB = require("../../js/rollupdb");
const SMTMemDB = require("circomlib/src/smt_memdb");

const abiDecoder = require("abi-decoder");
abiDecoder.addABI(Rollup.abi);

const OperatorManager = require("../src/operator-manager");
const timeTravel = require("../../test/contracts/helpers/timeTravel");
const { buildInputSm } = require("../src/utils");

contract("Operator Manager", async (accounts) => { 

    async function getEtherBalance(address) {
        let balance = await web3.eth.getBalance(address);
        balance = web3.utils.fromWei(balance, "ether");
        return Number(balance);
    }

    const {
        0: owner,
        1: feeTokenAddress,
    } = accounts;

    let db;
    let rollupDB;
    const amountToStake = 2;
    const maxTx = 10;
    const maxOnChainTx = 5;
    const nLevels = 24;

    let insPoseidonUnit;
    let insRollupPoS;
    let insRollup;
    let insVerifier;

    let opManager;
    let wallet;
    let genesisBlock;
    const eraBlock = [];
    const eraSlot = [];
    const slotPerEra = 20;
    const blocksPerSlot = 100;
    const blockPerEra = slotPerEra * blocksPerSlot;
    const initBalance = 5;
    const gasLimit = "default";
    const gasMultiplier = 1;

    const hashChain = [];
    const initialMsg = "rollup";
    const url = "localhost";
    
    hashChain.push(web3.utils.keccak256(initialMsg));
    for (let i = 1; i < 10; i++) {
        hashChain.push(web3.utils.keccak256(hashChain[i - 1]));
    }

    let configSynchPoS = {
        ethNodeUrl: "http://localhost:8545",
        contractAddress: undefined,
        abi: RollupPoS.abi,
    };

    before(async () => {
        // Deploy poseidon
        const C = new web3.eth.Contract(poseidonUnit.abi);
        insPoseidonUnit = await C.deploy({ data: poseidonUnit.createCode() })
            .send({ gas: 2500000, from: owner });

        // Deploy Verifier
        insVerifier = await Verifier.new();

        // Deploy Rollup test
        insRollup = await Rollup.new(insVerifier.address, insPoseidonUnit._address,
            maxTx, maxOnChainTx, feeTokenAddress, { from: owner });

        // Deploy Staker manager
        insRollupPoS = await RollupPoS.new(insRollup.address, maxTx);

        // Add forge batch mechanism
        await insRollup.loadForgeBatchMechanism(insRollupPoS.address, { from: owner });
        
        // get genesis block
        genesisBlock = Number(await insRollupPoS.genesisBlock());
        // load config synch PoS
        configSynchPoS.contractAddress = insRollupPoS.address;
        // load wallet
        wallet = ethers.Wallet.createRandom();
        await web3.eth.sendTransaction({to: wallet.address, from: accounts[0],
            value: web3.utils.toWei(initBalance.toString(), "ether")});
        // Helpers to move among eras
        for (let i = 0; i < 20; i++) {
            eraBlock.push(i * blockPerEra + Number(genesisBlock) + 1);
            eraSlot.push(i * slotPerEra);
        }

        // init rollup database
        db = new SMTMemDB();
        rollupDB = await RollupDB(db);
    });

    it("Should initialize operator manager", async () => {
        opManager = new OperatorManager(
            configSynchPoS.ethNodeUrl,
            configSynchPoS.contractAddress, 
            configSynchPoS.abi,
            wallet,
            gasMultiplier,
            gasLimit);
    });

    it("Should register operator", async () => {
        const txSign = await opManager.getTxRegister(hashChain[9], amountToStake, url);
        const res = await web3.eth.sendSignedTransaction(txSign.rawTransaction);

        const currentBlock = await web3.eth.getBlockNumber();
        await timeTravel.addBlocks(genesisBlock - currentBlock + 1); // era 0
        await insRollupPoS.setBlockNumber(eraBlock[0]); // era 0 smart contract test
        expect(res.status).to.be.equal(true);
        await timeTravel.addBlocks(blockPerEra); // era 1
        await insRollupPoS.setBlockNumber(eraBlock[1]); // era 1 smart contract test
        const logs = await insRollupPoS.getPastEvents("allEvents", {
            fromBlock: 0,
            toBlock: "latest",
        });
        expect(logs[0].returnValues.controllerAddress).to.be.equal(wallet.address);
    });

    it("Should first commit data and then forge it", async () => {
        let txSign;
        const proofA = ["0", "0"];
        const proofB = [["0", "0"], ["0", "0"]];
        const proofC = ["0", "0"];
        const batch = await rollupDB.buildBatch(maxTx, nLevels);
        await batch.build();
        const input = await buildInputSm(batch);

        await timeTravel.addBlocks(blockPerEra); // era 2
        await insRollupPoS.setBlockNumber(eraBlock[2]); // era 2 smart contract test
        txSign = await opManager.getTxCommit(hashChain[8], `0x${batch.getDataAvailable().toString("hex")}`);
        const resCommit = await web3.eth.sendSignedTransaction(txSign.rawTransaction);
        expect(resCommit.status).to.be.equal(true);

        await timeTravel.addBlocks(10); // era 2
        await insRollupPoS.setBlockNumber(eraBlock[2] + 10); // era 2 smart contract test
        const logs = await insRollupPoS.getPastEvents("dataCommitted", {
            fromBlock: 0,
            toBlock: "latest",
        });
        let found = false;
        logs.forEach(elem => {
            if (elem.returnValues.hashOffChain == input[4].toString()) {
                found = true;
            }
        });
        expect(found).to.be. equal(true);
        txSign = await opManager.getTxForge(proofA, proofB, proofC, input);
        const resForge = await web3.eth.sendSignedTransaction(txSign.rawTransaction);
        expect(resForge.status).to.be.equal(true);
    });

    it("Should commit and forge", async () => {
        const proofA = ["0", "0"];
        const proofB = [["0", "0"], ["0", "0"]];
        const proofC = ["0", "0"];
        const batch = await rollupDB.buildBatch(maxTx, nLevels);
        await batch.build();
        const input = await buildInputSm(batch);
        const commitData = `0x${batch.getDataAvailable().toString("hex")}`;

        await timeTravel.addBlocks(blockPerEra); // era 2
        await insRollupPoS.setBlockNumber(eraBlock[2]); // era 2 smart contract test
        const res = await opManager.getTxCommitAndForge(hashChain[7], commitData, proofA,
            proofB, proofC, input);
        const resForge = await web3.eth.sendSignedTransaction(res[0].rawTransaction);
        await timeTravel.addBlocks(10); // era 2
        await insRollupPoS.setBlockNumber(eraBlock[2] + 10); // era 2 smart contract test
        const logs = await insRollupPoS.getPastEvents("dataCommitted", {
            fromBlock: 0,
            toBlock: "latest",
        });
        let found = false;
        logs.forEach(elem => {
            if (elem.returnValues.hashOffChain == input[4].toString()) {
                found = true;
            }
        });
        expect(found).to.be. equal(true);
        expect(resForge.status).to.be.equal(true);
    });

    it("Should unregister operator", async () => {
        const opIdToRemove = 0;
        const txSign = await opManager.getTxUnregister(opIdToRemove);
        const resUnregister = await web3.eth.sendSignedTransaction(txSign.rawTransaction);
        expect(resUnregister.status).to.be.equal(true);
        const logs = await insRollupPoS.getPastEvents("removeOperatorLog", {
            fromBlock: 0,
            toBlock: "latest",
        });
        let controllerAddress;
        logs.forEach(elem => {
            if (elem.returnValues.operatorId == opIdToRemove.toString()) {
                controllerAddress = elem.returnValues.controllerAddress; 
            }
        });
        expect(controllerAddress).to.be.equal(wallet.address);
    });

    it("Should withdraw operator", async () => {
        await timeTravel.addBlocks(2*blockPerEra); // era 4
        await insRollupPoS.setBlockNumber(eraBlock[4]); // era 4 smart contract test
        const txSign = await opManager.getTxWithdraw(0);
        const resWithdraw = await web3.eth.sendSignedTransaction(txSign.rawTransaction);
        expect(resWithdraw.status).to.be.equal(true);
        // check funds are returned to the operator
        const balance = await getEtherBalance(wallet.address);
        expect(Math.ceil(balance)).to.be.equal(initBalance);
    });
});