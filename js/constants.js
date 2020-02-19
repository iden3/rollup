const poseidon = require("circomlib").poseidon;
const bigInt = require("snarkjs").bigInt;

function string2Int(str) {
    Buffer.from(str);
    return bigInt.beBuff2int(Buffer.from(str));
}

const hash = poseidon.createHash(1, 8, 57);

module.exports.DB_Master=hash([string2Int("Rollup_DB_Master")]);
module.exports.DB_Batch=hash([string2Int("Rollup_DB_Batch")]);
module.exports.DB_Idx=hash([string2Int("Rollup_DB_Idx")]);
module.exports.DB_AxAy=hash([string2Int("Rollup_DB_AxAy")]);
module.exports.DB_EthAddr=hash([string2Int("Rollup_DB_EthAddr")]);
module.exports.DB_TxPoolSlotsMap=hash([string2Int("Rollup_DB_TxPoolSlots")]);
module.exports.DB_TxPollTx=hash([string2Int("Rollup_DB_TxPollTx")]);
module.exports.DB_NumBatch_Idx=hash([string2Int("Rollup_DB_NumBatch_Idx")]);
module.exports.DB_NumBatch_AxAy=hash([string2Int("Rollup_DB_NumBatch_AxAy")]);
module.exports.DB_NumBatch_EthAddr=hash([string2Int("Rollup_DB_NumBatch_EthAddr")]);
