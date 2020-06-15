/* eslint-disable no-restricted-syntax */
const ethers = require('ethers');

const { getGasPrice } = require('./utils');

/**
 * deposit on an existing balance tree leaf
 * @param {String} nodeEth - URL of the ethereum node
 * @param {String} addressSC - rollup address
 * @param {String} loadAmount - initial balance on balance tree
 * @param {Number} tokenId - token type identifier
 * @param {String[2]} babyjubTo - babyjub public key receiver
 * @param {Object} walletRollup - ethAddress and babyPubKey together
 * @param {String} abi - abi of rollup contract
 * @param {Number} gasLimit - transaction gas limit
 * @param {Number} gasMultiplier - multiply gas price
* @returns {Promise} - promise will resolve when the Tx is sent, and return the Tx itself with the Tx Hash.
*/
async function depositOnTop(nodeEth, addressSC, loadAmount, tokenId, babyjubTo, walletRollup,
    abi, gasLimit = 5000000, gasMultiplier = 1) {
    let walletEth = walletRollup.ethWallet.wallet;
    const provider = new ethers.providers.JsonRpcProvider(nodeEth);
    walletEth = walletEth.connect(provider);
    const contractWithSigner = new ethers.Contract(addressSC, abi, walletEth);

    const feeOnchainTx = await contractWithSigner.feeOnchainTx();
    const overrides = {
        gasLimit,
        gasPrice: await getGasPrice(gasMultiplier, provider),
        value: feeOnchainTx,
    };

    try {
        return await contractWithSigner.depositOnTop(babyjubTo, loadAmount, tokenId, overrides);
    } catch (error) {
        throw new Error(`Message error: ${error.message}`);
    }
}

module.exports = {
    depositOnTop,
};
