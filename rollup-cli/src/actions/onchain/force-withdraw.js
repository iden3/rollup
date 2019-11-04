/* eslint-disable no-restricted-syntax */
const ethers = require('ethers');
const { Wallet } = require('../../wallet.js');
/**
 * @dev on-chain transaction to build a leaf on exit tree
 * @param urlNode URL of the ethereum node
 * @param addressSC rollup address
 * @param balance amount to transfer to the leaf of exit tree
 * @param walletJson from this one can obtain the ethAddress and babyPubKey
 * @param password for decrypt the Wallet
 * @param abi abi of rollup contract
 * @param UrlOperator URl from operator
 */
async function forceWithdraw(urlNode, addressSC, balance, walletJson, password, abi, idFrom) {
    const walletRollup = await Wallet.fromEncryptedJson(walletJson, password);
    let walletEth = walletRollup.ethWallet.wallet;
    const provider = new ethers.providers.JsonRpcProvider(urlNode);
    walletEth = walletEth.connect(provider);
    const contractWithSigner = new ethers.Contract(addressSC, abi, walletEth);
    const overrides = {
        gasLimit: 800000,
        value: ethers.utils.parseEther('0.11'), // 0.1 minimum fee for on-chain Tx
    };

    try {
        return await contractWithSigner.forceWithdraw(idFrom, balance, overrides);
    } catch (error) {
        throw new Error(`Message error: ${error.message}`);
    }
}

module.exports = {
    forceWithdraw,
};
