
const dotenv = require("dotenv");
const Synchronizer = require("../synchronizer/synch");
const LevelDb = require("../../../rollup-utils/level-db");
const { newLevelDbRollupTree } = require("../../../rollup-utils/rollup-tree");
dotenv.config();

const fs = require("fs");

// Global vars
let operatorConfig;
let rollupTree;
let synchDb;
let ethAddress;
// load operator configuration file
if (process.env.PATH_CONFIG_JSON) {
    operatorConfig = JSON.parse(fs.readFileSync(process.env.PATH_CONFIG_JSON, "utf8"));
} else {
    operatorConfig = JSON.parse(fs.readFileSync("./operator-config.json", "utf8"));
}

async function loadDb(operatorConfig) {
    rollupTree = await newLevelDbRollupTree(operatorConfig.TREE_DB);    
    synchDb = new LevelDb(operatorConfig.SYNCH_DB);
}

// load data bases
loadDb(operatorConfig);

// start synchronizer loop
const SynchServer = new Synchronizer(synchDb, rollupTree, operatorConfig.ETH_NODE_URL,
    operatorConfig.ROLLUP_ADDRESS, operatorConfig.CREATION_HASH, operatorConfig.ETH_ADDRESS ); 
SynchServer.synchLoop();
