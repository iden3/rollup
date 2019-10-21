/* eslint-disable no-restricted-syntax */
const ethers = require('ethers');
const axios = require('axios');
const { Wallet } = require('../../wallet.js');

/**
 * @dev on-chain transaction to build a leaf on exit tree
 * @param urlNode URL of the ethereum node
 * @param addressSC rollup address
 * @param balance amount to transfer to the leaf of exit tree
 * @param tokenId token type identifier
 * @param walletJson from this one can obtain the ethAddress and babyPubKey
 * @param password for decrypt the Wallet
 * @param abi abi of rollup contract
 * @param UrlOperator URl from operator
 */
async function forceWithdraw(urlNode, addressSC, balance, tokenId, walletJson, password, abi, UrlOperator) {
    const walletRollup = await Wallet.fromEncryptedJson(walletJson, password);
    let walletEth = walletRollup.ethWallet.wallet;
    const walletBaby = walletRollup.babyjubWallet;
    const provider = new ethers.providers.JsonRpcProvider(urlNode);
    const pubKeyBabyjub = [walletBaby.publicKey[0].toString(), walletBaby.publicKey[1].toString()];
    walletEth = walletEth.connect(provider);
    const contractWithSigner = new ethers.Contract(addressSC, abi, walletEth);
    const overrides = {
        gasLimit: 800000,
        value: ethers.utils.parseEther('0.11'), // 0.1 minimum fee for onchian Tx
    };

    try {
        return new Promise(((resolve, reject) => {
            axios.get(`${UrlOperator}/offchain/info/${walletBaby.publicKey[0].toString()}/${walletBaby.publicKey[1].toString()}`)
                .then(async (response) => {
                    let correctLeaf = [];
                    for (const leaf of response.data) {
                        if (leaf.tokenId === tokenId) {
                            correctLeaf = leaf;
                        }
                    }
                    if (correctLeaf === []) {
                        reject(new Error("There're no leafs with this wallet (babyjub) and this tokenID"));
                    }
                    const receipt = await contractWithSigner.forceWithdraw(correctLeaf.id, balance, pubKeyBabyjub, overrides);
                    resolve(receipt);
                })
                .catch((error) => {
                    reject(error);
                });
        }));
    } catch (error) {
        return ('error.... ', error);
    }
}

module.exports = {
    forceWithdraw,
};
