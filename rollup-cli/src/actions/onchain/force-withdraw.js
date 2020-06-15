/* eslint-disable no-restricted-syntax */
const ethers = require('ethers');

const { fix2float } = require('../../../../js/utils');
const { getGasPrice } = require('./utils');

/**
 * on-chain transaction to build a leaf on exit tree
 * @param {String} nodeEth - URL of the ethereum node
 * @param {String} addressSC - rollup address
 * @param {Number} tokenId - token type identifier
 * @param {String} amount - amount to transfer to the leaf of exit tree
 * @param {Obejct} walletRollup - ethAddress and babyPubKey together
 * @param {String} abi - abi of rollup contract
 * @param {Number} gasLimit - transaction gas limit
 * @param {Number} gasMultiplier - multiply gas price
 * @returns {Promise} - promise will resolve when the Tx is sent, and return the Tx itself with the Tx Hash.
 */
async function forceWithdraw(nodeEth, addressSC, tokenId, amount, walletRollup, abi, gasLimit = 5000000, gasMultiplier = 1) {
    const walletBaby = walletRollup.babyjubWallet;
    const pubKeyBabyjub = [walletBaby.publicKey[0].toString(), walletBaby.publicKey[1].toString()];

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

    const amountF = fix2float(amount);
    try {
        return await contractWithSigner.forceWithdraw(pubKeyBabyjub, tokenId, amountF, overrides);
    } catch (error) {
        throw new Error(`Message error: ${error.message}`);
    }
}

module.exports = {
    forceWithdraw,
};
