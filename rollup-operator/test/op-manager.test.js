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

const abiDecoder = require("abi-decoder");
abiDecoder.addABI(Rollup.abi);

const OperatorManager = require("../src/operator-manager");
const timeTravel = require("../../test/contracts/helpers/timeTravel");

contract("Operator Manager", async (accounts) => { 

    async function getEtherBalance(address) {
        let balance = await web3.eth.getBalance(address);
        balance = web3.utils.fromWei(balance, "ether");
        return Number(balance);
    }

    const {
        0: owner,
        1: id1,
        2: tokenList,
    } = accounts;

    const debug = true;
    const amountToStake = 2;
    const maxTx = 10;
    const maxOnChainTx = 5;

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

    const hashChain = [];
    const initialMsg = "rollup";
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
        insRollup = await Rollup.new(insVerifier.address, insPoseidonUnit._address, maxTx, maxOnChainTx,
            { from: owner });

        // Deploy Staker manager
        insRollupPoS = await RollupPoS.new(insRollup.address);

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
    });

    it("Should initialize operator manager", async () => {
        opManager = new OperatorManager(configSynchPoS.ethNodeUrl,
            configSynchPoS.contractAddress, configSynchPoS.abi, debug);
    });

    it("Should load wallet [debug mode]", async () => {
        await opManager.loadWallet(wallet);
    });

    it("Should register operator", async () => {
        const res = await opManager.register(hashChain[9], amountToStake);
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

    it("Should commit data", async () => {
        const compressedTxTest = "0x";
        await timeTravel.addBlocks(blockPerEra); // era 2
        await insRollupPoS.setBlockNumber(eraBlock[2]); // era 2 smart contract test
        await opManager.commit(hashChain[8], compressedTxTest);
        await timeTravel.addBlocks(10); // era 2
        await insRollupPoS.setBlockNumber(eraBlock[2] + 10); // era 2 smart contract test
        const logs = await insRollupPoS.getPastEvents("allEvents", {
            fromBlock: 0,
            toBlock: "latest",
        });
        expect(logs[1].returnValues.blockNumber.toString()).to.be.equal(eraBlock[2].toString());
    });

    it("Should forge commit data", async () => {
        const proofA = ["0", "0"];
        const proofB = [["0", "0"], ["0", "0"]];
        const proofC = ["0", "0"];
        const input = ["0", "0", "0", "0", "0", "0", "0", "0"];
        const res = await opManager.forge(proofA, proofB, proofC, input);
        expect(res.status).to.be.equal(true);
    });

    it("Should unregister operator", async () => {
        const res = await opManager.unregister(0);
        expect(res.status).to.be.equal(true);
        const logs = await insRollupPoS.getPastEvents("allEvents", {
            fromBlock: 0,
            toBlock: "latest",
        });
        expect(logs[2].returnValues.controllerAddress).to.be.equal(wallet.address);
    });

    it("Should withdraw operator", async () => {
        await timeTravel.addBlocks(2*blockPerEra); // era 4
        await insRollupPoS.setBlockNumber(eraBlock[4]); // era 4 smart contract test
        await opManager.withdraw(0);
        // check funds are returned to the operator
        const balance = await getEtherBalance(wallet.address);
        expect(Math.ceil(balance)).to.be.equal(initBalance);
    });
});