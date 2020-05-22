const path = require("path");
const fs = require("fs");
const configSynchPath = path.join(__dirname, "./synch-config.json");
const configPath = path.join(__dirname, "./config.json");
const customPath = path.join(__dirname, "./custom.json");

const configSynch = JSON.parse(fs.readFileSync(configSynchPath, "utf-8"));

const config = {
    pathDb: "/leveldb-synch-pool/tmp-0",
    ethNodeUrl: configSynch.ethNodeUrl,    
    ethAddress: configSynch.ethAddress,
    rollupAddress: configSynch.rollup.address,
    rollupAbi: configSynch.rollup.abi,
    logLevel: process.env.LOG_LEVEL,
    pathConversionTable: path.join(__dirname, "../table-conversion/table-conversion.json"),
    pathCustomTokens: customPath,
    timeouts: {"ERROR":6000, "NEXT_LOOP":60000}
};

fs.writeFileSync(configPath, JSON.stringify(config));