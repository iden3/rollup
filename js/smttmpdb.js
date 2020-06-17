const Scalar = require("ffjavascript").Scalar;

/*
    This creates an in memory cached version of a tree
 */

class SMTTmpDb {
    constructor(srcDb) {
        this.srcDb = srcDb;
        this.inserts = {};
        this.deletes = {};
    }

    /**
     * Get the DDBB root
     * @returns {Scalar} DDBB root
     */
    async getRoot() {
        if (typeof(this.root) == "undefined") {
            this.root = await this.srcDb.getRoot();
        }
        return this.root;
    }

    /**
     * Convert a key into a String
     * @param {Scalar} k - Key in Scalar format
     * @returns {String} key in String format
     */
    _key2str(k) {
        // const keyS = bigInt(key).leInt2Buff(32).toString("hex");
        const keyS = Scalar.e(k).toString();
        return keyS;
    }

    /**
     * Convert all the values of the array n into Scalars
     * @param {Array} n - Array of inserts
     */
    _normalize(n) {
        for (let i=0; i<n.length; i++) {
            n[i] = Scalar.e(n[i]);
        }
    }

    /**
     * Get the value of some key
     * @param {Array} key - Key
     * @returns {Promise} Promise that will resolve on the corresponding key-value
     */
    async get(key) {
        const keyS = this._key2str(key);
        if (this.inserts[keyS]) {
            return this.inserts[keyS];
        } else if (this.deletes[keyS]) {
            return null;
        } else {
            return await this.srcDb.get(key);
        }
    }

    /**
     * Get the value of all the keys contained in the keys array
     * @param {Array} keys - Array of keys
     * @returns {Array} Array of promises  that will resolve on the corresponding key-value
     */
    async multiGet(keys) {
        const promises = [];
        for (let i=0; i<keys.length; i++) {
            promises.push(this.get(keys[i]));
        }
        return await Promise.all(promises);
    }

    /**
     * Set the current root
     * @param {Scalar} rt - Merkle tree root
     */
    async setRoot(rt) {
        this.root = rt;
    }

    /**
     * Insert all the keys in the inserts array
     * @param {Array} inserts - Array of keys
     */
    async multiIns(inserts) {
        for (let i=0; i<inserts.length; i++) {
            const keyS = this._key2str(inserts[i][0]);
            this._normalize(inserts[i][1]);
            if (this.deletes[keyS]) {
                delete this.deletes[keyS];
            }
            this.inserts[keyS] = inserts[i][1];
        }
    }

    /**
     * Delete all the keys in the dels Array
     * @param {Array} dels - Array of keys
     */
    async multiDel(dels) {
        for (let i=0; i<dels.length; i++) {
            const keyS = this._key2str(dels[i]);
            if (this.inserts[keyS]) {
                delete this.inserts[keyS];
            }
            this.deletes[keyS] = true;
        }
    }
}

module.exports = SMTTmpDb;
