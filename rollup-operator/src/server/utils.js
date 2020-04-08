const readline = require("readline");
const { Writable } = require("stream");

/**
 * Check environment variables
 * @returns {Bool} - true if some variables is not found, false otherwise
 */
function checkEnvVariables(){
    if (!process.env.CONFIG_SYNCH || 
        !process.env.CONFIG_POOL ||
        !process.env.OPERATOR_PORT_EXTERNAL ||
        !process.env.URL_SERVER_PROOF 
    ) {
        return true;
    }
    else return false;
}

/**
 * Check password environment variable
 * @returns {Bool} - true if password variable is not found, false otherwise
 */
function checkPassEnv(){
    if (!process.env.PASSWORD) return true;
    return false;
}

/**
 * Ask password on console
 * @returns {String} - user input
 */
function getPassword() {
    return new Promise((resolve) => {
        const mutableStdout = new Writable({
            write(chunk, encoding, callback) {
                if (!this.muted) {
                    process.stdout.write(chunk, encoding);
                }
                callback();
            },
        });
        const rl = readline.createInterface({
            input: process.stdin,
            output: mutableStdout,
            terminal: true,
        });
        rl.question("Password: ", (password) => {
            rl.close();
            console.log("");
            resolve(password);
        });
        mutableStdout.muted = true;
    });
}

/**
 * Get general information regarding operator state
 * @returns {Object} - operator general information
 */
async function getGeneralInfo(rollupSynch, posSynch) {
    const generalInfo = {};
    generalInfo["pos"] = {};
    generalInfo["rollup"] = {};

    const staticDataPoS = await posSynch.getStaticData();
    const staticDataRollup = await rollupSynch.getStaticData();

    generalInfo.currentBlock = await posSynch.getCurrentBlock();

    generalInfo["pos"].isSynched = await posSynch.isSynched();
    generalInfo["pos"].synch = await posSynch.getSynchPercentage();
    generalInfo["pos"].lastEraSynch = await posSynch.getLastSynchEra();
    generalInfo["pos"].currentEra = await posSynch.getCurrentEra();
    generalInfo["pos"].currentSlot = await posSynch.getCurrentSlot();
    // Static data
    generalInfo["pos"].contractAddress = staticDataPoS.contractAddress;
    generalInfo["pos"].blocksPerSlot = staticDataPoS.blocksPerSlot;
    generalInfo["pos"].slotsPerEra = staticDataPoS.slotsPerEra;
    generalInfo["pos"].slotDeadline = staticDataPoS.slotDeadline;
    generalInfo["pos"].genesisBlock = staticDataPoS.genesisBlock;
    generalInfo["pos"].minStake = staticDataPoS.minStake.toString();

    generalInfo["rollup"].isSynched = await rollupSynch.isSynched();
    generalInfo["rollup"].synch = await rollupSynch.getSynchPercentage();
    generalInfo["rollup"].lastBlockSynched = await rollupSynch.getLastSynchBlock();
    generalInfo["rollup"].lastBatchSynched = await rollupSynch.getLastBatch();
    // Statid data
    generalInfo["rollup"].contractAddress = staticDataRollup.contractAddress;
    generalInfo["rollup"].maxTx = staticDataRollup.maxTx;
    generalInfo["rollup"].maxOnChainTx = staticDataRollup.maxOnChainTx;
    generalInfo["rollup"].feeOnChainTx = staticDataRollup.feeOnChainTx.toString();
    generalInfo["rollup"].nLevels = staticDataRollup.nLevels;

    return generalInfo;
}

module.exports = {
    checkEnvVariables,
    checkPassEnv,
    getPassword,
    getGeneralInfo,
};
