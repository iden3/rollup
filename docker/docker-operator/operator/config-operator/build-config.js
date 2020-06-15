const path = require("path");
const fs = require("fs");
const configSynchPath = path.join(__dirname, "./synch-config.json");

const configSynch = JSON.parse(fs.readFileSync(configSynchPath, "utf-8"));

configSynch.rollup.synchDb = "/leveldb-operator/tmp-0";
configSynch.rollup.treeDb = "/leveldb-operator/tmp-1";
configSynch.rollupPoB.synchDb = "/leveldb-operator/tmp-2";

fs.writeFileSync(configSynchPath, JSON.stringify(configSynch));