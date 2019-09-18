/* global artifacts */
/* global contract */
/* global web3 */

const chai = require("chai");
const process = require("child_process");
const { expect } = chai;
const EventTest = artifacts.require("../../contracts/test/EventTest");
const Synchronizer = require("../src/synchronizer/synch");
const RollupTree = require("../../rollup-utils/rollup-tree");
const LevelDb = require("../../rollup-utils/level-db");

function timeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

contract("Synchronizer", (accounts) => {
    const {
        0: owner,
        1: synchAddress,
    } = accounts;
    let insEvent;
    let rollupTree;
    let synchDb;
    let synch;
    let stateRoots = [];
    const pathDb = `${__dirname}/tmp`;

    let configSynch = {
        pathTreeDb: pathDb,
        pathSynchDb: `${pathDb}-synch`,
        ethNodeUrl: "http://localhost:8545",
        eventsAddress: undefined,
        creationHash: undefined,
        ethAddress: synchAddress,
        abi: EventTest.abi,
    }; 

    before(async () => {
        // Deploy token test
        insEvent = await EventTest.new();
        // load configuration synchronizer
        configSynch.eventsAddress = insEvent.address;
        configSynch.creationHash = insEvent.transactionHash;
        // Test state roots
        for (let i = 0; i < 50; i++) {
            stateRoots.push(`0x${Buffer.alloc(32).fill(i, 31).toString("hex")}`);
        }
    });

    after(async () => {
        timeout(20000);
        after(async () => {
            process.exec(`rm -rf ${pathDb}-leafs`);
            process.exec(`rm -rf ${pathDb}-tree`);
            process.exec(`rm -rf ${pathDb}-synch`);
        });
    });

    it("initialize synchronizer", async () => {
        rollupTree = await RollupTree.newLevelDbRollupTree(configSynch.pathTreeDb);
        synchDb = new LevelDb(configSynch.pathSynchDb);
        
        synch = new Synchronizer(synchDb, rollupTree, configSynch.ethNodeUrl,
            configSynch.eventsAddress, configSynch.abi, configSynch.creationHash, configSynch.ethAddress);
    });

    it("forge batches", async () => {
        for (let i = 0; i < 1; i++) {
            await insEvent.forgeBatch(stateRoots[i], "0x00000000");    
        }
    });

    it("loop synchronize events", async () => {
        await synch.synchLoop();
    });
});
