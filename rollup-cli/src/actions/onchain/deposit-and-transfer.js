/* eslint-disable no-restricted-syntax */
const ethers = require('ethers');
const { Scalar } = require('ffjavascript');

const { fix2float } = require('../../../../js/utils');
const { getGasPrice } = require('./utils');

/**
 * leaf to balance tree and initializes it with a load amount then transfer
 * some amount to an account already defined in the balance tree
 * @param {String} nodeEth - URL of the ethereum node
 * @param {String} addressSC - rollup address
 * @param {String} loadAmount - initial Amount on balance tree
 * @param {String} amount - amount to transfer
 * @param {Number} tokenId - token type identifier
 * @param {String[2]} babyjubTo - babyjub public key receiver
 * @param {Object} walletRollup - ethAddress and babyPubKey together
 * @param {String} ethAddress - allowed address to control new balance tree leaf
 * @param {String} abi - abi of rollup contract
 * @param {Number} gasLimit - transaction gas limit
 * @param {Number} gasMultiplier - multiply gas price
 * @returns {Promise} - promise will resolve when the Tx is sent, and return the Tx itself with the Tx Hash.
*/
async function depositAndTransfer(nodeEth, addressSC, loadAmount, amount, tokenId, babyjubTo, walletRollup,
    ethAddress, abi, gasLimit = 5000000, gasMultiplier = 1) {
    const walletBaby = walletRollup.babyjubWallet;
    const pubKeyBabyjub = [walletBaby.publicKey[0].toString(), walletBaby.publicKey[1].toString()];

    let walletEth = walletRollup.ethWallet.wallet;
    const provider = new ethers.providers.JsonRpcProvider(nodeEth);
    walletEth = walletEth.connect(provider);
    const contractWithSigner = new ethers.Contract(addressSC, abi, walletEth);

    const address = ethAddress || await walletEth.getAddress();
    const amountF = fix2float(amount);

    const feeOnchainTx = await contractWithSigner.feeOnchainTx();
    const feeDeposit = await contractWithSigner.depositFee();

    const overrides = {
        gasLimit,
        gasPrice: await getGasPrice(gasMultiplier, provider),
        value: `0x${(Scalar.add(feeOnchainTx, feeDeposit)).toString(16)}`,
    };

    try {
        return await contractWithSigner.depositAndTransfer(loadAmount, tokenId,
            address, pubKeyBabyjub, babyjubTo, amountF, overrides);
    } catch (error) {
        throw new Error(`Message error: ${error.message}`);
    }
}

module.exports = {
    depositAndTransfer,
};
