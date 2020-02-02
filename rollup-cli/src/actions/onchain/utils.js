/* global BigInt */
const ethers = require('ethers');

async function getGasPrice(multiplier, provider) {
    const strAvgGas = await provider.getGasPrice();
    const avgGas = BigInt(strAvgGas);
    const res = (avgGas * BigInt(multiplier));
    const retValue = await ethers.utils.bigNumberify(res.toString());
    return retValue;
}

module.exports = {
    getGasPrice,
};
