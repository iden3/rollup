const poseidon = require("circomlib").poseidon;
const utils = require("ffjavascript").utils;
const Scalar = require("ffjavascript").Scalar;

function string2Int(str) {
    return utils.leBuff2int(Buffer.from(str));
}

const hash = poseidon.createHash(1, 8, 57);

module.exports.DB_Master = hash([string2Int("Rollup_DB_Master")]);
module.exports.DB_Batch = hash([string2Int("Rollup_DB_Batch")]);
module.exports.DB_Idx = hash([string2Int("Rollup_DB_Idx")]);
module.exports.DB_AxAy = hash([string2Int("Rollup_DB_AxAy")]);
module.exports.DB_EthAddr = hash([string2Int("Rollup_DB_EthAddr")]);
module.exports.DB_TxPoolSlotsMap = hash([string2Int("Rollup_DB_TxPoolSlots")]);
module.exports.DB_TxPollTx = hash([string2Int("Rollup_DB_TxPollTx")]);
module.exports.DB_TxPoolDepositTx = hash([string2Int("Rollup_DB_TxPoolDepositTx")]);
module.exports.DB_NumBatch_Idx = hash([string2Int("Rollup_DB_NumBatch_Idx")]);
module.exports.DB_NumBatch_AxAy = hash([string2Int("Rollup_DB_NumBatch_AxAy")]);
module.exports.DB_NumBatch_EthAddr = hash([string2Int("Rollup_DB_NumBatch_EthAddr")]);
module.exports.DB_InitialIdx = hash([string2Int("Rollup_DB_Initial_Idx")]);

module.exports.exitAx = "0x0000000000000000000000000000000000000000000000000000000000000000";
module.exports.exitAy = "0x0000000000000000000000000000000000000000000000000000000000000000";
module.exports.exitEthAddr = "0x0000000000000000000000000000000000000000";
module.exports.exitAccount = Scalar.fromString(this.exitEthAddr, 16);

module.exports.fee = {
    "0%" :      0,
    "0.001%" :  1,
    "0.002%":   2,
    "0.005%":   3,
    "0.01%":    4,
    "0.02%":    5,
    "0.05%":    6,
    "0.1%":     7,
    "0.2%":     8,
    "0.5%":     9,
    "1%":       10,
    "2%":       11,
    "5%":       12,
    "10%":      13,
    "20%":      14,
    "50%" :     15,
};

module.exports.tableAdjustedFee = [ 
    0,
    42949,
    85899,
    214748,
    429496,
    858993,
    2147483,
    4294967,
    8589934,
    21474836,
    42949672,
    85899345,
    214748364,
    429496729,
    858993459,
    2147483648,
];
