const { expect } = require("chai");
const util = require("util");
const exec = util.promisify( require("child_process").exec);
const SMT = require("circomlib").SMT;
const Scalar = require("ffjavascript").Scalar;

const { SMTLevelDb } = require("../../rollup-utils/smt-leveldb");

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

        expect(Scalar.isZero(smt.root)).to.be.equal(true);
    });

    it("test all smt functions", async () => {
        const key1 = Scalar.e(111);
        const value1 = Scalar.e(222);
        const key2 = Scalar.e(333);
        const value2 = Scalar.e(444);
        const value3 = Scalar.e(555);

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
