/* eslint-disable no-restricted-syntax */
const ethers = require('ethers');
const axios = require('axios');
const { Wallet } = require('../../wallet.js');

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
async function withdraw(urlNode, addressSC, balance, tokenId, walletJson, password, abi, UrlOperator) {
    const walletRollup = await Wallet.fromEncryptedJson(walletJson, password);
    let walletEth = walletRollup.ethWallet.wallet;
    const walletBaby = walletRollup.babyjubWallet;
    const provider = new ethers.providers.JsonRpcProvider(urlNode);
    const pubKeyBabyjub = [walletBaby.publicKey[0].toString(), walletBaby.publicKey[1].toString()];
    walletEth = walletEth.connect(provider);
    const contractWithSigner = new ethers.Contract(addressSC, abi, walletEth);

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
                    const receipt = await contractWithSigner.withdraw(correctLeaf.id, balance, tokenId, correctLeaf.exitRoot,
                        correctLeaf.nonce, pubKeyBabyjub, correctLeaf.sibilings);
                    resolve(receipt);
                })
                .catch((error) => {
                    reject(error);
                });
        }));
    } catch (error) {
        return ('error.... ', error); // fires as the contract reverted the payment
    }
}

module.exports = {
    withdraw,
};
