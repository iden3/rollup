/* global artifacts */
/* global contract */
/* global web3 */

const { expect } = require("chai");

const RollupPoB = artifacts.require("../../contracts/RollupPoB");
const MemDb = require("../../../rollup-utils/mem-db");
const SynchPoB = require("../../src/proof-of-burn/synch-pob");
const timeTravel = require("../../../test/contracts/helpers/timeTravel");
const { timeout } = require("../../src/utils");
const testUtils = require("../helpers/utils-test");

// timeouts test
const timeoutDelay = 15000;
let timeoutSynch;
let timeoutCheck;

contract("Synchronizer PoB", async (accounts) => {

    async function checkFullSynch(){
        await timeout(timeoutCheck);
        const isSynched = await synchPoB.isSynched();
        expect(isSynched).to.be.equal(true);
    }

    const {
        0: synchAddress,
    } = accounts;

    const maxTx = 10;
    const url = "localhost";
    let publicData;
    let genesisBlock;
    let blocksPerSlot;

    const operators = [];
    const addressRollupTest = "0x0000000000000000000000000000000000000001";
    const burnAddress = "0x0000000000000000000000000000000000000000";

    let insRollupPoB;
    let synchDb;
    let synchPoB;

    let auxWinners;
    let auxCurrentWinners;
    let auxbids;
    let auxSlots;

    let configSynchPoB = {
        synchDb: undefined,
        ethNodeUrl: "http://localhost:8545",
        contractAddress: undefined,
        creationHash: undefined,
        ethAddress: synchAddress,
        abi: RollupPoB.abi,
        logLevel: "debug",
        timeouts: { ERROR: 1000, NEXT_LOOP: 1000, LOGGER: 5000 },
    };

    before(async () => {
        // Deploy token test
        insRollupPoB = await RollupPoB.new(addressRollupTest, maxTx, burnAddress, accounts[9], url);
        
        // Init synch db
        synchDb = new MemDb();

        // load config synch PoB
        configSynchPoB.contractAddress = insRollupPoB.address;
        configSynchPoB.creationHash = insRollupPoB.transactionHash;
        configSynchPoB.synchDb = synchDb;
        configSynchPoB.burnAddress = burnAddress;
        // fill 10 addresses for operators
        const numOp = 10;
        for (let i = 0; i < numOp; i++) {
            operators.push({address: accounts[i+1], idOp: i, url: `localhost:900${i}`});
        }

        // get PoB public data
        publicData = await testUtils.publicDataPoB(insRollupPoB);
        genesisBlock = publicData.genesisBlock;
        blocksPerSlot = publicData.blocksPerSlot;

    });

    it("Should initialize synchronizer PoB", async () => {
        synchPoB = new SynchPoB(
            configSynchPoB.synchDb,
            configSynchPoB.ethNodeUrl,
            configSynchPoB.contractAddress,
            configSynchPoB.abi,
            configSynchPoB.creationHash,
            configSynchPoB.ethAddress,
            configSynchPoB.logLevel,
            configSynchPoB.timeouts,
            configSynchPoB.burnAddress);
        synchPoB.synchLoop();

        timeoutSynch = synchPoB.timeouts.NEXT_LOOP + timeoutDelay;
        timeoutCheck = synchPoB.timeouts.NEXT_LOOP + timeoutDelay;
    });

    it("Should Add operator and synch", async () => {
        const slot = 2;
        // Add operator
        await insRollupPoB.bid(slot, url, {
            from: operators[0].address, value: publicData.minBid.toString()
        });
        // move forward block number to move forward slot
        let currentBlock = await web3.eth.getBlockNumber();
        await timeTravel.addBlocks(genesisBlock - currentBlock + 1); // slot 0
        await timeout(timeoutSynch);

        let winners = await synchPoB.getWinners();
        expect(winners[0]).to.be.equal("-1");
        expect(winners[1]).to.be.equal("-1");
        
        let slots = await synchPoB.getSlotWinners();
        expect(slots[0]).to.be.equal(0);
        expect(slots[1]).to.be.equal(1);

        await timeTravel.addBlocks(blocksPerSlot); // slot 1
        await timeout(timeoutSynch);
        winners = await synchPoB.getWinners();
        expect(winners[0]).to.be.equal("-1");
        expect(winners[1]).to.be.equal(operators[0].address);
        slots = await synchPoB.getSlotWinners();
        expect(slots[0]).to.be.equal(1);
        expect(slots[1]).to.be.equal(2);
        
        await timeTravel.addBlocks(blocksPerSlot); // slot 2
        await timeout(timeoutSynch);
        winners = await synchPoB.getWinners();
        expect(winners[0]).to.be.equal(operators[0].address);
        expect(winners[1]).to.be.equal(accounts[9]);
        slots = await synchPoB.getSlotWinners();
        expect(slots[0]).to.be.equal(2);
        expect(slots[1]).to.be.equal(3);
        await checkFullSynch();
    });

    it("Should add several operators and synch", async () => {
        const newBid = web3.utils.toWei("0.3", "ether");
        const initSlot = Number(await insRollupPoB.currentSlot());

        // Add operators
        await insRollupPoB.bid(initSlot + 2 , url, {
            from: operators[0].address, value: publicData.minBid.toString()
        });
        await insRollupPoB.bid(initSlot + 10, url, {
            from: operators[1].address, value: publicData.minBid.toString()
        });

        await timeTravel.addBlocks(blocksPerSlot); // currentSlot + 1
        await timeout(timeoutSynch);

        let winners = await synchPoB.getWinners();
        let currentWinners = await synchPoB.getCurrentWinners();
        let slots = await synchPoB.getSlotWinners();
        let bids = await synchPoB.getCurrentBids();
        expect(slots[1]).to.be.equal(initSlot + 2);
        expect(slots[9]).to.be.equal(initSlot + 10);
        let index1 = slots.indexOf(initSlot + 2);
        let index2 = slots.indexOf(initSlot + 10);
        expect(winners[0]).to.be.equal(accounts[9]);
        expect(winners[1]).to.be.equal(operators[0].address);
        expect(bids[index1]).to.be.equal(publicData.minBid.toString());
        expect(bids[index2]).to.be.equal(publicData.minBid.toString());
        expect(currentWinners[index1]).to.be.equal(operators[0].address);
        expect(currentWinners[index2]).to.be.equal(operators[1].address);

        await insRollupPoB.bid(initSlot + 4, url, {
            from: operators[2].address, value: publicData.minBid.toString()
        });
        await insRollupPoB.bid(initSlot + 10, url, {
            from: operators[2].address, value: newBid.toString()
        });

        await timeTravel.addBlocks(blocksPerSlot); // slot currentSlot + 2
        await timeout(timeoutSynch);
        
        winners = await synchPoB.getWinners();
        currentWinners = await synchPoB.getCurrentWinners();
        slots = await synchPoB.getSlotWinners();
        bids = await synchPoB.getCurrentBids();

        expect(slots[0]).to.be.equal(initSlot + 2);
        expect(slots[2]).to.be.equal(initSlot + 4);
        expect(slots[8]).to.be.equal(initSlot + 10);
        index1 = slots.indexOf(initSlot + 2);
        let index3 = slots.indexOf(initSlot + 4);
        index2 = slots.indexOf(initSlot + 10);
        expect(winners[0]).to.be.equal(operators[0].address);
        expect(winners[1]).to.be.equal(accounts[9]);
        expect(bids[index1]).to.be.equal(publicData.minBid.toString());
        expect(bids[index3]).to.be.equal(publicData.minBid.toString());
        expect(bids[index2]).to.be.equal(newBid.toString());
        expect(currentWinners[index1]).to.be.equal(operators[0].address);
        expect(currentWinners[index3]).to.be.equal(operators[2].address);
        expect(currentWinners[index2]).to.be.equal(operators[2].address);
        await checkFullSynch();
        auxWinners = winners;
        auxCurrentWinners = currentWinners;
        auxSlots = slots;
        auxbids = bids;
    });

    it("Should new synchPoB and synch", async() => {
        const synchPoB2 = new SynchPoB(
            configSynchPoB.synchDb,
            configSynchPoB.ethNodeUrl,
            configSynchPoB.contractAddress,
            configSynchPoB.abi,
            configSynchPoB.creationHash,
            configSynchPoB.ethAddress,
            configSynchPoB.logLevel,
            configSynchPoB.timeouts,
            configSynchPoB.burnAddress);
        synchPoB2.synchLoop();
        await timeout(timeoutSynch);

        let winners = await synchPoB2.getWinners();
        let currentWinners = await synchPoB2.getCurrentWinners();
        let slots = await synchPoB2.getSlotWinners();
        let bids = await synchPoB2.getCurrentBids();
        expect(slots[0]).to.be.equal(auxSlots[0]);
        expect(slots[2]).to.be.equal(auxSlots[2]);
        expect(slots[8]).to.be.equal(auxSlots[8]);
        expect(winners[0]).to.be.equal(auxWinners[0]);
        expect(winners[1]).to.be.equal(auxWinners[1]);
        expect(bids[0]).to.be.equal(auxbids[0]);
        expect(bids[2]).to.be.equal(auxbids[2]);
        expect(bids[8]).to.be.equal(auxbids[8]);
        expect(currentWinners[0]).to.be.equal(auxCurrentWinners[0]);
        expect(currentWinners[2]).to.be.equal(auxCurrentWinners[2]);
        expect(currentWinners[8]).to.be.equal(auxCurrentWinners[8]);
    });
});