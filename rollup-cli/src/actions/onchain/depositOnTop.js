/* eslint-disable no-restricted-syntax */
const ethers = require('ethers');
const { Wallet } = require('../../wallet.js');
const CliExternalOperator = require('../../../../rollup-operator/src/cli-external-operator');
/**
 * @dev deposit on an existing balance tree leaf
 * @param urlNode URL of the ethereum node
 * @param addressSC rollup address
 * @param balance initial balance on balance tree
 * @param tokenId token type identifier
 * @param walletJson from this one can obtain the ethAddress and babyPubKey
 * @param password for decrypt the Wallet
 * @param abi abi of rollup contract
 * @param UrlOperator URl from operator
*/
async function depositOnTop(urlNode, addressSC, balance, tokenId, walletJson, password, abi, UrlOperator) {
    const apiOperator = new CliExternalOperator(UrlOperator);
    const walletRollup = await Wallet.fromEncryptedJson(walletJson, password);
    let walletEth = walletRollup.ethWallet.wallet;
    const walletBaby = walletRollup.babyjubWallet;
    const provider = new ethers.providers.JsonRpcProvider(urlNode);
    walletEth = walletEth.connect(provider);
    const contractWithSigner = new ethers.Contract(addressSC, abi, walletEth);
    const overrides = {
        gasLimit: 800000,
        value: ethers.utils.parseEther('0.11'), // 0.1 minimum fee for onchian Tx
    };

    try {
        return new Promise(((resolve, reject) => {
            apiOperator.getInfoByAxAy(walletBaby.publicKey[0].toString(), walletBaby.publicKey[1].toString())
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
                    const receipt = await contractWithSigner.depositOnTop(correctLeaf.id, balance, tokenId, overrides);
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
    depositOnTop,
};
