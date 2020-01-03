/* global BigInt */
const chai = require("chai");
const util = require("util");
const exec = util.promisify( require("child_process").exec);
const SMT = require("circomlib").SMT;
const { SMTLevelDb } = require("../../rollup-utils/smt-leveldb");

const { expect } = chai;

describe("Smt level Db", () => {
    const pathDb = `${__dirname}/tmp-smt`;
    let smt;

    after(async () => {
        await exec(`rm -rf ${pathDb}`);
    });

    it("Create smt with levelDb database", async () => {
        const db = new SMTLevelDb(pathDb);
        const rt = await db.getRoot();
        smt = new SMT(db, rt);

        expect(smt.root.isZero()).to.be.equal(true);
    });

    it("test all smt functions", async () => {
        const key1 = BigInt(111);
        const value1 = BigInt(222);
        const key2 = BigInt(333);
        const value2 = BigInt(444);
        const value3 = BigInt(555);

        await smt.insert(key1, value1);
        await smt.insert(key2, value2);
        let resValue1 = await smt.find(key1);
        expect(resValue1.foundValue.toString()).to.be.equal(value1.toString());
        const resValue2 = await smt.find(key2);
        expect(resValue2.foundValue.toString()).to.be.equal(value2.toString());
        await smt.delete(key2);
        try {
            await smt.find(key2);
        } catch (error) {
            expect((error.message).includes("Key not found in database")).to.be.equal(true);
        }
        await smt.update(key1, value3);
        resValue1 = await smt.find(key1);
        expect(resValue1.foundValue.toString()).to.be.equal(value3.toString());
    });
});
