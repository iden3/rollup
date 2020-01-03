const Web3 = require("web3");
const crypto = require("crypto");
const stringRollup = "PoSMagic";

async function loadSeedHashChain(pk){
    const seed = pk + stringRollup;
    const hash = crypto.createHash("sha256");
    hash.update(seed);
    const seedHash = "0x" + hash.digest("hex");
    return seedHash;
}

async function register(rndHash, wallet, actualConfig, gasLimit, stakeValue, url) {
    try { 
        if (wallet.address == undefined || wallet.privateKey == undefined) throw new Error("No wallet");
        const web3 = new Web3(new Web3.providers.HttpProvider(actualConfig.nodeUrl));
        const rollupPoS = new web3.eth.Contract(actualConfig.posAbi, actualConfig.posAddress);
        const tx = {
            from:  wallet.address,
            to: actualConfig.posAddress,
            gasLimit: gasLimit,
            value: web3.utils.toHex(web3.utils.toWei(stakeValue.toString(), "ether")),
            data: rollupPoS.methods.addOperator(rndHash, url).encodeABI()
        };
        const txSign = await web3.eth.accounts.signTransaction(tx, wallet.privateKey);
        web3.eth.sendSignedTransaction(txSign.rawTransaction)
            .on("transactionHash", console.log)
            .on("error", console.error);
    } catch (err) {
        console.log(err);
    }
}

async function unregister(opId, wallet, actualConfig, gasLimit) {
    try {
        if (wallet.address == undefined || wallet.privateKey == undefined) throw new Error("No wallet");
        const web3 = new Web3(new Web3.providers.HttpProvider(actualConfig.nodeUrl));
        const rollupPoS = new web3.eth.Contract(actualConfig.posAbi, actualConfig.posAddress);
        const tx = {
            from:  wallet.address,
            to: actualConfig.posAddress,
            gasLimit: gasLimit,
            data: rollupPoS.methods.removeOperator(opId.toString()).encodeABI()
        };
        const txSign = await web3.eth.accounts.signTransaction(tx, wallet.privateKey);
        web3.eth.sendSignedTransaction(txSign.rawTransaction)
            .on("transactionHash", console.log)
            .on("error", console.error);
    } catch (err) {
        console.log(err);
    }
    
}

async function withdraw(opId, wallet, actualConfig, gasLimit) {
    try {
        if (wallet.address == undefined || wallet.privateKey == undefined) throw new Error("No wallet");
        const web3 = new Web3(new Web3.providers.HttpProvider(actualConfig.nodeUrl));
        const rollupPoS = new web3.eth.Contract(actualConfig.posAbi, actualConfig.posAddress);
        const tx = {
            from:  wallet.address,
            to: actualConfig.posAddress,
            gasLimit: gasLimit,
            data: rollupPoS.methods.withdraw(opId.toString()).encodeABI()
        };
        const txSign = await web3.eth.accounts.signTransaction(tx, wallet.privateKey);
        web3.eth.sendSignedTransaction(txSign.rawTransaction)
            .on("transactionHash", console.log)
            .on("error", console.error);
    } catch (err) {
        console.log(err);
    }
}

async function getEtherBalance(wallet, actualConfig) {
    const web3 = new Web3(new Web3.providers.HttpProvider(actualConfig.nodeUrl));
    let balance = await web3.eth.getBalance(wallet.address);
    balance = web3.utils.fromWei(balance, "ether");
    return Number(balance);
}

module.exports = {
    loadSeedHashChain,
    register,
    unregister,
    withdraw,
    getEtherBalance,
};