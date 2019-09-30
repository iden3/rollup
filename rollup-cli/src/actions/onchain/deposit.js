const ethers = require('ethers');
const { Wallet } = require('../../wallet.js');

/**
 * @dev deposit on-chain transaction
 * add new leaf to balance tree and initializes it with a load amount
 * @param urlNode URL of the ethereum node
 * @param addressSC rollup address
 * @param balance initial balance on balance tree
 * @param tokenId token type identifier
 * @param walletJson from this one can obtain the ethAddress and babyPubKey
 * @param password for decrypt the Wallet
 * @param abi abi of rollup contract
*/
async function deposit(urlNode, addressSC, balance, tokenId, walletJson, password, abi) {
    const walletRollup = await Wallet.fromEncryptedJson(walletJson, password);
    let walletEth = walletRollup.ethWallet.wallet;
    const walletBaby = walletRollup.babyjubWallet;
    const provider = new ethers.providers.JsonRpcProvider(urlNode);
    const pubKeyBabyjub = [walletBaby.publicKey[0].toString(), walletBaby.publicKey[1].toString()];
    walletEth = walletEth.connect(provider);
    const address = await walletEth.getAddress();
    const contractWithSigner = new ethers.Contract(addressSC, abi, walletEth);
    const overrides = {
        gasLimit: 800000,
        value: ethers.utils.parseEther('0.11'), // 0.1 minimum fee for onchian Tx
    };

    try {
        return new Promise(((resolve) => {
            contractWithSigner.deposit(balance, tokenId, address, pubKeyBabyjub, overrides)
                .then((response) => {
                    resolve(response);
                });
        }));
    } catch (error) {
        return new Error('error.... ', error); // fires as the contract reverted the payment
    }
}

module.exports = {
    deposit,
};
