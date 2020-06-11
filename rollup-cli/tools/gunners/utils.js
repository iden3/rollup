/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
/* eslint-disable no-plusplus */

const fs = require('fs');
const ethers = require('ethers');
const { Scalar } = require('ffjavascript');

const { Wallet } = require('../../src/utils/wallet');
const { deposit } = require('../../src/actions/onchain/deposit');
const { depositOnTop } = require('../../src/actions/onchain/deposit-on-top');

async function createWallets(numWallets, amountToken, passString, addressRollup, walletEthFunder,
    amountEther, addressTokens, abiTokens, node, path, mnemonic, index) {
    const pathNewWallets = path || './wallets';

    if (!fs.existsSync(pathNewWallets)) {
        fs.mkdirSync(pathNewWallets);
    }
    const wallets = {};
    const provider = new ethers.providers.JsonRpcProvider(node);
    walletEthFunder = walletEthFunder.connect(provider);

    const contractTokensFunder = new ethers.Contract(addressTokens, abiTokens, walletEthFunder);

    for (let i = index; i < numWallets + index; i++) {
        if (mnemonic) {
            wallets[i] = await Wallet.fromMnemonic(mnemonic, i);
        } else {
            wallets[i] = await Wallet.createRandom();
        }

        // save wallets:
        const encWalletI = await wallets[i].toEncryptedJson(passString);
        fs.writeFileSync(`${pathNewWallets}/${i}wallet.json`, JSON.stringify(encWalletI, null, 1), 'utf-8');

        // provide funds
        let walletEth = wallets[i].ethWallet.wallet.connect(provider);
        const balance = await walletEth.getBalance();
        const address = await walletEth.getAddress();
        if (ethers.utils.formatEther(balance) < amountEther) { // if dont have enough funds:
            const tx = {
                to: address,
                value: ethers.utils.parseEther(amountEther.toString()),
            };
            const receipt = await walletEthFunder.sendTransaction(tx);
            await receipt.wait();
        }

        if (Scalar.gt(amountToken, 0)) {
            // provide tokens:
            const tokens = await contractTokensFunder.balanceOf(address); // if dont have enough tokens:
            if (Scalar.lt(Scalar.fromString(tokens._hex, 16), amountToken)) {
                await contractTokensFunder.transfer(address, amountToken.toString());
            }

            // approve tokens.
            walletEth = walletEth.connect(provider);
            const contractTokensBot = new ethers.Contract(addressTokens, abiTokens, walletEth);
            await contractTokensBot.approve(addressRollup, amountToken.toString()); // config.Json address of rollupSC
        }
    }
    return wallets;
}


async function walletsDeposit(amountToken, passString, addressRollup, abiRollup, node, tokenId, path, numTx) {
    let files;
    try {
        files = fs.readdirSync(path);
    } catch (err) {
        throw new Error("Directory don't exist");
    }

    if (files.length === 0) {
        throw new Error('No files in this directory');
    }
    const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
    files.sort(collator.compare);// sort by numerical (if not the order would be: 1 10 2 3 4...)

    const provider = new ethers.providers.JsonRpcProvider(node);
    const contractRollup = new ethers.Contract(addressRollup, abiRollup, provider);
    const wallets = {};
    let i = 1;
    for (const file of files) {
        wallets[i] = await Wallet.fromEncryptedJson(JSON.parse(fs.readFileSync(`${path}/${file}`, 'utf8')), passString);
        console.log(`http://localhost:9000/accounts/${wallets[i].babyjubWallet.publicKey[0].toString(16)}/${wallets[i].babyjubWallet.publicKey[1].toString(16)}/${tokenId}`);
        i++;
    }

    for (let j = 1; j <= files.length; j++) {
        for (let k = 0; k < numTx; k++) {
            const pubKeyBabyjub = [wallets[j].babyjubWallet.publicKey[0].toString(), wallets[j].babyjubWallet.publicKey[1].toString()];
            if (k === 0) {
                const response = await contractRollup.getLeafInfo(pubKeyBabyjub, tokenId);
                if (parseInt(response.ethAddress, 16) === 0) {
                    await deposit(node, addressRollup, amountToken.toString(), tokenId, wallets[j],
                        0, abiRollup);
                } else {
                    await depositOnTop(node, addressRollup, amountToken.toString(), tokenId, pubKeyBabyjub, wallets[j],
                        abiRollup);
                }
            } else {
                await depositOnTop(node, addressRollup, amountToken.toString(), tokenId, pubKeyBabyjub, wallets[j],
                    abiRollup);
            }
        }
    }
}


module.exports = {
    createWallets,
    walletsDeposit,
};
