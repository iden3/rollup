/* eslint-disable no-restricted-syntax */
const ethers = require('ethers');

const { fix2float } = require('../../../../js/utils');
const { getGasPrice } = require('./utils');

/**
 * transfer between two accounts already defined in tree leaf
 * @param {String} nodeEth - URL of the ethereum node
 * @param {String} addressSC - rollup address
 * @param {String} amount - initial balance on balance tree
 * @param {Number} tokenId - token type identifier
 * @param {String[2]} babyjubTo - babyjub public key receiver
 * @param {Object} walletRollup - ethAddress and babyPubKey together sender
 * @param {String} abi - abi of rollup contract
 * @param {Number} gasLimit - transaction gas limit
 * @param {Number} gasMultiplier - multiply gas price
 * @returns {Promise} - promise will resolve when the Tx is sent, and return the Tx itself with the Tx Hash.
*/
async function transfer(nodeEth, addressSC, amount, tokenId, babyjubTo, walletRollup,
    abi, gasLimit = 5000000, gasMultiplier = 1) {
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
        return contractWithSigner.transfer(pubKeyBabyjub, babyjubTo, amountF, tokenId, overrides);
    } catch (error) {
        throw new Error(`Message error: ${error.message}`);
    }
}

module.exports = {
    transfer,
};
