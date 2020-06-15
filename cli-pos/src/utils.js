const Web3 = require('web3');
const { Scalar } = require('ffjavascript');

/**
 * Get ether balance of a given wallet
 * @param {Object} wallet - wallet json object
 * @param {Object} actualConfig - client configuration
 * @returns {Number} - balance in ethers
 */
async function getEtherBalance(wallet, actualConfig) {
    const web3 = new Web3(new Web3.providers.HttpProvider(actualConfig.nodeUrl));
    let balance = await web3.eth.getBalance(wallet.address);
    balance = web3.utils.fromWei(balance, 'ether');
    return Number(balance);
}

/**
 * Function to get gas price given a multiplier
 * Gets current web3 gas price and multiplies it given 'multiplier' parameter
 * @param {Number} multiplier - gas multiplier
 * @param {Object} web3 - web3 object
 * @returns {String} - BigInt enconded as string
 */
async function _getGasPrice(multiplier, web3) {
    const strAvgGas = await web3.eth.getGasPrice();
    const avgGas = Scalar.e(strAvgGas);
    return Scalar.mul(avgGas, multiplier).toString();
}

/**
 * Registers operator on Rollup PoS
 * @param {String} rndHash - hash encoded as an hexadecimal string
 * @param {Object} wallet - wallet json object
 * @param {Object} actualConfig - client configuration
 * @param {Number} gasLimit - gas limit
 * @param {Number} gasMul - gas nultiplier
 * @param {Number} stakeValue - Value to stake in ether units
 * @param {String} url - Operator Url to publish
 * @returns {Object} - signed transaction
 */
async function register(rndHash, wallet, actualConfig, gasLimit, gasMul, stakeValue, url) {
    const web3 = new Web3(new Web3.providers.HttpProvider(actualConfig.nodeUrl));
    const rollupPoS = new web3.eth.Contract(actualConfig.posAbi, actualConfig.posAddress);
    const tx = {
        from: wallet.address,
        to: actualConfig.posAddress,
        gasLimit,
        gasPrice: await _getGasPrice(gasMul, web3),
        value: web3.utils.toHex(web3.utils.toWei(stakeValue.toString(), 'ether')),
        data: rollupPoS.methods.addOperator(rndHash, url).encodeABI(),
    };
    const signedTx = await web3.eth.accounts.signTransaction(tx, wallet.privateKey);
    return signedTx;
}

/**
 * Register operator on RollupPoS
 * Sets different beneficiary address to receive operator earnings
 * @param {String} rndHash - hash encoded as an hexadecimal string
 * @param {Object} wallet - wallet json object
 * @param {Object} actualConfig - client configuration
 * @param {Number} gasLimit - gas limit
 * @param {Number} gasMul - gas nultiplier
 * @param {Number} stakeValue - Value to stake in ether units
 * @param {String} url - Operator Url to publish
 * @param {Sring} beneficiaryAddress - ethereum address
 * @returns {Object} - signed transaction
 */
async function registerWithDifferentBeneficiary(rndHash, wallet, actualConfig, gasLimit, gasMul, stakeValue, url, beneficiaryAddress) {
    const web3 = new Web3(new Web3.providers.HttpProvider(actualConfig.nodeUrl));
    const rollupPoS = new web3.eth.Contract(actualConfig.posAbi, actualConfig.posAddress);
    const tx = {
        from: wallet.address,
        to: actualConfig.posAddress,
        gasLimit,
        gasPrice: await _getGasPrice(gasMul, web3),
        value: web3.utils.toHex(web3.utils.toWei(stakeValue.toString(), 'ether')),
        data: rollupPoS.methods.addOperatorWithDifferentBeneficiary(beneficiaryAddress, rndHash, url).encodeABI(),
    };
    const signedTx = await web3.eth.accounts.signTransaction(tx, wallet.privateKey);
    return signedTx;
}

/**
 * Register operator on RollupPoS
 * Sets different beneficiary address to receive operator earnings
 * Sets different controller address to perform 'remove and 'commit/forge' data
 * @param {String} rndHash - hash encoded as an hexadecimal string
 * @param {Object} wallet - wallet json object
 * @param {Object} actualConfig - client configuration
 * @param {Number} gasLimit - gas limit
 * @param {Number} gasMul - gas nultiplier
 * @param {Number} stakeValue - Value to stake in ether units
 * @param {String} url - Operator Url to publish
 * @param {String} beneficiaryAddress - ethereum address
 * @param {String} controllerAddress - ethreum address
 * @returns {Object} - signed transaction
 */
async function registerRelay(rndHash, wallet, actualConfig, gasLimit, gasMul, stakeValue, url, beneficiaryAddress, controllerAddress) {
    const web3 = new Web3(new Web3.providers.HttpProvider(actualConfig.nodeUrl));
    const rollupPoS = new web3.eth.Contract(actualConfig.posAbi, actualConfig.posAddress);
    const tx = {
        from: wallet.address,
        to: actualConfig.posAddress,
        gasLimit,
        gasPrice: await _getGasPrice(gasMul, web3),
        value: web3.utils.toHex(web3.utils.toWei(stakeValue.toString(), 'ether')),
        data: rollupPoS.methods.addOperatorRelay(controllerAddress, beneficiaryAddress, rndHash, url).encodeABI(),
    };
    const signedTx = await web3.eth.accounts.signTransaction(tx, wallet.privateKey);
    return signedTx;
}

/**
 * Remove operator from RollupPoS
 * @param {Number} opId - operator identifier inside PoS
 * @param {Object} wallet - wallet json object
 * @param {Object} actualConfig - client configuration
 * @param {Number} gasLimit - gas limit
 * @param {Number} gasMul - gas multiplier
 * @returns {Object} - signed transaction
 */
async function unregister(opId, wallet, actualConfig, gasLimit, gasMul) {
    const web3 = new Web3(new Web3.providers.HttpProvider(actualConfig.nodeUrl));
    const rollupPoS = new web3.eth.Contract(actualConfig.posAbi, actualConfig.posAddress);
    const tx = {
        from: wallet.address,
        to: actualConfig.posAddress,
        gasLimit,
        gasPrice: await _getGasPrice(gasMul, web3),
        data: rollupPoS.methods.removeOperator(opId.toString()).encodeABI(),
    };
    const signedTx = await web3.eth.accounts.signTransaction(tx, wallet.privateKey);
    return signedTx;
}

/**
 * Get stake from RollupPoS
 * @param {Number} opId - operator identifier inside PoS
 * @param {Object} wallet - wallet json object
 * @param {Object} actualConfig - client configuration
 * @param {Number} gasLimit - gas limit
 * @param {Number} gasMul - gas multiplier
 * @returns {Object} - signed transaction
 */
async function withdraw(opId, wallet, actualConfig, gasLimit, gasMul) {
    const web3 = new Web3(new Web3.providers.HttpProvider(actualConfig.nodeUrl));
    const rollupPoS = new web3.eth.Contract(actualConfig.posAbi, actualConfig.posAddress);
    const tx = {
        from: wallet.address,
        to: actualConfig.posAddress,
        gasLimit,
        gasPrice: await _getGasPrice(gasMul, web3),
        data: rollupPoS.methods.withdraw(opId.toString()).encodeABI(),
    };
    const signedTx = await web3.eth.accounts.signTransaction(tx, wallet.privateKey);
    return signedTx;
}

module.exports = {
    register,
    registerWithDifferentBeneficiary,
    registerRelay,
    unregister,
    withdraw,
    getEtherBalance,
};
