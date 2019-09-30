/* global artifacts */
/* global contract */
/* global web3 */

const chai = require("chai");
const ethers = require("ethers");
const { expect } = chai;
const RollupPoS = artifacts.require("../contracts/test/RollupPoSTest");
const OperatorManager = require("../src/operator-manager");
const timeTravel = require("../../test/contracts/helpers/timeTravel");

contract("Operator Manager", async (accounts) => { 

    async function getEtherBalance(address) {
        let balance = await web3.eth.getBalance(address);
        balance = web3.utils.fromWei(balance, "ether");
        return Number(balance);
    }

    const addressRollupTest = "0x0000000000000000000000000000000000000001";
    const debug = true;
    const amountToStake = 2;
    let insRollupPoS;
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
        // Deploy token test
        insRollupPoS = await RollupPoS.new(addressRollupTest);
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
        const compressedTxTest = "0x010203040506070809";
        await timeTravel.addBlocks(blockPerEra); // era 2
        await insRollupPoS.setBlockNumber(eraBlock[2]); // era 2 smart contract test
        await opManager.commit(hashChain[8], compressedTxTest);
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