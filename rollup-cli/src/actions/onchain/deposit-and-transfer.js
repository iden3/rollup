/* eslint-disable no-restricted-syntax */
const ethers = require('ethers');
const { Wallet } = require('../../wallet.js');
/**
 * @dev deposit on an existing loadAmount tree leaf
 * @param urlNode URL of the ethereum node
 * @param addressSC rollup address
 * @param loadAmount initial Amount on balance tree
 * @param tokenId token type identifier
 * @param walletJson from this one can obtain the ethAddress and babyPubKey
 * @param password for decrypt the Wallet
 * @param ethAddress allowed address to control new balance tree leaf
 * @param abi abi of rollup contract
 * @param UrlOperator URl from operator
*/
async function depositAndTransfer(urlNode, addressSC, loadAmount, amount, tokenId, walletJson, password, ethAddress, abi, toId) {
    const walletRollup = await Wallet.fromEncryptedJson(walletJson, password);
    let walletEth = walletRollup.ethWallet.wallet;
    const walletBaby = walletRollup.babyjubWallet;
    const provider = new ethers.providers.JsonRpcProvider(urlNode);
    const pubKeyBabyjub = [walletBaby.publicKey[0].toString(), walletBaby.publicKey[1].toString()];
    walletEth = walletEth.connect(provider);
    const address = ethAddress || await walletEth.getAddress();
    const contractWithSigner = new ethers.Contract(addressSC, abi, walletEth);
    const overrides = {
        gasLimit: 800000,
        value: ethers.utils.parseEther('0.11'), // 0.1 minimum fee for on-chain Tx
    };

    try {
        return await contractWithSigner.depositAndTransfer(loadAmount, tokenId,
            address, pubKeyBabyjub, toId, amount, overrides);
    } catch (error) {
        throw new Error(`Message error: ${error.message}`);
    }
}

module.exports = {
    depositAndTransfer,
};
