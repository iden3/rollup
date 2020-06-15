const ethers = require("ethers");
const eddsaBabyJub = require("./eddsa-babyjub");
const { hashBuffer } = require("./utils");

const ROLLUP_MESSAGE = "Login to iden3 zkRollup";

/**
 * To verify ethereum signature
 * @param {String} address
 * @param {String} messStr
 * @param {String} signatureHex
 * @returns {Boolean}
 */
function verifyEthereum(address, messStr, signatureHex) {
    const extractAddress = ethers.utils.verifyMessage(messStr, signatureHex);
    return address === extractAddress;
}

/**
 * Verifies signature for a given message using babyjubjub
 * @param {String} publicKeyHex - Babyjubjub public key encoded as hex string
 * @param {String} messStr - clear message data
 * @param {String} signatureHex - Ecdsa signature compresed and encoded as hex string 
 * @returns {boolean} True if validation is succesfull; otherwise false
 */
function verifyRollup(publicKeyHex, messStr, signatureHex) {
    if (publicKeyHex.substr(0, 2) === "0x")
        publicKeyHex = publicKeyHex.substr(2);

    const pkBuff = Buffer.from(publicKeyHex, "hex");
    const pk = eddsaBabyJub.PublicKey.newFromCompressed(pkBuff);
    const msgBuff = Buffer.from(messStr);
    const hash = hashBuffer(msgBuff);
    const sigBuff = Buffer.from(signatureHex, "hex");
    const sig = eddsaBabyJub.Signature.newFromCompressed(sigBuff);
    return pk.verifyPoseidon(hash, sig);
}

module.exports = {
    ROLLUP_MESSAGE,
    verifyEthereum,
    verifyRollup
};