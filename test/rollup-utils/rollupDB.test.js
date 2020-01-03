const { expect } = require("chai");
const { stringifyBigInts } = require("snarkjs");
const lodash = require("lodash");
const SMTMemDB = require("circomlib").SMTMemDB;
const util = require("util");
const exec = util.promisify( require("child_process").exec);

const RollupAccount = require("../../js/rollupaccount");
const RollupDB = require("../../js/rollupdb");
const { SMTLevelDb } = require("../../rollup-utils/smt-leveldb");

async function initRollupDb(rollupDB) {

    const bb = await rollupDB.buildBatch(4, 8);

    const account1 = new RollupAccount(1);
    const account2 = new RollupAccount(2);

    bb.addTx({ fromIdx: 1, loadAmount: 10, coin: 0, ax: account1.ax, ay: account1.ay,
        ethAddress: account1.ethAddress, onChain: true });

    bb.addTx({ fromIdx: 2, loadAmount: 10, coin: 1, ax: account1.ax, ay: account1.ay,
        ethAddress: account1.ethAddress, onChain: true });

    bb.addTx({ fromIdx: 3, loadAmount: 0, coin: 0, ax: account2.ax, ay: account2.ay,
        ethAddress: account2.ethAddress, onChain: true });

    bb.addTx({ fromIdx: 4, loadAmount: 0, coin: 1, ax: account2.ax, ay: account2.ay,
        ethAddress: account2.ethAddress, onChain: true });

    await bb.build();

    await rollupDB.consolidate(bb);
}

async function checkDb(memDb, toCheckDb){
    // Check root
    const memRoot = await memDb.db.getRoot();
    const checkRoot = await toCheckDb.db.getRoot();
    expect(memRoot).to.be.equal(checkRoot);
    
    // Check database
    const keys = Object.keys(memDb.db.nodes);
    for (const key of keys) {
        const valueMem = JSON.stringify(stringifyBigInts(await memDb.db.get(key)));
        const valueToCheck = JSON.stringify(stringifyBigInts(await toCheckDb.db.get(key)));
        expect(lodash.isEqual(valueMem, valueToCheck)).to.be.equal(true);
    }
}


describe("RollupDb", async function () {
    let rollupMemDb;
    let rollupLevelDb;

    const pathDb = `${__dirname}/tmp-rollupDb`;

    it("should initialize with memory database", async () => {
        const db = new SMTMemDB();
        rollupMemDb = await RollupDB(db);
        await initRollupDb(rollupMemDb);
    });

    it("should initialize with level-db database", async () => {
        const db = new SMTLevelDb(pathDb);
        rollupLevelDb = await RollupDB(db);
        await initRollupDb(rollupLevelDb);
    });

    it("should check equal databases", async () => {
        await checkDb(rollupMemDb, rollupLevelDb);
    });

    after(async () => {
        await exec(`rm -rf ${pathDb}`);
    });
});
