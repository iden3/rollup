const chai = require("chai");
const { BabyJubWallet, verifyBabyJub } = require("../../rollup-utils/babyjub-wallet");

const { expect } = chai;

describe("BabyJubjub wallet", () => {
    const mnemonic = "urban add pulse prefer exist recycle verb angle sell year more mosquito";
    const privTest = "c72c427a1b6de6890c61254610ce2a5089b83fddab770177f1dc5fd574be39d3";
    const pass = "passphrase";
    let ax;
    let ay;
    let publicCompressed;

    it("Should create wallet from mnemonic", () => {
        const wallet = BabyJubWallet.fromMnemonic(mnemonic);
        expect(wallet.privateKey.toString("hex")).to.be.equal(privTest);
        ax = wallet.publicKey[0].toString("16");
        ay = wallet.publicKey[1].toString("16");
        publicCompressed = wallet.publicKeyCompressed.toString("hex");
    });

    it("Should create wallet from random", () => {
        const wallet = BabyJubWallet.createRandom();
        expect(wallet.privateKey.toString("hex")).to.not.be.equal(undefined);
        expect(wallet.publicKey[0].toString()).to.not.be.equal(undefined);
        expect(wallet.publicKey[1].toString()).to.not.be.equal(undefined);
        expect(wallet.publicKeyCompressed.toString("hex")).to.not.be.equal(undefined);
    });

    it("Should convert from-to json", () => {
        const wallet0 = BabyJubWallet.fromMnemonic(mnemonic);
        const priv0 = wallet0.privateKey.toString("hex");
        const json = wallet0.toEncryptedJson(pass);
        // import walllet from json generated
        const wallet1 = BabyJubWallet.fromEncryptedJson(json, pass);
        const priv1 = wallet1.privateKey.toString("hex");
        expect(priv0).to.be.equal(priv1);
        // import walllet from json generated with invalid passphrase
        const passInvalid = "passInvalid";
        try {
            BabyJubWallet.fromEncryptedJson(json, passInvalid);
        } catch (error) {
            expect((error.message).includes("invalid password")).to.be.equal(true);
        }
    });

    it("Should get public key from encrypted json", () => {
        const wallet = BabyJubWallet.fromMnemonic(mnemonic);
        const jsonEnc = wallet.toEncryptedJson(pass);
        const jsonObj = JSON.parse(jsonEnc);
        expect(publicCompressed).to.be.equal(jsonObj.publicCompressed);
        expect(ax).to.be.equal(jsonObj.public.ax);
        expect(ay).to.be.equal(jsonObj.public.ay);
    });

    it("Should sign-verify message", () => {
        const wallet = BabyJubWallet.fromMnemonic(mnemonic);
        const msg = "Lorem ipsum dolor sit amet, consectetur adipiscing elit, "
      + "sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.";
        const signatureHex = wallet.signMessage(msg);
        // Check signature
        const pubKeyCompressHex = wallet.publicKeyCompressed.toString("hex");
        let verify = verifyBabyJub(pubKeyCompressHex, msg, signatureHex);
        expect(verify).to.be.equal(true);
        verify = verifyBabyJub(pubKeyCompressHex, `${msg}Invalid`, signatureHex);
        expect(verify).to.be.equal(false);
    });
});
