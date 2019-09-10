const crypto = require("crypto");
const createBlakeHash = require("blake-hash");
const { babyJub, eddsa } = require("circomlib");
const { bigInt } = require("snarkjs");


/**
 * Class representing EdDSA Baby Jub signature
 */
class Signature {
    /**
   * Create a Signature with the R8 point and S scalar
   * @param {Array[bigInt]} r8 - R8 point
   * @param {bigInt} s - Scalar
   */
    constructor(r8, s) {
        this.r8 = r8;
        this.s = s;
    }

    /**
   * Create a Signature from a compressed Signature Buffer
   * @param {Buffer} buf - Buffer containing a signature
   * @returns {Signature} Object signature
   */
    static newFromCompressed(buf) {
        if (buf.length !== 64) {
            throw new Error("buf must be 64 bytes");
        }
        const sig = eddsa.unpackSignature(buf);
        if (sig.R8 == null) {
            throw new Error("unpackSignature failed");
        }
        return new Signature(sig.R8, sig.S);
    }

    /**
   * Take the signature and pack it into a buffer
   * @returns {Buffer} - Signature compressed
   */
    compress() {
        return eddsa.packSignature({ R8: this.r8, S: this.s });
    }

    /**
   * Take the signature and pack it into an hex encoding
   * @returns {string} - hex encoding of the signature
   */
    toString() {
        return this.compress().toString("hex");
    }
}

/**
 * Class representing a EdDSA baby jub public key
 */
class PublicKey {
    /**
   * Create a PublicKey from a curve point p
   * @param {Array[bigInt]} p - curve point
   */
    constructor(p) {
        this.p = p;
    }

    /**
   * Create a PublicKey from a compressed PublicKey Buffer
   * @param {Buffer} buff - compressed public key in a buffer
   * @returns {PublicKey} public key class
   */
    static newFromCompressed(buf) {
        if (buf.length !== 32) {
            throw new Error("buf must be 32 bytes");
        }
        // const bufLE = utils.swapEndianness(buf);
        const p = babyJub.unpackPoint(buf);
        if (p == null) {
            throw new Error("unpackPoint failed");
        }
        return new PublicKey(p);
    }

    /**
   * Compress the PublicKey
   * @returns {Buffer} - point compressed into a buffer
   */
    compress() {
    // return utils.swapEndianness(babyJub.packPoint(this.p));
        return babyJub.packPoint(this.p);
    }

    /**
   * Compress the PublicKey
   * @returns {string} - hex encoding of the compressed public key
   */
    toString() {
        return this.compress().toString("hex");
    }

    /**
   * Verify the signature of a bigInt message using mimc7 hash
   * @param {bigInt} msg - message to verify
   * @param {Signature} sig - signature to check
   * @returns {boolean} True if validation is succesfull; otherwise false
   */
    verifyMimc7(msg, sig) {
        return eddsa.verifyMiMC(msg, { R8: sig.r8, S: sig.s }, this.p);
    }

    /**
   * Verify the signature of a bigInt message using Poseidon hash
   * @param {bigInt} msg - message to verify
   * @param {Signature} sig - signature to check
   * @returns {boolean} True if validation is succesfull; otherwise false
   */
    verifyPoseidon(msg, sig) {
        return eddsa.verifyPoseidon(msg, { R8: sig.r8, S: sig.s }, this.p);
    }
}

/**
 * Class representing EdDSA Baby Jub private key
 */
class PrivateKey {
    /**
   * Create a PirvateKey from a 32 byte Buffer
   * @param {Buffer} buf - private key
   */
    constructor(buf) {
        if (buf.length !== 32) {
            throw new Error("buf must be 32 bytes");
        }
        this.sk = buf;
    }

    /**
   * Create a random PrivateKey
   * @returns {PrivateKey} PrivateKey class created from a random private key
   */
    static newRandom() {
        const buf = crypto.randomBytes(Math.floor(256 / 8));
        return new PrivateKey(buf);
    }

    /**
   * Return the PrivateKey in hex encoding
   * @returns {string} hex string representing the private key
   */
    toString() {
        return this.sk.toString("hex");
    }

    /**
   * Retrieve PublicKey of the PrivateKey
   * @returns {PublicKey} PublicKey derived from PrivateKey
   */
    public() {
        return new PublicKey(eddsa.prv2pub(this.sk));
    }

    /**
   * Retrieve private scalar of the PrivateKey
   * @returns {bigInt} Prvate scalar derived from PrivateKey
   */
    toPrivScalar() {
        const h1 = createBlakeHash("blake512").update(this.sk).digest();
        const sBuff = eddsa.pruneBuffer(h1.slice(0, 32));
        return (bigInt.leBuff2int(sBuff)).shr(3);
    }

    /**
   * Sign a bigInt message using mimc7 hash
   * @param {bigInt} msg - message to sign
   * @returns {Signature} Signature generated
   */
    signMimc7(msg) {
        const s = eddsa.signMiMC(this.sk, msg);
        return new Signature(s.R8, s.S);
    }


    /**
   * Sign a bigInt message using Poseidon hash
   * @param {bigInt} msg - message to sign
   * @returns {Signature} Signature generated
   */
    signPoseidon(msg) {
        const s = eddsa.signPoseidon(this.sk, msg);
        return new Signature(s.R8, s.S);
    }
}

module.exports = {
    Signature,
    PublicKey,
    PrivateKey,
};
