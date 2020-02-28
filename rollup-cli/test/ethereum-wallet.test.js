const chai = require('chai');
const { EthereumWallet, verifyEthereum } = require('../src/ethereum-wallet');

const { expect } = chai;

describe('Ethereum wallet', function () {
    this.timeout(10000);
    const mnemonic = 'maximum direct solution mushroom before meat public bean board frown announce lawn';
    const privTest = '0x1f07e59e1c8f9406a89d461fcc6d1044485c5960ba7fe123c67a8b0bbf115524';
    const pass = 'passphrase';

    it('from mnemonic', () => {
        const wallet = EthereumWallet.fromMnemonic(mnemonic);
        expect(wallet.privateKey).to.be.equal(privTest);
    });

    it('from random', () => {
        const wallet = EthereumWallet.createRandom();
        expect(wallet.mnemonic).to.not.be.equal(undefined);
        expect(wallet.privateKey).to.not.be.equal(undefined);
        expect(wallet.publicKey).to.not.be.equal(undefined);
        expect(wallet.address).to.not.be.equal(undefined);
        expect(wallet.publicKeyCompressed).to.not.be.equal(undefined);
    });

    it('from-to json', async () => {
        const wallet0 = EthereumWallet.fromMnemonic(mnemonic);
        const priv0 = wallet0.privateKey;
        const json = await wallet0.toEncryptedJson(pass);
        // import walllet from json generated
        const wallet1 = await EthereumWallet.fromEncryptedJson(json, pass);
        const priv1 = wallet1.privateKey;
        expect(priv0).to.be.equal(priv1);
        // import walllet from json generated with invalid passphrase
        const passInvalid = 'passInvalid';
        try {
            await EthereumWallet.fromEncryptedJson(json, passInvalid);
        } catch (error) {
            expect((error.message).includes('invalid password')).to.be.equal(true);
        }
    });

    it('sign-verify message', async () => {
        const wallet = EthereumWallet.fromMnemonic(mnemonic);
        const msg = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, '
      + 'sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.';
        const signatureHex = await wallet.signMessage(msg);
        let verify = await verifyEthereum(wallet.publicKey, msg, signatureHex);
        expect(verify).to.be.equal(true);
        verify = await verifyEthereum(wallet.publicKey, `${msg}Invalid`, signatureHex);
        expect(verify).to.be.equal(false);
    });
});
