/**
 * Database interface for memory allocation
 */
class MemorydB {
    /**
   * @param {Bool} prefix - Database prefix 'i3db-' added to key values
   */
    constructor() {
        this.prefix = 'db-';
        this.db = new Map();
    }

    /**
   * new database from object
   * @param {Object} dbObj - database as object representation
   * @return {Object} - MemorydB class object
   */
    static newFromObj(dbObj) {
        const db = new MemorydB();
        Object.keys(dbObj).forEach((key) => {
            db.insert(key.replace(db.prefix, ''), dbObj[key]);
        });
        return db;
    }

    /**
   * Method to store [key - value] on database
   * @param {String} key
   * @param {String} value
   */
    insert(key, value) {
        this.db.set(this.prefix + key, value);
    }

    /**
   * Method to retrieve a value given a key
   * @param {String} key
   * @returns {String}
   */
    get(key) {
        const value = this.db.get(this.prefix + key);
        if (value === undefined) { return null; }
        return value;
    }

    /**
   * Method to retrieve a value given a key
   * @param {String} key
   * @returns {String}
   */
    listKeys(prefix) {
        const keyList = [];
        this.db.forEach((value, key) => {
            if (key.indexOf(this.prefix + prefix) !== -1) {
                keyList.push(key.replace(this.prefix, ''));
            }
        });
        return keyList;
    }

    /**
   * Method to delete a value given a key
   * @param {String} key
   */
    delete(key) {
        this.db.delete(this.prefix + key);
    }

    /**
   * Method to delete all the [key - value] items
   */
    deleteAll() {
        this.db.clear();
    }

    /**
   * export MemoryDb into an object
   * @return {Object} - Database as object representation
   */
    exportObj() {
        const obj = {};
        this.db.forEach((value, key) => {
            obj[key] = value;
        });
        return obj;
    }
}

module.exports = MemorydB;
