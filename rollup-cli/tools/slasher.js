/* eslint-disable no-await-in-loop */
/* eslint-disable no-console */
const ethers = require('ethers');
const { Wallet } = require('../src/wallet');

const TIMEOUT_ERROR = 2000;
const TIMEOUT_NEXT_LOOP = 10000;

async function slashSC(urlNode, addressSC, walletJson, password, abi, oldCurrentSlot) {
    // eslint-disable-next-line no-constant-condition
    while (true) {
        try {
            const walletRollup = await Wallet.fromEncryptedJson(walletJson, password);
            let walletEth = walletRollup.ethWallet.wallet;
            const provider = new ethers.providers.JsonRpcProvider(urlNode);
            walletEth = walletEth.connect(provider);
            const contract = new ethers.Contract(addressSC, abi, walletEth);
            const currentSlot = await contract.currentSlot();
            const slots = [];
            for (let i = oldCurrentSlot; i < currentSlot; i++) {
                slots.push(i);
            }
            slots.forEach((slot) => {
                console.log(`SLASH SLOT: ${slot}`);
                contract.slash(slot).then((response) => {
                    console.log(response);
                }).catch((error) => {
                    console.log(`ERROR: ${error}`);
                    setTimeout(slashSC, TIMEOUT_ERROR, urlNode, addressSC, walletJson, password, abi, oldCurrentSlot);
                });
            });
            setTimeout(slashSC, TIMEOUT_NEXT_LOOP, urlNode, addressSC, walletJson, password, abi, currentSlot);
        } catch (error) {
            console.log('ERROR: ', error);
            setTimeout(slashSC, TIMEOUT_ERROR, urlNode, addressSC, walletJson, password, abi, oldCurrentSlot);
        }
    }
}

module.exports = { slashSC };
