/* eslint-disable no-return-await */
/* eslint-disable no-await-in-loop */
/* global BigInt */
const { stringifyBigInts, unstringifyBigInts } = require("snarkjs");
const { SMT } = require("circomlib");
const LevelDb = require("./level-db");

class SMTLevelDb {
    constructor(pathDb, prefix) {
        this.db = new LevelDb(pathDb, prefix);
    }

    async getRoot() {
        const value = await this.db.getOrDefault("smt-root", this._toString(BigInt(0)));
        return this._fromString(value);
    }

    async setRoot(rt) {
        await this.db.insert("smt-root", this._toString(rt));
    }

    _toString(val) {
        return JSON.stringify(stringifyBigInts(val));
    }

    _fromString(val) {
        return unstringifyBigInts(JSON.parse(val));
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
        const value = await this.db.getOrDefault(keyS, undefined);
        if (value)
            return this._fromString(value);
        return undefined;
    }

    async multiGet(keys) {
        const promises = [];
        for (let i=0; i<keys.length; i++) {
            promises.push(this.get(keys[i]));
        }
        return await Promise.all(promises);
    }

    async multiIns(inserts) {
        for (let i = 0; i < inserts.length; i++) {
            const keyS = this._key2str(inserts[i][0]);
            this._normalize(inserts[i][1]);
            const valueS = this._toString(inserts[i][1]);
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
    SMTLevelDb
};
