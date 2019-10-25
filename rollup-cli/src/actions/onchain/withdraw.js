/* eslint-disable no-restricted-syntax */
const ethers = require('ethers');
const { Wallet } = require('../../wallet.js');
const CliExternalOperator = require('../../../../rollup-operator/src/cli-external-operator');
/**
 * @dev withdraw on-chain transaction to get retrieve the users balance from exit tree
 * before this call an off-chain transaction must be done to Id 0 or a onchain forceWithdraw
 * that transactoins will build a leaf on exit tree
 * @param urlNode URL of the ethereum node
 * @param addressSC rollup address
 * @param balance amount to retrieve
 * @param tokenId token type
 * @param walletJson from this one can obtain the ethAddress and babyPubKey
 * @param password for decrypt the Wallet
 * @param abi abi of rollup contract'
 * @param UrlOperator URl from operator
 */
async function withdraw(urlNode, addressSC, balance, tokenId, walletJson, password, abi, UrlOperator, idFrom) {
    const apiOperator = new CliExternalOperator(UrlOperator);
    const walletRollup = await Wallet.fromEncryptedJson(walletJson, password);
    let walletEth = walletRollup.ethWallet.wallet;
    const provider = new ethers.providers.JsonRpcProvider(urlNode);
    walletEth = walletEth.connect(provider);
    const contractWithSigner = new ethers.Contract(addressSC, abi, walletEth);

    try {
        const responseLeaf = await apiOperator.getInfoByIdx(idFrom);
        return await contractWithSigner.withdraw(responseLeaf.data.id, balance, tokenId, responseLeaf.data.numExitRoot,
            responseLeaf.data.nonce, responseLeaf.data.sibilings);
    } catch (error) {
        throw new Error(`Message error: ${error.message}`);
    }
}

module.exports = {
    withdraw,
};
