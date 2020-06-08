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
 * Make bid to RollupPoB
 * @param {Object} wallet - wallet json object
 * @param {Object} actualConfig - client configuration
 * @param {Number} slot - slot
 * @param {String} url - operator url
 * @param {Number} bidValue - bid value (ether)
 * @param {Number} gasLimit - gas limit
 * @param {Number} gasMul - gas multiplier
 * @returns {Object} - signed transaction
 */

async function bid(wallet, actualConfig, slot, url, bidValue, gasLimit, gasMul) {
    const web3 = new Web3(new Web3.providers.HttpProvider(actualConfig.nodeUrl));
    const rollupPoB = new web3.eth.Contract(actualConfig.pobAbi, actualConfig.pobAddress);
    const tx = {
        from: wallet.address,
        to: actualConfig.pobAddress,
        gasLimit,
        gasPrice: await _getGasPrice(gasMul, web3),
        value: web3.utils.toHex(web3.utils.toWei(bidValue.toString(), 'ether')),
        data: rollupPoB.methods.bid(slot, url).encodeABI(),
    };
    const signedTx = await web3.eth.accounts.signTransaction(tx, wallet.privateKey);
    return signedTx;
}

/**
 * Make bid to RollupPoB
 * @param {Object} wallet - wallet json object
 * @param {Object} actualConfig - client configuration
 * @param {Number} slot - slot
 * @param {String} url - operator url
 * @param {Number} bidValue - bid value (ether)
 * @param {String} beneficiary - beneficiary Address
 * @param {Number} gasLimit - gas limit
 * @param {Number} gasMul - gas multiplier
 * @returns {Object} - signed transaction
 */

async function bidWithDifferentBeneficiary(wallet, actualConfig, slot, url, bidValue, beneficiary, gasLimit, gasMul) {
    const web3 = new Web3(new Web3.providers.HttpProvider(actualConfig.nodeUrl));
    const rollupPoB = new web3.eth.Contract(actualConfig.pobAbi, actualConfig.pobAddress);
    const tx = {
        from: wallet.address,
        to: actualConfig.pobAddress,
        gasLimit,
        gasPrice: await _getGasPrice(gasMul, web3),
        value: web3.utils.toHex(web3.utils.toWei(bidValue.toString(), 'ether')),
        data: rollupPoB.methods.bidWithDifferentBeneficiary(slot, url, beneficiary).encodeABI(),
    };
    const signedTx = await web3.eth.accounts.signTransaction(tx, wallet.privateKey);
    return signedTx;
}

/**
 * Make bid to RollupPoB
 * @param {Object} wallet - wallet json object
 * @param {Object} actualConfig - client configuration
 * @param {Number} slot - slot
 * @param {String} url - operator url
 * @param {Number} bidValue - bid value (ether)
 * @param {String} beneficiary - beneficiary Address
 * @param {String} forger - forger Address
 * @param {Number} gasLimit - gas limit
 * @param {Number} gasMul - gas multiplier
 * @returns {Object} - signed transaction
 */

async function bidRelay(wallet, actualConfig, slot, url, bidValue, beneficiary, forger, gasLimit, gasMul) {
    const web3 = new Web3(new Web3.providers.HttpProvider(actualConfig.nodeUrl));
    const rollupPoB = new web3.eth.Contract(actualConfig.pobAbi, actualConfig.pobAddress);
    const tx = {
        from: wallet.address,
        to: actualConfig.pobAddress,
        gasLimit,
        gasPrice: await _getGasPrice(gasMul, web3),
        value: web3.utils.toHex(web3.utils.toWei(bidValue.toString(), 'ether')),
        data: rollupPoB.methods.bidRelay(slot, url, beneficiary, forger).encodeABI(),
    };
    const signedTx = await web3.eth.accounts.signTransaction(tx, wallet.privateKey);
    return signedTx;
}

/**
 * Make bid to RollupPoB
 * @param {Object} wallet - wallet json object
 * @param {Object} actualConfig - client configuration
 * @param {Number} slot - slot
 * @param {String} url - operator url
 * @param {Number} bidValue - bid value (ether)
 * @param {String} beneficiary - beneficiary Address
 * @param {String} forger - forger Address
 * @param {String} withdrawAddress - address to withdraw bid
 * @param {Number} gasLimit - gas limit
 * @param {Number} gasMul - gas multiplier
 * @returns {Object} - signed transaction
 */

async function bidRelayAndWithdrawAddress(wallet, actualConfig, slot, url, bidValue, beneficiary,
    forger, withdrawAddress, gasLimit, gasMul) {
    const web3 = new Web3(new Web3.providers.HttpProvider(actualConfig.nodeUrl));
    const rollupPoB = new web3.eth.Contract(actualConfig.pobAbi, actualConfig.pobAddress);
    const tx = {
        from: wallet.address,
        to: actualConfig.pobAddress,
        gasLimit,
        gasPrice: await _getGasPrice(gasMul, web3),
        value: web3.utils.toHex(web3.utils.toWei(bidValue.toString(), 'ether')),
        data: rollupPoB.methods.bidRelayAndWithdrawAddress(slot, url, beneficiary, forger, withdrawAddress).encodeABI(),
    };
    const signedTx = await web3.eth.accounts.signTransaction(tx, wallet.privateKey);
    return signedTx;
}

/**
 * Make bid to RollupPoB
 * @param {Object} wallet - wallet json object
 * @param {Object} actualConfig - client configuration
 * @param {Number} slot - slot
 * @param {String} url - operator url
 * @param {Number} bidValue - bid value (ether)
 * @param {String} beneficiary - beneficiary Address
 * @param {String} forger - forger Address
 * @param {String} withdrawAddress - address to withdraw bid
 * @param {String} bonusAddress - bonus Address
 * @param {Boolean} useBonus - use the bonus or not
 * @param {Number} gasLimit - gas limit
 * @param {Number} gasMul - gas multiplier
 * @returns {Object} - signed transaction
 */

async function bidWithDifferentAddresses(wallet, actualConfig, slot, url, bidValue, beneficiary,
    forger, withdrawAddress, bonusAddress, useBonus, gasLimit, gasMul) {
    const web3 = new Web3(new Web3.providers.HttpProvider(actualConfig.nodeUrl));
    const rollupPoB = new web3.eth.Contract(actualConfig.pobAbi, actualConfig.pobAddress);
    const tx = {
        from: wallet.address,
        to: actualConfig.pobAddress,
        gasLimit,
        gasPrice: await _getGasPrice(gasMul, web3),
        value: web3.utils.toHex(web3.utils.toWei(bidValue.toString(), 'ether')),
        data: rollupPoB.methods.bidWithDifferentAddresses(slot, url, beneficiary, forger, withdrawAddress, bonusAddress, useBonus).encodeABI(),
    };
    const signedTx = await web3.eth.accounts.signTransaction(tx, wallet.privateKey);
    return signedTx;
}

/**
 * Make bid to RollupPoB
 * @param {Object} wallet - wallet json object
 * @param {Object} actualConfig - client configuration
 * @param {Array} rangeSlot - slot
 * @param {String} url - operator url
 * @param {Array} rangeBid - bid value (ether)
 * @param {Number} gasLimit - gas limit
 * @param {Number} gasMul - gas multiplier
 * @returns {Object} - signed transaction
 */

async function multiBid(wallet, actualConfig, rangeSlot, url, rangeBid, gasLimit, gasMul) {
    const web3 = new Web3(new Web3.providers.HttpProvider(actualConfig.nodeUrl));
    const rollupPoB = new web3.eth.Contract(actualConfig.pobAbi, actualConfig.pobAddress);
    let totalAmount = web3.utils.toBN(0);
    const rangeBidWei = [];
    for (let i = 0; i < rangeBid.length; i++) {
        const bidWei = web3.utils.toWei(rangeBid[i].toString(), 'ether');
        rangeBidWei.push(bidWei);
        const auxBid = web3.utils.toBN(bidWei);
        const addBid = auxBid.mul(web3.utils.toBN(rangeSlot[i][1] - rangeSlot[i][0] + 1));
        totalAmount = totalAmount.add(addBid);
    }
    const tx = {
        from: wallet.address,
        to: actualConfig.pobAddress,
        gasLimit,
        gasPrice: await _getGasPrice(gasMul, web3),
        value: web3.utils.toHex(totalAmount),
        data: rollupPoB.methods.multiBid(rangeBidWei, rangeSlot, url).encodeABI(),
    };
    const signedTx = await web3.eth.accounts.signTransaction(tx, wallet.privateKey);
    return signedTx;
}

/**
 * Get bid from RollupPoB
 * @param {Object} wallet - wallet json object
 * @param {Object} actualConfig - client configuration
 * @param {Number} gasLimit - gas limit
 * @param {Number} gasMul - gas multiplier
 * @returns {Object} - signed transaction
 */
async function withdraw(wallet, actualConfig, gasLimit, gasMul) {
    const web3 = new Web3(new Web3.providers.HttpProvider(actualConfig.nodeUrl));
    const rollupPoB = new web3.eth.Contract(actualConfig.pobAbi, actualConfig.pobAddress);
    const tx = {
        from: wallet.address,
        to: actualConfig.pobAddress,
        gasLimit,
        gasPrice: await _getGasPrice(gasMul, web3),
        data: rollupPoB.methods.withdraw().encodeABI(),
    };
    const signedTx = await web3.eth.accounts.signTransaction(tx, wallet.privateKey);
    return signedTx;
}

module.exports = {
    bid,
    bidWithDifferentBeneficiary,
    bidRelay,
    bidRelayAndWithdrawAddress,
    bidWithDifferentAddresses,
    multiBid,
    withdraw,
    getEtherBalance,
};
