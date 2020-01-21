const fs = require("fs");
const path = require("path");
const { expect } = require("chai");
const _ = require("lodash");

const Pool = require("../../js/txpool");
const SynchPool = require("../src/synch-pool");
const RollupDB = require("../../js/rollupdb");
const SMTMemDB = require("circomlib/src/smt_memdb");
const { timeout } = require("../src/utils");

describe("Synchronizer test", function () {
    this.timeout(0);

    const timeoutDelay = 2500;
    let timeoutUpdate;
    let pool;
    let synchPool;
    const pathConversionTable = path.join(__dirname,"./config/table-conversion-test.json");
    
    const poolConfig = {
        maxSlots: 10,
        executableSlots: 1,
        nonExecutableSlots: 1, 
        timeout: 1000,
        pathConversionTable: pathConversionTable,
        timeouts: { ERROR: 5000, NEXT_LOOP: 5000}, 
    };

    after (async () => {
        fs.unlinkSync(pathConversionTable);
        process.exit();
    });

    it("Should initialize pool", async () => {
        const smtDb = new SMTMemDB();
        const conversion = {};
        const initRollupDb = await RollupDB(smtDb); 
        pool = await Pool(initRollupDb, conversion, poolConfig);
    });

    it("Should write table conversion", async () => {
        const tableConversion = {
            0: {
                symbol: "ETH",
                price: 210.21,
                decimals: 18
            },
            1: {
                symbol: "DAI",
                price: 1,
                decimals: 18
            }
        };
        fs.writeFileSync(pathConversionTable, JSON.stringify(tableConversion));
    });

    it("Should initialize pool synchronizer", () => {
        synchPool = new SynchPool(
            pool,
            poolConfig.pathConversionTable,
            poolConfig.logLevel,
            poolConfig.timeouts);
        synchPool.synchLoop();
    });

    it("Should load table conversion into the pool", async () => {
        timeoutUpdate = synchPool.timeouts.NEXT_LOOP + timeoutDelay;
        // timeto synchronize '.json' file
        await timeout(timeoutUpdate);

        // Check pool conversion table and conversion table on file
        const poolTable = pool.conversion;
        const jsonTable = JSON.parse(fs.readFileSync(pathConversionTable));

        expect(_.isEqual(poolTable, jsonTable)).to.be.equal(true);
    });

    it("Should load again table conversion", async () => {
        const tableConversion = {
            0: {
                symbol: "TEST",
                price: 3.14,
                decimals: 15
            },
            1: {
                symbol: "ROLL",
                price: 1.75,
                decimals: 17
            }
        };
        fs.writeFileSync(pathConversionTable, JSON.stringify(tableConversion));
    });

    it("Should load table conversion into the pool", async () => {
        // timeto synchronize '.json' file
        await timeout(timeoutUpdate);

        // Check pool conversion table and conversion table on file
        const poolTable = pool.conversion;
        const jsonTable = JSON.parse(fs.readFileSync(pathConversionTable));

        expect(_.isEqual(poolTable, jsonTable)).to.be.equal(true);
    });
});