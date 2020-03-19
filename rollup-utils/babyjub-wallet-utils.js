const cryptoLib = require("crypto");

/**
 * Get Hmac
 * @param {Buffer} keyBuff - key used to encrypt private key
 * @param {Buffer} encryptedDataBuff - represents private key encrypted
 * @returns {String} Hmac encoded as base64 string  
 */
function getMac(keyBuff, encryptedDataBuff) {
    const concatBuff = Buffer.concat([keyBuff.slice(0, 16), encryptedDataBuff]);
    return cryptoLib.createHmac("sha256", concatBuff.toString("base64")).digest("base64");
}

/**
 * Computes key to encrypt from a given password
 * @param {String} pass - password
 * @param {String} salt - 16 bytes encoded as base64 string
 * @param {Number} iterations - number of iterations 
 * @param {Number} keyLen - key length  
 * @param {String} digest - hash to use
 * @returns {String} - computed key encoded as base64
 */
function passToKey(pass, salt, iterations, keyLen, digest) {
    const key = cryptoLib.pbkdf2Sync(pass, salt, iterations, keyLen, digest);
    return key.toString("base64");
}

/**
 * Check key and encrypted data macthes mac provided
 * @param {String} key - key encoded as base64 
 * @param {String} encryptedData - encrypted data encoded as base64 
 * @param {String} mac - mac to check encoded as base62 string
 */
function checkPass(key, encryptedData, mac) {
    const keyBuff = Buffer.from(key, "base64");
    const encryptedDataBuff = Buffer.from(encryptedData, "base64");
    const macCalc = getMac(keyBuff, encryptedDataBuff);
    if (macCalc !== mac) {
        throw new Error("invalid password");
    }
}

/**
 * Decrypts encrypted data with a given key
 * @param {String} key - key to decrypt
 * @param {String} encryptedData - data encrypted 
 * @param {String} algo - algorithm used
 * @param {Buffer} iv - initilaization vector
 * @returns {String} - utf8 String clear data
 */
function decrypt(key, encryptedData, algo, iv) {
    const decipher = cryptoLib.createDecipheriv(algo, key, iv);
    let decrypted = decipher.update(encryptedData, "base64", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
}

/**
 * Encrypt data with a given key
 * @param {String} key - key to encrypt
 * @param {String} msg - clear data 
 * @param {String} algo - algorithm used
 * @param {Buffer} iv - initilaization vector
 * @returns {String} - base64 encrypted data
 */
function encrypt(key, msg, algo, iv) {
    const cipher = cryptoLib.createCipheriv(algo, key, iv);
    let encrypted = cipher.update(msg, "utf8", "base64");
    encrypted += cipher.final("base64");
    return encrypted;
}

module.exports = {
    getMac,
    passToKey,
    checkPass,
    decrypt,
    encrypt,
};
