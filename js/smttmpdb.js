const bigInt = require("snarkjs").bigInt;

/*

    This creates an in memory cached version of a tree

 */

class SMTTmpDb {
    constructor(srcDb) {
        this.srcDb = srcDb;
        this.inserts = {};
        this.deletes = {};
    }

    async getRoot() {
        if (typeof(this.root) == "undefined") {
            this.root = await this.srcDb.getRoot();
        }
        return this.root;
    }

    _key2str(k) {
        // const keyS = bigInt(key).leInt2Buff(32).toString("hex");
        const keyS = bigInt(k).toString();
        return keyS;
    }

    _normalize(n) {
        for (let i=0; i<n.length; i++) {
            n[i] = bigInt(n[i]);
        }
    }

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

    async multiGet(keys) {
        const promises = [];
        for (let i=0; i<keys.length; i++) {
            promises.push(this.get(keys[i]));
        }
        return await Promise.all(promises);
    }

    async setRoot(rt) {
        this.root = rt;
    }

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
