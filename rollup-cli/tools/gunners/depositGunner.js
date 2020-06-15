/* eslint-disable no-await-in-loop */
/* eslint-disable no-console */
// Constant variables
const fs = require('fs');
const ethers = require('ethers');
const path = require('path');
const { Scalar } = require('ffjavascript');
const { Wallet } = require('../../src/utils/wallet');
const { createWallets, walletsDeposit } = require('./utils');

const configParamsPath = path.join(__dirname, 'config/params.json');
const walletPath = path.join(__dirname, 'config/wallet.json');

// Argument variables
const pass = 'password';
const urlNodeEth = 'https://goerli.infura.io/v3/135e56bb9eaa42c59e73481fcb0f9b4a';
const addressTokens = '0xaff4481d10270f50f203e0763e2597776068cbc5';
const actualConfig = JSON.parse(fs.readFileSync(configParamsPath, 'utf8'));
const { abiRollup } = actualConfig;
const pathWallets = path.join(__dirname, './config/wallets');
const { mnenonic } = actualConfig;
const tokenId = 0;

const numTx = 1;
const numWallets = 1;
const etherFund = 0.1;
const tokensFund = Scalar.e(1e+19);

async function gunOnChainTx() {
    const wallet = JSON.parse(fs.readFileSync(walletPath, 'utf-8'));
    const walletRollup = await Wallet.fromEncryptedJson(wallet, pass);

    let walletEthFunder = walletRollup.ethWallet.wallet;

    const provider = new ethers.providers.JsonRpcProvider(urlNodeEth);
    walletEthFunder = walletEthFunder.connect(provider);

    await createWallets(numWallets, Scalar.mul(tokensFund, numTx), pass, actualConfig.rollupAddress, walletEthFunder, etherFund,
        addressTokens, actualConfig.abiTokens, urlNodeEth, pathWallets, mnenonic, 0);
    await walletsDeposit(tokensFund, pass, actualConfig.rollupAddress, abiRollup, urlNodeEth, tokenId, pathWallets, numTx);
}
gunOnChainTx();
