const SMTMemDB = require("circomlib/src/smt_memdb");
const RollupDB = require("../../../js/rollupdb" );

let rollupDB = await RollupDB(new SMTMemDB());
