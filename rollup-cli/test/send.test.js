const fs = require('fs');
const { expect } = require('chai');
const path = require('path');

const { send } = require('../src/actions/offchain/send.js');
const { createWallet, deleteResources } = require('./config/build-resources');
const { Wallet } = require('../src/wallet');

const walletPathDefault = path.join(__dirname, './resources/wallet-test.json');

describe('Send', async function () {
    this.timeout(10000);
    const UrlOperator = 'http://127.0.0.1:9000';
    const babyjubTo = ['0x12', '0x23'];
    const amount = 10;
    let wallet;
    const password = 'foo';
    const tokenId = 0;
    const userFee = 10;

    before(async () => {
        await createWallet();
        wallet = JSON.parse(await fs.readFileSync(walletPathDefault, 'utf8'));
    });

    it('Should call send', async () => {
        const walletRollup = await Wallet.fromEncryptedJson(wallet, password);
        const res = await send(UrlOperator, babyjubTo, amount, walletRollup, tokenId, userFee);
        expect(res.status).to.be.equal(200);
    });

    after(async () => {
        await deleteResources();
    });
});
