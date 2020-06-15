/* global artifacts */
/* global contract */
/* global web3 */

const chai = require("chai");
const ethers = require("ethers");
const { expect } = chai;
const SMTMemDB = require("circomlib/src/smt_memdb");
const abiDecoder = require("abi-decoder");
const poseidonUnit = require("../../../node_modules/circomlib/src/poseidon_gencontract.js");
const Scalar = require("ffjavascript").Scalar;

const Verifier = artifacts.require("../../../contracts/test/VerifierHelper");
const RollupPoB = artifacts.require("../../../contracts/test/RollupPoBTest");
const Rollup = artifacts.require("../../../contracts/Rollup");

const RollupDB = require("../../../js/rollupdb");
const OperatorManager = require("../../src/proof-of-burn/interface-pob");
const timeTravel = require("../../../test/contracts/helpers/timeTravel");
const { buildPublicInputsSm } = require("../../src/utils");
const testUtils = require("../helpers/utils-test");
const { encodeDepositOffchain } = require("../../../js/utils");

abiDecoder.addABI(Rollup.abi);

contract("Interface PoB", async (accounts) => { 

    async function getEtherBalance(address) {
        let balance = await web3.eth.getBalance(address);
        balance = web3.utils.fromWei(balance, "ether");
        return Number(balance);
    }

    const {
        0: owner,
        1: feeTokenAddress,
        2: beneficiaryAddress,
        3: forgerAddress,
        4: withdrawAddress,
        5: bonusAddress,
        6: operator2,
        7: defaultOperator,
    } = accounts;

    let db;
    let rollupDB;
    let publicData;
    const amountToBid = 0.1;
    const maxTx = 10;
    const maxOnChainTx = 5;
    const nLevels = 24;
    const offChainHashInput = 4;
    const burnAddress = "0x0000000000000000000000000000000000000000";

    let insPoseidonUnit;
    let insRollupPoB;
    let insRollup;
    let insVerifier;

    let opManager;
    let wallet;
    let genesisBlock;
    const slotBlock = [];
    let blocksPerSlot;
    let slotDeadline;
    const initBalance = 10;
    const gasLimit = "default";
    const gasMultiplier = 1;

    const url = "localhost";
    const initSlot = 2;

    let configSynchPoB = {
        ethNodeUrl: "http://localhost:8545",
        contractAddress: undefined,
        abi: RollupPoB.abi,
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
        insRollupPoB = await RollupPoB.new(insRollup.address, maxTx, burnAddress, defaultOperator, url);

        // Add forge batch mechanism
        await insRollup.loadForgeBatchMechanism(insRollupPoB.address, { from: owner });
        
        // get PoS public data
        publicData = await testUtils.publicDataPoB(insRollupPoB);
        genesisBlock = publicData.genesisBlock;
        blocksPerSlot = publicData.blocksPerSlot;
        slotDeadline = publicData.slotDeadline;


        // load config synch PoB
        configSynchPoB.contractAddress = insRollupPoB.address;
        // load wallet
        wallet = ethers.Wallet.createRandom();
        await web3.eth.sendTransaction({to: wallet.address, from: accounts[0],
            value: web3.utils.toWei(initBalance.toString(), "ether")});
        // Helpers to move among eras
        for (let i = 0; i < 20; i++) {
            slotBlock.push(i * blocksPerSlot + Number(genesisBlock) + 1);
        }

        // init rollup database
        db = new SMTMemDB();
        rollupDB = await RollupDB(db);
    });

    it("Should initialize operator manager", async () => {
        opManager = new OperatorManager(
            configSynchPoB.ethNodeUrl,
            configSynchPoB.contractAddress, 
            configSynchPoB.abi,
            wallet,
            gasMultiplier,
            gasLimit);
    });

    it("Should bid an operator", async () => {
        let slot = initSlot;
       
        const [txSign,] = await opManager.getTxBid(slot, url, amountToBid);
        const res = await web3.eth.sendSignedTransaction(txSign.rawTransaction);

        const currentBlock = await web3.eth.getBlockNumber();
        await timeTravel.addBlocks(genesisBlock - currentBlock + 1); // era 0
        await insRollupPoB.setBlockNumber(slotBlock[0]); // era 0 smart contract test
        expect(res.status).to.be.equal(true);
        const logs = await insRollupPoB.getPastEvents("allEvents", {
            fromBlock: 0,
            toBlock: "latest",
        });
        expect(logs[0].returnValues.operator).to.be.equal(wallet.address);
    });

    it("Should bid an operator with different beneficiary", async () => {
        let slot = initSlot + 1;
        const [txSign,] = await opManager.getTxBidWithDifferentBeneficiary(slot, url, amountToBid, beneficiaryAddress);
        const res = await web3.eth.sendSignedTransaction(txSign.rawTransaction);

        expect(res.status).to.be.equal(true);
        const logs = await insRollupPoB.getPastEvents("allEvents", {
            fromBlock: 0,
            toBlock: "latest",
        });
        expect(logs[0].returnValues.operator).to.be.equal(wallet.address);
    });

    it("Should bid an operator with relay", async () => {
        let slot = initSlot + 2;
        const [txSign,] = await opManager.getTxBidRelay(slot, url, amountToBid, beneficiaryAddress, forgerAddress);
        const res = await web3.eth.sendSignedTransaction(txSign.rawTransaction);

        expect(res.status).to.be.equal(true);
        const logs = await insRollupPoB.getPastEvents("allEvents", {
            fromBlock: 0,
            toBlock: "latest",
        });
        expect(logs[0].returnValues.operator).to.be.equal(wallet.address);
    });

    it("Should bid an operator with relay and withdraw address", async () => {
        let slot = initSlot + 3;
        const [txSign,] = await opManager.getTxBidRelayAndWithdrawAddress(slot, url, amountToBid, beneficiaryAddress, forgerAddress, withdrawAddress);
        const res = await web3.eth.sendSignedTransaction(txSign.rawTransaction);

        expect(res.status).to.be.equal(true);
        const logs = await insRollupPoB.getPastEvents("allEvents", {
            fromBlock: 0,
            toBlock: "latest",
        });
        expect(logs[0].returnValues.operator).to.be.equal(wallet.address);
    });

    it("Should bid an operator with different address", async () => {
        let slot = initSlot + 4;
        const [txSign,] = await opManager.getTxBidWithDifferentAddresses(slot, url, amountToBid, beneficiaryAddress, forgerAddress, withdrawAddress, bonusAddress, false);
        const res = await web3.eth.sendSignedTransaction(txSign.rawTransaction);

        expect(res.status).to.be.equal(true);
        const logs = await insRollupPoB.getPastEvents("allEvents", {
            fromBlock: 0,
            toBlock: "latest",
        });
        expect(logs[0].returnValues.operator).to.be.equal(wallet.address);
    });

    it("Should commit and forge", async () => {
        const proofA = ["0", "0"];
        const proofB = [["0", "0"], ["0", "0"]];
        const proofC = ["0", "0"];
        const batch = await rollupDB.buildBatch(maxTx, nLevels);
        batch.addBeneficiaryAddress(opManager.wallet.address);
        await batch.build();
        const input = await buildPublicInputsSm(batch);
        const commitData = batch.getDataAvailableSM();
        const depOffChainData = encodeDepositOffchain([]);

        await timeTravel.addBlocks(2*blocksPerSlot); // slot 2
        await insRollupPoB.setBlockNumber(slotBlock[2]); // slot 2 smart contract test
        const res = await opManager.getTxCommitAndForge(commitData, proofA,
            proofB, proofC, input, `0x${(depOffChainData).toString("hex")}`, 0);
        const resForge = await web3.eth.sendSignedTransaction(res[0].rawTransaction);
       
        const logs = await insRollupPoB.getPastEvents("dataCommitted", {
            fromBlock: 0,
            toBlock: "latest",
        });
        let found = false;
        logs.forEach(elem => {
            if (Scalar.eq(elem.returnValues.hashOffChain, input[offChainHashInput])) {
                found = true;
            }
        });
        expect(found).to.be. equal(true);
        expect(resForge.status).to.be.equal(true);
    });

    it("Should commit and forge after deadline", async () => {
        const proofA = ["0", "0"];
        const proofB = [["0", "0"], ["0", "0"]];
        const proofC = ["0", "0"];
        const batch = await rollupDB.buildBatch(maxTx, nLevels);
        batch.addBeneficiaryAddress(opManager.wallet.address);
        await batch.build();
        const input = await buildPublicInputsSm(batch);
        const commitData = batch.getDataAvailableSM();
        const depOffChainData = encodeDepositOffchain([]);
        await timeTravel.addBlocks(2*blocksPerSlot - slotDeadline); // slot 3
        await insRollupPoB.setBlockNumber(slotBlock[4] - slotDeadline); // slot 3 smart contract test after deadline
        const res = await opManager.getTxCommitAndForgeDeadline(commitData, proofA,
            proofB, proofC, input, `0x${(depOffChainData).toString("hex")}`, 0);
        const resForge = await web3.eth.sendSignedTransaction(res[0].rawTransaction);
       
        const logs = await insRollupPoB.getPastEvents("dataCommitted", {
            fromBlock: 0,
            toBlock: "latest",
        });
        let found = false;
        logs.forEach(elem => {
            if (Scalar.eq(elem.returnValues.hashOffChain, input[offChainHashInput])) {
                found = true;
            }
        });
        expect(found).to.be. equal(true);
        expect(resForge.status).to.be.equal(true);
    });

    it("Should withdraw operator", async () => {
        let slot = initSlot + 5;
        const amountBid1 = 1;

        const [txSign,] = await opManager.getTxBid(slot, url, amountBid1);
        const res = await web3.eth.sendSignedTransaction(txSign.rawTransaction);
        expect(res.status).to.be.equal(true);
        
        const amountNextMinBid = web3.utils.toHex(web3.utils.toWei((amountBid1*1.3).toString(), "ether"));
        await insRollupPoB.bid(slot, url, {
            from: operator2, value: amountNextMinBid
        });
        const balance = await getEtherBalance(wallet.address);
        const txSignWithdraw = await opManager.getTxWithdraw();
        const resWithdraw = await web3.eth.sendSignedTransaction(txSignWithdraw.rawTransaction);
        expect(resWithdraw.status).to.be.equal(true);

        // check funds are returned to the operator
        const balance2 = await getEtherBalance(wallet.address);
        // const amountMinBidEther = web3.utils.fromWei((await insRollupPoB.MIN_BID()).toString(), "ether");
        expect(Math.round(balance2, -2)).to.be.equal(Math.round(balance, -2) + amountBid1);
    });
});