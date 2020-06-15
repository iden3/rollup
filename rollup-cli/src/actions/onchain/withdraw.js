/* eslint-disable no-restricted-syntax */
const ethers = require('ethers');

const CliExternalOperator = require('../../../../rollup-operator/src/cli-external-operator');
const { getGasPrice } = require('./utils');

/**
 * withdraw on-chain transaction to get retrieve the users balance from exit tree
 * before this call an off-chain transaction must be done to Id 0 or an onchain forceWithdraw
 * that transactions will build a leaf on exit tree
 * @param {String} nodeEth - URL of the ethereum node
 * @param {String} addressSC - rollup address
 * @param {Number} tokenId - token type identifier
 * @param {Object} walletRollup - ethAddress and babyPubKey together
 * @param {String} abi - abi of rollup contract'
 * @param {String} urlOperator - URl from operator
 * @param {String} numExitRoot - exit tree root depth to look for exit tree account
 * @param {Number} gasLimit - transaction gas limit
 * @param {Number} gasMultiplier - multiply gas price
 * @returns {Promise} - promise will resolve when the Tx is sent, and return the Tx itself with the Tx Hash.
 */
async function withdraw(nodeEth, addressSC, tokenId, walletRollup, abi, urlOperator,
    numExitRoot, gasLimit = 5000000, gasMultiplier = 1) {
    const walletBaby = walletRollup.babyjubWallet;
    const pubKeyBabyjub = [walletBaby.publicKey[0].toString(16), walletBaby.publicKey[1].toString(16)];
    const pubKeyBabyjubEthCall = [walletBaby.publicKey[0].toString(), walletBaby.publicKey[1].toString()];

    let walletEth = walletRollup.ethWallet.wallet;
    const provider = new ethers.providers.JsonRpcProvider(nodeEth);
    walletEth = walletEth.connect(provider);
    const contractWithSigner = new ethers.Contract(addressSC, abi, walletEth);

    const apiOperator = new CliExternalOperator(urlOperator);

    const overrides = {
        gasLimit,
        gasPrice: await getGasPrice(gasMultiplier, provider),
    };

    try {
        const res = await apiOperator.getExitInfo(tokenId, pubKeyBabyjub[0], pubKeyBabyjub[1], numExitRoot);
        const infoExitTree = res.data;
        if (infoExitTree.found) {
            return await contractWithSigner.withdraw(infoExitTree.state.amount, numExitRoot,
                infoExitTree.siblings, pubKeyBabyjubEthCall, tokenId, overrides);
        }
        throw new Error(`No exit tree leaf was found in batch: ${numExitRoot} with babyjub: ${pubKeyBabyjub}`);
    } catch (error) {
        throw new Error(`Message error: ${error.message}`);
    }
}

module.exports = {
    withdraw,
};
