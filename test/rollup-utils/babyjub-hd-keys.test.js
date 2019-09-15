const chai = require("chai");
const babyKeys = require("../../rollup-utils/babyjub-hd-keys");
const eddsa = require("../../rollup-utils/eddsa-babyjub");

const { expect } = chai;

describe("BabyJubjub key generation", () => {
    const mnemonic = "urban add pulse prefer exist recycle verb angle sell year more mosquito";
    const privTest0 = "c72c427a1b6de6890c61254610ce2a5089b83fddab770177f1dc5fd574be39d3";
    const privTest1 = "e26a07ed01c9784622200d4f40008dfd8b1163f11d250886c5f6a37a10df8a9f";

    it("from mnemonic", () => {
        const hdKeys = babyKeys.fromMnemonic(mnemonic);
        const priv0 = hdKeys.getPrivate(0);
        const priv1 = hdKeys.getPrivate(1);
        expect(priv0.toString("hex")).to.be.equal(privTest0);
        expect(priv1.toString("hex")).to.be.equal(privTest1);
    });

    it("from random", () => {
        const hdKeys = babyKeys.fromRandom();
        const pubPoint = hdKeys.getPublic(0);
        const pubCompressed = hdKeys.getPublic(0, true);
        const priv = new eddsa.PrivateKey(hdKeys.getPrivate(0));
        expect(priv.public().p[0].toString()).to.be.equal(pubPoint[0].toString());
        expect(priv.public().p[1].toString()).to.be.equal(pubPoint[1].toString());
        expect(priv.public().compress().toString()).to.be.equal(pubCompressed.toString());
    });

    it("from / to ethereum extended private key", () => {
        const hdKeys = babyKeys.fromMnemonic(mnemonic);
        const ethPriv = hdKeys.getEthExtendedPrivate();
        const ethAddress = hdKeys.getEthAddress();

        const hdKeys1 = babyKeys.fromEthExtendedPriv(ethPriv);
        const ethAddress1 = hdKeys1.getEthAddress();
        expect(ethAddress).to.be.equal(ethAddress1);
    });
});
