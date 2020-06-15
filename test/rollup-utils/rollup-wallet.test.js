const chai = require("chai");
const { RollupWallet } = require("../../rollup-utils/rollup-wallet");
const { verifyEthereum, verifyRollup } = require("../../rollup-utils/rollup-wallet-utils");
const { verifyTxSig } = require("../../js/utils");

const { expect } = chai;

describe("Rollup wallet", function () {
    this.timeout(10000);
    const mnemonic = "maximum direct solution mushroom before meat public bean board frown announce lawn";
    const pass = "passphrase";

    const rollupPrivateKeyCheck = "b1bbe3b210f0343f9647b2f1c15f8e390aecbd98b79a672989f8b0b562f15eb7";
    const rollupAddressCheck = "0x713b65a7004bfd00b092b63bd5a851006097fd4847e38de31a034ef6b1d2329a";

    it("from mnemonic", async () => {
        const wallet = await RollupWallet.fromMnemonic(mnemonic);
        const rollupAddress = wallet.rollupAddress();
        expect(wallet.rollupPrivateKey.toString("hex")).to.be.equal(rollupPrivateKeyCheck);
        expect(rollupAddress).to.be.equal(rollupAddressCheck);
    });

    it("from random", async () => {
        const wallet = await RollupWallet.createRandom();

        expect(wallet.ethAddress()).to.not.be.equal(undefined);
        expect(wallet.ax()).to.not.be.equal(undefined);
        expect(wallet.ay()).to.not.be.equal(undefined);
        expect(wallet.rollupAddress()).to.not.be.equal(undefined);
    });

    it("from-to json", async () => {
        const wallet0 = await RollupWallet.fromMnemonic(mnemonic);
        const priv0 = wallet0.rollupPrvKey;
        const json = await wallet0.toEncryptedJson(pass);

        // import walllet from json generated
        const wallet1 = await RollupWallet.fromEncryptedJson(json, pass);
        const priv1 = wallet1.rollupPrvKey;
        
        // Check equal private key derived
        expect(priv0).to.be.equal(priv1);

        // import wallet from json generated with invalid passphrase
        const passInvalid = "passInvalid";
        try {
            await RollupWallet.fromEncryptedJson(json, passInvalid);
        } catch (error) {
            expect((error.message).includes("invalid password")).to.be.equal(true);
        }
    });

    it("sign-verify ethereum", async () => {
        const wallet = await RollupWallet.fromMnemonic(mnemonic);
        const msg = "Lorem ipsum dolor sit amet, consectetur adipiscing elit, "
        + "sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.";
        const signatureHex = await wallet.signEthereumMessage(msg);
        let verify = await verifyEthereum(wallet.ethAddress(), msg, signatureHex);
        expect(verify).to.be.equal(true);
        verify = await verifyEthereum(wallet.ethAddress(), `${msg}Invalid`, signatureHex);
        expect(verify).to.be.equal(false);
    });

    it("sign-verify rollup", async () => {
        const wallet = await RollupWallet.fromMnemonic(mnemonic);
        const msg = "Lorem ipsum dolor sit amet, consectetur adipiscing elit, "
        + "sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.";
        const signatureHex = wallet.signRollupMessage(msg);
        // Check signature
        const pubKeyCompressHex = wallet.rollupAddress();
        let verify = verifyRollup(pubKeyCompressHex, msg, signatureHex);
        expect(verify).to.be.equal(true);
        verify = verifyRollup(pubKeyCompressHex, `${msg}Invalid`, signatureHex);
        expect(verify).to.be.equal(false);
    });

    it("sign-verify rollup transaction", async () => {
        const wallet = await RollupWallet.fromMnemonic(mnemonic);
        
        const tx = {
            toAx: wallet.ax(),
            toAy: wallet.ay(),
            toEthAddr: wallet.ethAddress(),
            coin: 0,
            amount: 500,
            nonce: 0,
            fee: 4
        };

        wallet.signRollupTx(tx);

        expect(tx.fromAx).to.be.equal(wallet.ax());
        expect(tx.fromAy).to.be.equal(wallet.ay());
        expect(tx.fromEthAddr).to.be.equal(wallet.ethAddress());

        expect(tx.r8x).to.be.not.equal(undefined);
        expect(tx.r8y).to.be.not.equal(undefined);
        expect(tx.s).to.be.not.equal(undefined);

        // Verify transaction
        const res = verifyTxSig(tx);
        expect(res).to.be.equal(true);
    });
});