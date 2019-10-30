const fs = require('fs');
const chai = require('chai');
const path = require('path');
const { send } = require('../src/actions/offchain/send.js');
const { createWallet, deleteResources } = require('./config/build-resources');

const { expect } = chai;

const walletPathDefault = path.join(__dirname, './resources/wallet-test.json');

describe('Send', async function () {
    this.timeout(10000);
    const UrlOperator = 'http://127.0.0.1:9000';
    const idTo = 1;
    const amount = 10;
    let wallet;
    const password = 'foo';
    const tokenId = 0;
    const userFee = 10;
    const idFrom = 1;
    before(async () => {
        await createWallet();
        wallet = JSON.parse(await fs.readFileSync(walletPathDefault, 'utf8'));
    });

    it('Send test', () => send(UrlOperator, idTo, amount, wallet, password, tokenId, userFee, idFrom)
        .then((response) => {
            expect(response).to.be.equal(200);
        })).timeout(0);

    after(async () => {
        await deleteResources();
    });
});
