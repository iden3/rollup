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
    generalInfo["posSynch"] = {};
    generalInfo["rollupSynch"] = {};

    const staticDataPoS = await posSynch.getStaticData();
    const staticDataRollup = await rollupSynch.getStaticData();

    generalInfo.currentBlock = await posSynch.getCurrentBlock();

    // PoS
    generalInfo["posSynch"].isSynched = await posSynch.isSynched();
    generalInfo["posSynch"].synch = await posSynch.getSynchPercentage();
    generalInfo["posSynch"].lastEraSynch = await posSynch.getLastSynchEra();
    generalInfo["posSynch"].currentEra = await posSynch.getCurrentEra();
    generalInfo["posSynch"].currentSlot = await posSynch.getCurrentSlot();
    // Static Data
    generalInfo["posSynch"].contractAddress = staticDataPoS.contractAddress;
    generalInfo["posSynch"].blocksPerSlot = staticDataPoS.blocksPerSlot;
    generalInfo["posSynch"].slotsPerEra = staticDataPoS.slotsPerEra;
    generalInfo["posSynch"].slotDeadline = staticDataPoS.slotDeadline;
    generalInfo["posSynch"].genesisBlock = staticDataPoS.genesisBlock;
    generalInfo["posSynch"].minStake = staticDataPoS.minStake.toString();

    // Core
    generalInfo["rollupSynch"].isSynched = await rollupSynch.isSynched();
    generalInfo["rollupSynch"].synch = await rollupSynch.getSynchPercentage();
    generalInfo["rollupSynch"].lastBlockSynched = await rollupSynch.getLastSynchBlock();
    generalInfo["rollupSynch"].lastBatchSynched = await rollupSynch.getLastBatch();
    generalInfo["rollupSynch"].feeDeposit = (await rollupSynch.getFeeDepOffChain()).toString();
    generalInfo["rollupSynch"].feeOnChainTx = (await rollupSynch.getFeeOnChainTx()).toString();

    // StaticData
    generalInfo["rollupSynch"].contractAddress = staticDataRollup.contractAddress;
    generalInfo["rollupSynch"].maxTx = staticDataRollup.maxTx;
    generalInfo["rollupSynch"].maxOnChainTx = staticDataRollup.maxOnChainTx;
    generalInfo["rollupSynch"].nLevels = staticDataRollup.nLevels;


    return generalInfo;
}

/**
 * Get general information regarding operator state
 * @returns {Object} - operator general information
 */
async function getGeneralInfoPob(rollupSynch, pobSynch) {
    const generalInfo = {};
    generalInfo["pobSynch"] = {};
    generalInfo["rollupSynch"] = {};

    const staticDataPoB = await pobSynch.getStaticData();
    const staticDataRollup = await rollupSynch.getStaticData();

    generalInfo.currentBlock = await pobSynch.getCurrentBlock();

    // PoB
    generalInfo["pobSynch"].isSynched = await pobSynch.isSynched();
    generalInfo["pobSynch"].synch = await pobSynch.getSynchPercentage();
    generalInfo["pobSynch"].currentSlot = await pobSynch.getCurrentSlot();

    // Static Data
    generalInfo["pobSynch"].contractAddress = staticDataPoB.contractAddress;
    generalInfo["pobSynch"].blocksPerSlot = staticDataPoB.blocksPerSlot;
    generalInfo["pobSynch"].slotDeadline = staticDataPoB.slotDeadline;
    generalInfo["pobSynch"].genesisBlock = staticDataPoB.genesisBlock;
    generalInfo["pobSynch"].minBid = staticDataPoB.minBid.toString();

    // Core
    generalInfo["rollupSynch"].isSynched = await rollupSynch.isSynched();
    generalInfo["rollupSynch"].synch = await rollupSynch.getSynchPercentage();
    generalInfo["rollupSynch"].lastBlockSynched = await rollupSynch.getLastSynchBlock();
    generalInfo["rollupSynch"].lastBatchSynched = await rollupSynch.getLastBatch();
    generalInfo["rollupSynch"].feeDeposit = (await rollupSynch.getFeeDepOffChain()).toString();
    generalInfo["rollupSynch"].feeOnChainTx = (await rollupSynch.getFeeOnChainTx()).toString();

    // StaticData
    generalInfo["rollupSynch"].contractAddress = staticDataRollup.contractAddress;
    generalInfo["rollupSynch"].maxTx = staticDataRollup.maxTx;
    generalInfo["rollupSynch"].maxOnChainTx = staticDataRollup.maxOnChainTx;
    generalInfo["rollupSynch"].nLevels = staticDataRollup.nLevels;

    return generalInfo;
}

module.exports = {
    checkEnvVariables,
    checkPassEnv,
    getPassword,
    getGeneralInfo,
    getGeneralInfoPob
};
