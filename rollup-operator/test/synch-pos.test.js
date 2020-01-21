/* global artifacts */
/* global contract */
/* global web3 */

const chai = require("chai");

const { expect } = chai;
const RollupPoS = artifacts.require("../contracts/RollupPoS");
const MemDb = require("../../rollup-utils/mem-db");
const SynchPoS = require("../src/synch-pos");
const timeTravel = require("../../test/contracts/helpers/timeTravel");
const { timeout } = require("../src/utils");

// timeouts test
const timeoutDelay = 7500;
let timeoutSynch;
let timeoutCheck;

contract("Synchronizer PoS", async (accounts) => {

    async function checkSlot(slots) {
        const currentEra = await synchPoS.getCurrentEra();
        for (let i = 0; i < 2*slotPerEra; i++) {
            const slotNum = slotPerEra*currentEra + i;
            expect(slotNum).to.be.equal(slots[i]);   
        }
    }

    async function checkFullSynch(){
        await timeout(timeoutCheck);
        const isSynched = await synchPoS.isSynched();
        expect(isSynched).to.be.equal(true);
    }

    const {
        0: synchAddress,
    } = accounts;

    const maxTx = 10;
    const slotPerEra = 20;
    const blocksPerSlot = 100;
    const blockPerEra = slotPerEra * blocksPerSlot;
    const rndHash = "0x0000000000000000000000000000000000000000000000000000000000000000";
    const operators = [];
    const addressRollupTest = "0x0000000000000000000000000000000000000001";

    let insRollupPoS;
    let synchDb;
    let synchPoS;
    let genesisBlock;

    let configSynchPoS = {
        synchDb: undefined,
        ethNodeUrl: "http://localhost:8545",
        contractAddress: undefined,
        creationHash: undefined,
        ethAddress: synchAddress,
        abi: RollupPoS.abi,
        logLevel: "debug",
        timeouts: { ERROR: 1000, NEXT_LOOP: 1000, LOGGER: 5000 },
    };

    before(async () => {
        // Deploy token test
        insRollupPoS = await RollupPoS.new(addressRollupTest, maxTx);
        genesisBlock = Number(await insRollupPoS.genesisBlock());
        // Init synch db
        synchDb = new MemDb();

        // load config synch PoS
        configSynchPoS.contractAddress = insRollupPoS.address;
        configSynchPoS.creationHash = insRollupPoS.transactionHash;
        configSynchPoS.synchDb = synchDb;

        // fill 10 addresses for operators
        const numOp = 10;
        for (let i = 0; i < numOp; i++) {
            operators.push({address: accounts[i+1], idOp: i, url: `localhost:900${i}`});
        }
    });

    it("Should initialize synchronizer PoS", async () => {
        synchPoS = new SynchPoS(
            configSynchPoS.synchDb,
            configSynchPoS.ethNodeUrl,
            configSynchPoS.contractAddress,
            configSynchPoS.abi,
            configSynchPoS.creationHash,
            configSynchPoS.ethAddress,
            configSynchPoS.logLevel,
            configSynchPoS.timeouts);
        synchPoS.synchLoop();

        timeoutSynch = synchPoS.timeouts.NEXT_LOOP + timeoutDelay;
        timeoutCheck = synchPoS.timeouts.NEXT_LOOP + timeoutDelay;
    });

    it("Should Add operator and synch", async () => {
        // Add operator
        await insRollupPoS.addOperator(rndHash, operators[0].url,
            { from: operators[0].address, value: web3.utils.toWei("2", "ether") });
        // move forward block number to allow the operator to forge a batch
        let currentBlock = await web3.eth.getBlockNumber();
        await timeTravel.addBlocks(genesisBlock - currentBlock + 1); // era 0
        currentBlock = await web3.eth.getBlockNumber();
        await timeout(timeoutSynch);
        // check one operator is added
        let listOperators = await synchPoS.getOperators();
        expect(listOperators[operators[0].idOp.toString()].controllerAddress)
            .to.be.equal(operators[0].address.toString());
        expect(listOperators[operators[0].idOp.toString()].url)
            .to.be.equal(operators[0].url);

        let winners = await synchPoS.getRaffleWinners();
        expect(winners.length).to.be.equal(2*slotPerEra);
        await checkSlot(await synchPoS.getSlotWinners());
        // expect no winners for era 0 and era 1
        for(const winner of winners) expect(winner).to.be.equal(-1);
        await timeTravel.addBlocks(blockPerEra); // era 1
        await timeout(timeoutSynch);
        winners = await synchPoS.getRaffleWinners();
        // expect no winners for era 1 and operator winner for era 2
        for(let i = 0; i < winners.length; i++) {
            if (i < winners.length/2) expect(winners[i]).to.be.equal(-1);
            else expect(winners[i]).to.be.equal(operators[0].idOp);
        }
        await checkSlot(await synchPoS.getSlotWinners());
        await checkFullSynch();
    });

    it("Should remove operator and synch", async () => {
        await insRollupPoS.removeOperator(operators[0].idOp, { from: operators[0].address });
        await timeTravel.addBlocks(blockPerEra); // era 3
        await timeout(timeoutSynch);
        let winners = await synchPoS.getRaffleWinners();
        // expect winner for era 3 and no winner for era 4
        for(let i = 0; i < winners.length; i++) {
            if (i < winners.length/2) expect(winners[i]).to.be.equal(operators[0].idOp);
            else expect(winners[i]).to.be.equal(-1);
        }
        await checkSlot(await synchPoS.getSlotWinners());
        await timeTravel.addBlocks(blockPerEra); // era 4
        await timeout(timeoutSynch);
        winners = await synchPoS.getRaffleWinners();
        // expect no winners for era 4 and era 5
        for(const winner of winners) expect(winner).to.be.equal(-1);
        await checkSlot(await synchPoS.getSlotWinners());
        await timeTravel.addBlocks(blockPerEra); // era 5
        await timeout(timeoutSynch);
        const listOperators = await synchPoS.getOperators();
        expect(Object.keys(listOperators).length).to.be.equal(0);
        await checkFullSynch();
    });

    it("Should add several operators and synch", async () => {
        // Add operators
        const numOp2Add = 5;
        for (let i = 0; i < numOp2Add; i++) {
            await insRollupPoS.addOperator(rndHash, operators[i+1].url,
                { from: operators[i+1].address, value: web3.utils.toWei("2", "ether") });
        }
        await timeTravel.addBlocks(blockPerEra); // era 6
        await timeout(timeoutSynch);
        let winners = await synchPoS.getRaffleWinners();
        // expect no winner for era 5 and winner for era 6
        for(let i = 0; i < winners.length; i++) {
            if (i < winners.length/2) expect(winners[i]).to.be.equal(-1);
            else expect(winners[i]).to.be.within(1, numOp2Add);
        }
        await checkSlot(await synchPoS.getSlotWinners());
        await timeTravel.addBlocks(blockPerEra); // era 7
        await timeout(timeoutSynch);
        winners = await synchPoS.getRaffleWinners();
        // expect winner for era 6 and winner for era 7
        for(const winner of winners) expect(winner).to.be.within(1, numOp2Add);
        await checkSlot(await synchPoS.getSlotWinners());
        await timeTravel.addBlocks(blockPerEra); // era 8
        await timeout(timeoutSynch);
        const listOperators = await synchPoS.getOperators();
        for (let i = 0; i < numOp2Add; i++ ) {
            const value = listOperators[operators[i+1].idOp.toString()];
            expect(value.controllerAddress).to.be.
                equal(operators[i+1].address.toString());
            expect(value.url).to.be.equal(operators[i+1].url);
        }
        const opIdInfo = await synchPoS.getOperatorById(1);
        expect(opIdInfo.controllerAddress).to.be.
            equal(operators[1].address.toString());
        expect(opIdInfo.url).to.be.
            equal(operators[1].url);
        await checkFullSynch();
    });
});