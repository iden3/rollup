/* eslint-disable no-await-in-loop */
/* eslint-disable no-console */
// Constant variables
const fs = require('fs');
const ethers = require('ethers');
const path = require('path');
const { Wallet } = require('../../src/wallet');
const { getGasPrice } = require('../../src/actions/onchain/utils.js');

const configParamsPath = path.join(__dirname, 'config/params.json');
const walletPath = path.join(__dirname, 'config/wallet.json');


// Argument variables
const numTx = 10;
const loadAmount = 1000;
const pass = '123';
const urlNodeEth = 'https://goerli.infura.io/v3/135e56bb9eaa42c59e73481fcb0f9b4a'; // localhost when gpu node
const gasMul = 3;
const addressTokens = '0xaff4481d10270f50f203e0763e2597776068cbc5';
const actualConfig = JSON.parse(fs.readFileSync(configParamsPath, 'utf8'));
const { abiRollup } = actualConfig;

function timeout(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function gunOnChainTx() {
    const wallet = JSON.parse(fs.readFileSync(walletPath, 'utf-8'));
    const walletRollup = await Wallet.fromEncryptedJson(wallet, pass);

    let walletEth = walletRollup.ethWallet.wallet;
    const walletBaby = walletRollup.babyjubWallet;

    const addressEth = await walletEth.getAddress();

    const pubKeyBabyjub = [walletBaby.publicKey[0].toString(), walletBaby.publicKey[1].toString()];

    const provider = new ethers.providers.JsonRpcProvider(urlNodeEth);
    walletEth = walletEth.connect(provider);

    const contractWithSigner = new ethers.Contract(actualConfig.rollupAddress, abiRollup, walletEth);
    const feeOnchainTx = await contractWithSigner.feeOnchainTx();
    const overrides = {
        gasLimit: 5000000,
        gasPrice: await getGasPrice(gasMul, provider),
        value: feeOnchainTx,
    };
    const contractTokens = new ethers.Contract(addressTokens, actualConfig.abiTokens, walletEth);

    const resApproveTokens = await contractTokens.approve(actualConfig.rollupAddress, numTx * loadAmount); // approve tokens

    await resApproveTokens.wait();

    for (let i = 0; i < numTx; i++) {
        let resTx;
        try {
            resTx = await contractWithSigner.deposit(loadAmount, 0, addressEth, pubKeyBabyjub, overrides)
                .catch((error) => { console.log(error); });
        } catch (error) {
            throw new Error(`Error sending ${i} transaction`, error);
        }
        console.log(`Added numTx ${i} with hash ${resTx.hash}`);
        await timeout(1000);
    }
}
gunOnChainTx();
