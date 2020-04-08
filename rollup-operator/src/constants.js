const poseidon = require("circomlib").poseidon;
const bigInt = require("snarkjs").bigInt;

function string2Int(str) {
    Buffer.from(str);
    return bigInt.beBuff2int(Buffer.from(str));
}
const hash = poseidon.createHash(1, 8, 57);



/**
 * List of keys to use in Db synch
 */
module.exports.db_synch_batch = hash([string2Int("db_synch_batch")]);

/**
 * Operator modes
 */
const mode = {
    light: 0,
    full: 1,
    archive: 2,
};

module.exports.mode = mode;