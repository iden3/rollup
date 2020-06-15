const chai = require('chai');
const { Wallet, verifyMessageBabyJub, verifyMessageEthereum } = require('../../src/utils/wallet');

const { expect } = chai;

describe('Wallet', function () {
    this.timeout(10000);

    const mnemonic = 'maximum direct solution mushroom before meat public bean board frown announce lawn';
    const privTestEth = '0x1f07e59e1c8f9406a89d461fcc6d1044485c5960ba7fe123c67a8b0bbf115524';
    const privTestBabyjub = '7436d936f531fa2cf0c3b1ef6f0635ba19831e62bce6999da31423813e66135c';
    const pass = 'passphrase';

    it('from mnemonic', async () => {
        const wallet = await Wallet.fromMnemonic(mnemonic);
        expect(wallet.babyjubWallet.privateKey.toString('hex')).to.be.equal(privTestBabyjub);
        expect(wallet.ethWallet.privateKey).to.be.equal(privTestEth);
    });

    it('from random', async () => {
        const wallet = await Wallet.createRandom();
        expect(wallet.ethWallet).to.not.be.equal(undefined);
        expect(wallet.babyjubWallet).to.not.be.equal(undefined);
    });

    it('from-to json', async () => {
        const wallet0 = await Wallet.fromMnemonic(mnemonic);
        const priv0eth = wallet0.ethWallet.privateKey;
        const priv0babyjub = wallet0.babyjubWallet.privateKey;
        const json = await wallet0.toEncryptedJson(pass);
        // import walllet from json generated
        const wallet1 = await Wallet.fromEncryptedJson(json, pass);
        const priv1eth = wallet1.ethWallet.privateKey;
        const priv1babyjub = wallet1.babyjubWallet.privateKey;
        expect(priv0babyjub.toString('hex')).to.be.equal(priv1babyjub.toString('hex'));
        expect(priv0eth).to.be.equal(priv1eth);
        // import walllet from json generated with invalid passphrase
        const passInvalid = 'passInvalid';
        try {
            await Wallet.fromEncryptedJson(json, passInvalid);
        } catch (error) {
            expect((error.message).includes('invalid password')).to.be.equal(true);
        }
    });

    it('sign-verify message Ethereum', async () => {
        const wallet = await Wallet.fromMnemonic(mnemonic);
        const msg = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, '
      + 'sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.';
        const signatureHex = await wallet.signMessageEthereum(msg);
        let verify = await verifyMessageEthereum(wallet.ethWallet.publicKey, msg, signatureHex);
        expect(verify).to.be.equal(true);
        verify = await verifyMessageEthereum(wallet.ethWallet.publicKey, `${msg}Invalid`, signatureHex);
        expect(verify).to.be.equal(false);
    });

    it('sign-verify message Babyjub', async () => {
        const wallet = await Wallet.fromMnemonic(mnemonic);
        const msg = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, '
      + 'sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.';
        const signatureHex = wallet.signMessageBabyJub(msg);
        // Check signature
        const pubKeyCompressHex = wallet.babyjubWallet.publicKeyCompressed.toString('hex');
        let verify = verifyMessageBabyJub(pubKeyCompressHex, msg, signatureHex);
        expect(verify).to.be.equal(true);
        verify = verifyMessageBabyJub(pubKeyCompressHex, `${msg}Invalid`, signatureHex);
        expect(verify).to.be.equal(false);
    });
});
