const fs = require('fs');
const chai = require('chai');
const { send } = require('../src/actions/offchain/send.js');

const { expect } = chai;

const walletPathDefault = '../src/resources/wallet.json';

describe('Send', () => {
    const UrlOperator = 'http://127.0.0.1:9000';
    const idTo = 1;
    const amount = 10;
    const wallet = JSON.parse(fs.readFileSync(walletPathDefault, 'utf8'));
    const password = 'foo';
    const tokenId = 0;
    const userFee = 10;
    const idFrom = 1;
    // walletBabyJub = fs.readFileSync("path", "utf8");

    it('Send test', () => send(UrlOperator, idTo, amount, wallet, password, tokenId, userFee, idFrom)
        .then((response) => {
            expect(response).to.be.equal(200);
        })).timeout(0);
});
