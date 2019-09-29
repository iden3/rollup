/**
 * Database interface for memory allocation
 */
class MemorydB {
    constructor() {
        this.db = new Map();
    }

    /**
   * Method to store [key - value] on database
   * @param {String} key
   * @param {String} value
   */
    insert(key, value) {
        this.db.set(key, value);
    }

    /**
   * Method to retrieve a value given a key
   * @param {String} key
   * @returns {String}
   */
    get(key) {
        const value = this.db.get(key);
        if (value === undefined) { return null; }
        return value;
    }

    /**
   * Method to retrieve a value given a key if it exist
   * otherwise return default value
   * @param {String} key
   * @param {Any} defaultElem
   * @returns {String | Any}
   */
    getOrDefault(key, defaultElem) {
        const res = this.get(key);
        if (res == null) return defaultElem;
        return res;
    }

    /**
   * Method to retrieve a value given a key
   * @param {String} key
   * @returns {String}
   */
    listKeys(prefix) {
        const keyList = [];
        this.db.forEach((value, key) => {
            if (key.indexOf(prefix) !== -1) {
                keyList.push(key);
            }
        });
        return keyList;
    }

    /**
   * Method to delete a value given a key
   * @param {String} key
   */
    delete(key) {
        this.db.delete(key);
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
    export() {
        const obj = {};
        this.db.forEach((value, key) => {
            obj[key] = value;
        });
        return obj;
    }

    /**
   * new database from object
   * @param {Object} dbObj - database as object representation
   * @return {Object} - MemorydB class object
   */
    import(dbObj) {
        Object.keys(dbObj).forEach((key) => {
            this.insert(key, dbObj[key]);
        });
    }
}

module.exports = MemorydB;
