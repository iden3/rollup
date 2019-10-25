/* eslint-disable no-await-in-loop */
const fs = require('fs');
const ethers = require('ethers');
const { Wallet } = require('../../src/wallet');

async function createWallets(numWallets, amountToken, passString, addressRollup, walletEthFunder,
    amountEther, addressTokens, abiTokens, node, path, mnemonic) {
    const pathNewWallets = (path) || '../../tools/resourcesBot/wallets';
    if (!fs.existsSync(pathNewWallets)) {
        fs.mkdirSync(pathNewWallets);
    }
    const wallets = [];
    const provider = new ethers.providers.JsonRpcProvider(node);
    walletEthFunder = walletEthFunder.connect(provider);
    const contractTokensFunder = new ethers.Contract(addressTokens, abiTokens, walletEthFunder);
    const addressFunder = await walletEthFunder.getAddress();
    const tokensFunder = await contractTokensFunder.balanceOf(addressFunder); // is contract=?
    const balanceFunder = await walletEthFunder.getBalance();

    if (balanceFunder < amountEther) {
        throw Error("Account funder don't have enough ether");
    }

    if (tokensFunder < amountToken) {
        throw Error("Account funder don't have enough tokens");
    }

    for (let i = 1; i <= numWallets; i++) {
        if (mnemonic) {
            wallets[i] = await Wallet.fromMnemonic(mnemonic, i - 1);
        } else {
            wallets[i] = await Wallet.createRandom();
        }
        // guardar wallets:
        const encWalletI = await wallets[i].toEncryptedJson(passString);
        fs.writeFileSync(`${pathNewWallets}/${i}wallet.json`, JSON.stringify(encWalletI, null, 1), 'utf-8');

        // provide funds
        let walletEth = wallets[i].ethWallet.wallet.connect(provider);
        const balance = await walletEth.getBalance();
        const address = await walletEth.getAddress();
        if (ethers.utils.formatEther(balance) < amountEther) { // if dont have enough funds:
            const tx = {
                to: address,
                value: amountEther,
            };
            await walletEthFunder.sendTransaction(tx);
        }
        // provide tokens:
        const tokens = await contractTokensFunder.balanceOf(address); // if dont have enough tokens:
        if (parseInt(tokens._hex, 16) < amountToken) {
            await contractTokensFunder.transfer(address, amountToken);
        }
        // approve tokens.
        walletEth = walletEth.connect(provider);
        const contractTokensBot = new ethers.Contract(addressTokens, abiTokens, walletEth);
        await contractTokensBot.approve(addressRollup, amountToken);// config.Json address of rollupSC
    }
    return wallets;
}

module.exports = {
    createWallets,
};
