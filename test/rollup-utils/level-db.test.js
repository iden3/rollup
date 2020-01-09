/* eslint-disable no-await-in-loop */
const chai = require("chai");
const util = require("util");
const exec = util.promisify( require("child_process").exec);
const LevelDb = require("../../rollup-utils/level-db");

const { expect } = chai;

describe("level Db", () => {
    let dataBase;
    const pathDb = `${__dirname}/tmp-level`;

    after(async () => {
        await dataBase.close();
        await exec(`rm -rf ${pathDb}`);
    });

    it("Create database and fill it", async () => {
        dataBase = new LevelDb(pathDb, "testDb-");
        for (let i = 0; i < 10; i++) {
            const key = `key-${i}`;
            const value = `value-${i}`;
            await dataBase.insert(key, value);
        }
    });

    it("Get database values", async () => {
        // get
        for (let i = 0; i < 10; i++) {
            const key = `key-${i}`;
            const value = await dataBase.get(key);
            expect(value).to.be.equal(`value-${i}`);
        }
        // get or default
        const defaultRes = "default";
        for (let i = 0; i < 10; i++) {
            const key = `key-${i}`;
            const value = await dataBase.getOrDefault(key, defaultRes);
            expect(value).to.be.equal(`value-${i}`);
        }
        const keyNotExist = "notExist";
        const res = await dataBase.getOrDefault(keyNotExist, defaultRes);
        expect(res).to.be.equal(defaultRes);
    });

    it("delete value", async () => {
        const testKey = "testKey";
        const testValue = "testValue";
        await dataBase.insert(testKey, testValue);
        const getRes = await dataBase.get(testKey);
        expect(getRes).to.be.equal(testValue);
        await dataBase.delete(testKey);
        try {
            await dataBase.get(testKey);
        } catch (error) {
            expect((error.message).includes("Key not found in database")).to.be.equal(true);
        }
    });

    it("list keys", async () => {
        const keysList = await dataBase.listKeys("");
        for (let i = 0; i < 10; i++) {
            const key = `key-${i}`;
            expect(keysList[i]).to.be.equal(key);
        }
    });

    it("delete all values", async () => {
        await dataBase.deleteAll();
        for (let i = 0; i < 10; i++) {
            const key = `key-${i}`;
            try {
                await dataBase.get(key);
            } catch (error) {
                expect((error.message).includes("Key not found in database")).to.be.equal(true);
            }
        }
    });
});

describe("export and import database", () => {
    let dataBase;
    const pathDb = `${__dirname}/tmp-level`;

    after(async () => {
        await dataBase.close();
        await exec(`rm -rf ${pathDb}`);
    });

    it("Export and import database", async () => {
    // fill database
        dataBase = new LevelDb(pathDb, "testDb-");
        for (let i = 0; i < 10; i++) {
            const key = `key-${i}`;
            const value = `value-${i}`;
            await dataBase.insert(key, value);
        }

        // Export dataBase
        const dbExport = await dataBase.export();
        expect(dbExport).to.be.not.equal(undefined);
        // Import wallet
        // delete first all database
        await dataBase.deleteAll();
        // then import database
        await dataBase.import(dbExport);
        for (let i = 0; i < 10; i++) {
            const key = `key-${i}`;
            const value = `value-${i}`;
            const importValue = await dataBase.get(key);
            expect(importValue).to.be.equal(value);
        }
    });
});
