const path = require('path');
const fs = require('fs');
const fse = require('fs-extra');
const { Wallet } = require('../../../src/utils/wallet');

const resources = path.join(__dirname, '../resources');
const configTestPath = path.join(__dirname, '../resources/config-test.json');
const configPath = path.join(__dirname, '../../../config.json');
const abiRollupPath = path.join(__dirname, '../resources/rollupabi.json');
const walletPathDefault = path.join(__dirname, '../../../wallet.json');
const walletPath = path.join(__dirname, '../resources/wallet-test.json');
const walletEthPath = path.join(__dirname, '../resources/ethWallet.json');
const walletBabyjubPath = path.join(__dirname, '../resources/babyjubWallet.json');
const noncePath = path.join(__dirname, '../../../nonceJson.json');

const passphrase = 'foo';

async function createWallet() {
    if (!fs.existsSync(resources)) {
        await fs.mkdirSync(resources);
    }
    const wallet = await Wallet.createRandom();
    const encWallet = await wallet.toEncryptedJson(passphrase);
    await fs.writeFileSync(walletPath, JSON.stringify(encWallet, null, 1), 'utf-8');
    await fs.writeFileSync(walletPathDefault, JSON.stringify(encWallet, null, 1), 'utf-8');
    await fs.writeFileSync(walletEthPath, JSON.stringify(encWallet.ethWallet, null, 1), 'utf-8');
    await fs.writeFileSync(walletBabyjubPath, JSON.stringify(encWallet.babyjubWallet, null, 1), 'utf-8');
}

async function createConfig(address, depositEthAddress) {
    if (!fs.existsSync(resources)) {
        await fs.mkdirSync(resources);
    }
    const actualConfig = {
        wallet: path.join(__dirname, '../resources/wallet-test.json'),
        urlOperator: 'http://127.0.0.1:9000',
        addressRollup: '',
        nodeEth: 'http://localhost:8545',
        abiRollupPath: path.join(__dirname, '../resources/rollupabi.json'),
        depositEthAddress: '',
    };

    actualConfig.addressRollup = address;
    actualConfig.depositEthAddress = depositEthAddress;
    await fs.writeFileSync(configTestPath, JSON.stringify(actualConfig, null, 1), 'utf-8');
    await fs.writeFileSync(configPath, JSON.stringify(actualConfig, null, 1), 'utf-8');
}

async function createRollupAbi(abi) {
    if (!fs.existsSync(resources)) {
        await fs.mkdirSync(resources);
    }
    await fs.writeFileSync(abiRollupPath, JSON.stringify(abi, null, 1), 'utf-8');
}

async function deleteResources() {
    if (fs.existsSync(resources)) {
        await fse.remove(resources);
    }
    if (fs.existsSync(walletPathDefault)) {
        await fs.unlinkSync(walletPathDefault);
    }
    if (fs.existsSync(configPath)) {
        await fs.unlinkSync(configPath);
    }
    if (fs.existsSync(noncePath)) {
        await fs.unlinkSync(noncePath);
    }
}

module.exports = {
    createWallet,
    createConfig,
    createRollupAbi,
    deleteResources,
};
