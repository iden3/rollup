/* eslint-disable no-return-await */
/* eslint-disable no-await-in-loop */
const { stringifyBigInts, unstringifyBigInts } = require("ffjavascript").utils;
const Scalar = require("ffjavascript").Scalar;
const { SMT, babyJub } = require("circomlib");
const F = babyJub.F;

const LevelDb = require("./level-db");

/**
 * Interface for sparse-merkle-tree with levelDb databse
 */
class SMTLevelDb {
    /**
     * Initilize SMT levelDb class
     * @param {String} pathDb - database path 
     * @param {String} prefix - prefix to store [key - value] 
     */
    constructor(pathDb, prefix) {
        this.db = new LevelDb(pathDb, prefix);
    }

    /**
     * Get smt root
     * @returns {BigInt} - root
     */
    async getRoot() {
        const value = await this.db.getOrDefault("smt-root", this._toString(Scalar.e(0)));
        return this._fromString(value);
    }

    /**
     * Set new root
     * @param {BigInt} rt - root to store 
     */
    async setRoot(rt) {
        await this.db.insert("smt-root", this._toString(rt));
    }

    /**
     * Convert to string
     * normally used in order to add it to database
     * @param {Any} - any input parameter
     * @returns {String}
     */
    _toString(val) {
        return JSON.stringify(stringifyBigInts(val));
    }

    /**
     * Get from string
     * normally used ti get from database
     * @param {String} - string to parse
     * @returns {Any} 
     */
    _fromString(val) {
        return unstringifyBigInts(JSON.parse(val));
    }

    /**
     * Converts key to string
     * @param {BigInt} k - key
     * @returns {String}
     */
    _key2str(k) {
        const keyS = Scalar.e(k).toString();
        return keyS;
    }

    /**
     * Normalize numbers to BigInts
     * @param {Array} n 
     */
    _normalize(n) {
        for (let i = 0; i < n.length; i++) {
            n[i] = F.e(n[i]);
        }
    }

    /**
     * Get value given its key
     * @param {BigInt} key 
     * @returns {Any | undefined} - value, returns undefined if not found
     */
    async get(key) {
        const keyS = this._key2str(key);
        const value = await this.db.getOrDefault(keyS, undefined);
        if (value)
            return this._fromString(value);
        return undefined;
    }

    /**
     * Get multiples values
     * @param {Array} keys 
     * @returns {Array} - values
     */
    async multiGet(keys) {
        const promises = [];
        for (let i=0; i<keys.length; i++) {
            promises.push(this.get(keys[i]));
        }
        return await Promise.all(promises);
    }

    /**
     * Insert multiple [key - value] pairs
     * @param {Array} inserts - array of [key - value]  
     */

    async multiIns(inserts) {
        for (let i = 0; i < inserts.length; i++) {
            const keyS = this._key2str(inserts[i][0]);
            this._normalize(inserts[i][1]);
            const valueS = this._toString(inserts[i][1]);
            await this.db.insert(keyS, valueS);
        }
    }

    /**
     * Deletes multiple key
     * @param {Array} dels - keys to delete 
     */
    async multiDel(dels) {
        for (let i = 0; i < dels.length; i++) {
            const keyS = this._key2str(dels[i]);
            await this.db.delete(keyS);
        }
    }
}

/**
 * Creates new smt-levelb class
 * @param {String} pathDb - database path
 * @param {String} prefix - database pefix
 * @returns {SMTLevelDb} - Smt level-db class
 */
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
