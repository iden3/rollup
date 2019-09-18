/* eslint-disable no-await-in-loop */
/* eslint-disable no-return-await */
const level = require("level");

/**
 * Database interface for level db file
 */
class LeveldB {
    /**
   * @param {Bool} prefix - Database prefix 'i3db-' added to key values
   * @param {String} pathDb - Database location
   */

    constructor(pathDb, prefix = "") {
        this.prefix = prefix;
        this.db = level(pathDb);
    }

    /**
   * Method to store [key - value] on database
   * @param {String} key
   * @param {String} value
   */
    async insert(key, value) {
        await this.db.put(this.prefix + key, value);
    }

    /**
   * Method to retrieve a value given a key
   * @param {String} key
   * @returns {String}
   */
    async get(key) {
        return await this.db.get(this.prefix + key);
    }

    /**
   * Method to retrieve a value given a key if it exist
   * otherwise return default value
   * @param {String} key
   * @param {Any} defaultElem
   * @returns {String | Any}
   */
    async getOrDefault(key, defaultElem) {
        try {
            const res = await this.get(key);
            return res;
        } catch(err) {
            if (err.notFound) {
                return defaultElem;
            }
            throw err; 
        }
    }


    /**
   * Method to delete a value given a key
   * @param {String} key
   */
    async delete(key) {
        await this.db.del(this.prefix + key);
    }

    /**
   * Method to close database
   */
    async close() {
        await this.db.close();
    }

    /**
   * Method to delete all the [key - value] items
   */
    async deleteAll() {
        const keysList = await this.listKeys("");
        for (let i = 0; i < keysList.length; i++) {
            await this.delete(keysList[i]);
        }
    }

    /**
   * Get all keys of the database
   * @returns {Array} Contains all the keys found
   */
    async listKeys(prefix = "") {
        const keysList = [];
        const self = this;
        const subprefix = prefix;
        await new Promise((resolve, reject) => {
            self.db.createKeyStream()
                .on("data", (data) => {
                    if (data.indexOf(self.prefix + subprefix) !== -1) {
                        keysList.push(data.replace(self.prefix, ""));
                    }
                })
                .on("error", (err) => {
                    reject(err);
                })
                .on("close", () => {
                    resolve(keysList);
                });
        });
        return keysList;
    }

    /**
   * Gets all the memory data and packs it into a string
   * @returns {String} - packed data
   */
    async export() {
        const dbExp = {};
        const keysList = await this.listKeys("");
        for (let i = 0; i < keysList.length; i++) {
            dbExp[keysList[i]] = await this.get(keysList[i]);
        }
        const dbExpStr = JSON.stringify(dbExp);
        return dbExpStr;
    }

    /**
   * Saves packed data into database
   * @param {String} dbExpStr - packed data
   * @returns {Bool} - If no error returns true
   */
    async import(dbExpStr) {
        try {
            const dbExp = JSON.parse(dbExpStr);
            Object.keys(dbExp).forEach(async (key) => {
                await this.insert(key, dbExp[key]);
            });
        } catch (error) {
            throw new Error("can not import the database");
        }
    }
}

module.exports = LeveldB;
