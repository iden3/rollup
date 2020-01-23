/* global BigInt */
const Web3 = require("web3");

async function register(rndHash, wallet, actualConfig, gasLimit, gasMultiplier, stakeValue, url) {
    const web3 = new Web3(new Web3.providers.HttpProvider(actualConfig.nodeUrl));
    const rollupPoS = new web3.eth.Contract(actualConfig.posAbi, actualConfig.posAddress);
    const tx = {
        from:  wallet.address,
        to: actualConfig.posAddress,
        gasLimit: gasLimit,
        gasPrice: await _getGasPrice(gasMultiplier, web3),
        value: web3.utils.toHex(web3.utils.toWei(stakeValue.toString(), "ether")),
        data: rollupPoS.methods.addOperator(rndHash, url).encodeABI()
    };
    return await web3.eth.accounts.signTransaction(tx, wallet.privateKey);
}

async function registerWithDifferentBeneficiary(rndHash, wallet, actualConfig, gasLimit, gasMultiplier, stakeValue, url, beneficiaryAddress) {
    const web3 = new Web3(new Web3.providers.HttpProvider(actualConfig.nodeUrl));
    const rollupPoS = new web3.eth.Contract(actualConfig.posAbi, actualConfig.posAddress);
    const tx = {
        from:  wallet.address,
        to: actualConfig.posAddress,
        gasLimit: gasLimit,
        gasPrice: await _getGasPrice(gasMultiplier, web3),
        value: web3.utils.toHex(web3.utils.toWei(stakeValue.toString(), "ether")),
        data: rollupPoS.methods.addOperatorWithDifferentBeneficiary(beneficiaryAddress, rndHash, url).encodeABI()
    };
    return await web3.eth.accounts.signTransaction(tx, wallet.privateKey);
}

async function registerRelay(rndHash, wallet, actualConfig, gasLimit, gasMultiplier, stakeValue, url, beneficiaryAddress, controllerAddress) {
    const web3 = new Web3(new Web3.providers.HttpProvider(actualConfig.nodeUrl));
    const rollupPoS = new web3.eth.Contract(actualConfig.posAbi, actualConfig.posAddress);
    const tx = {
        from:  wallet.address,
        to: actualConfig.posAddress,
        gasLimit: gasLimit,
        gasPrice: await _getGasPrice(gasMultiplier, web3),
        value: web3.utils.toHex(web3.utils.toWei(stakeValue.toString(), "ether")),
        data: rollupPoS.methods.addOperatorRelay(controllerAddress, beneficiaryAddress, rndHash, url).encodeABI()
    };
    return await web3.eth.accounts.signTransaction(tx, wallet.privateKey);
}

async function unregister(opId, wallet, actualConfig, gasLimit, gasMultiplier) {
    const web3 = new Web3(new Web3.providers.HttpProvider(actualConfig.nodeUrl));
    const rollupPoS = new web3.eth.Contract(actualConfig.posAbi, actualConfig.posAddress);
    const tx = {
        from:  wallet.address,
        to: actualConfig.posAddress,
        gasLimit: gasLimit,
        gasPrice: await _getGasPrice(gasMultiplier, web3),
        data: rollupPoS.methods.removeOperator(opId.toString()).encodeABI()
    };
    return await web3.eth.accounts.signTransaction(tx, wallet.privateKey);
}

async function withdraw(opId, wallet, actualConfig, gasLimit, gasMultiplier) {
    const web3 = new Web3(new Web3.providers.HttpProvider(actualConfig.nodeUrl));
    const rollupPoS = new web3.eth.Contract(actualConfig.posAbi, actualConfig.posAddress);
    const tx = {
        from:  wallet.address,
        to: actualConfig.posAddress,
        gasLimit: gasLimit,
        gasPrice: await _getGasPrice(gasMultiplier, web3),
        data: rollupPoS.methods.withdraw(opId.toString()).encodeABI()
    };
    return await web3.eth.accounts.signTransaction(tx, wallet.privateKey);
}

async function getEtherBalance(wallet, actualConfig) {
    const web3 = new Web3(new Web3.providers.HttpProvider(actualConfig.nodeUrl));
    let balance = await web3.eth.getBalance(wallet.address);
    balance = web3.utils.fromWei(balance, "ether");
    return Number(balance);
}

async function _getGasPrice(multiplier, web3){
    const strAvgGas = await web3.eth.getGasPrice();
    const avgGas = BigInt(strAvgGas);
    return (avgGas * BigInt(multiplier)).toString();
}

module.exports = {
    register,
    registerWithDifferentBeneficiary,
    registerRelay,
    unregister,
    withdraw,
    getEtherBalance,
};