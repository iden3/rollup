/* eslint-disable no-restricted-syntax */
const ethers = require('ethers');
const { getGasPrice } = require('./utils');

/**
 * @dev deposit on an existing balance tree leaf
 * @param nodeEth URL of the ethereum node
 * @param addressSC rollup address
 * @param loadAmount initial balance on balance tree
 * @param tokenId token type identifier
 * @param walletJson from this one can obtain the ethAddress and babyPubKey
 * @param passphrase for decrypt the Wallet
 * @param abi abi of rollup contract
 * @param UrlOperator URl from operator
*/
async function depositOnTop(nodeEth, addressSC, loadAmount, tokenId, walletRollup,
    abi, IdTo, gasLimit = 5000000, gasMultiplier = 1) {
    let walletEth = walletRollup.ethWallet.wallet;
    const provider = new ethers.providers.JsonRpcProvider(nodeEth);
    walletEth = walletEth.connect(provider);
    const contractWithSigner = new ethers.Contract(addressSC, abi, walletEth);
    const feeOnchainTx = await contractWithSigner.FEE_ONCHAIN_TX();
    const overrides = {
        gasLimit,
        gasPrice: await getGasPrice(gasMultiplier, provider),
        value: feeOnchainTx,
    };

    try {
        return await contractWithSigner.depositOnTop(IdTo, loadAmount, tokenId, overrides);
    } catch (error) {
        throw new Error(`Message error: ${error.message}`);
    }
}

module.exports = {
    depositOnTop,
};
