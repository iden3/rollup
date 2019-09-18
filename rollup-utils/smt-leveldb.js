/* eslint-disable no-return-await */
/* eslint-disable no-await-in-loop */
/* global BigInt */
const { stringifyBigInts, unstringifyBigInts } = require("snarkjs");
const { SMT } = require("circomlib");
const LevelDb = require("./level-db");

class SMTLevelDb {
    constructor(pathDb, prefix) {
        this.db = new LevelDb(pathDb, prefix);
        this.db.insert("smt-root", BigInt(0));
    }

    async getRoot() {
        return BigInt(await this.db.get("smt-root"));
    }

    async setRoot(rt) {
        await this.db.insert("smt-root", rt);
    }

    _key2str(k) {
        const keyS = BigInt(k).toString();
        return keyS;
    }

    _normalize(n) {
        for (let i = 0; i < n.length; i++) {
            n[i] = BigInt(n[i]);
        }
    }

    async get(key) {
        const keyS = this._key2str(key);
        const value = await this.db.get(keyS);
        return unstringifyBigInts(JSON.parse(value));
    }

    async multiIns(inserts) {
        for (let i = 0; i < inserts.length; i++) {
            const keyS = this._key2str(inserts[i][0]);
            this._normalize(inserts[i][1]);
            const valueS = JSON.stringify(stringifyBigInts(inserts[i][1]));
            await this.db.insert(keyS, valueS);
        }
    }

    async multiDel(dels) {
        for (let i = 0; i < dels.length; i++) {
            const keyS = this._key2str(dels[i]);
            await this.db.delete(keyS);
        }
    }
}

async function newLevelDbEmptyTree(pathDb, prefix) {
    const db = new SMTLevelDb(pathDb, prefix);
    const rt = await db.getRoot();
    const smtLevelDb = new SMT(db, rt);
    return smtLevelDb;
}

module.exports = {
    newLevelDbEmptyTree,
};
