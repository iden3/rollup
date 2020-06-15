const ethers = require('ethers');
const { Scalar } = require('ffjavascript');

/**
 * Get current average gas price from the last ethereum blocks and multiply it
 * @param {Number} multiplier - multiply the average gas price by this parameter
 * @param {Object} provider - ethereum provider object
 * @returns {Promise} - promise will return the gas price obtained.
*/
async function getGasPrice(multiplier, provider) {
    const strAvgGas = await provider.getGasPrice();
    const avgGas = Scalar.e(strAvgGas);
    const res = (avgGas * Scalar.e(multiplier));
    const retValue = await ethers.utils.bigNumberify(res.toString());
    return retValue;
}

module.exports = {
    getGasPrice,
};
