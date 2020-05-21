const poseidon = require("circomlib").poseidon;
const utils = require("ffjavascript").utils;

function string2Int(str) {
    return utils.leBuff2int(Buffer.from(str));
}
const hash = poseidon.createHash(1, 8, 57);

/**
 * List of keys to use in synchronizer database
 */
const DB_SYNCH_BATCH_INFO = hash([string2Int("DB_SYNCH_BATCH_INFO")]);

/**
 * Operator modes
 */
const mode = {
    light: 0,
    full: 1,
    archive: 2,
};

module.exports = {
    mode,
    DB_SYNCH_BATCH_INFO,
};