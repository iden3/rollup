const cryptoLib = require("crypto");

function getMac(keyBuff, encryptedDataBuff) {
    const concatBuff = Buffer.concat([keyBuff.slice(0, 16), encryptedDataBuff]);
    return cryptoLib.createHmac("sha256", concatBuff.toString()).digest("base64");
}

function passToKey(pass, salt, iterations, keyLen, digest) {
    const key = cryptoLib.pbkdf2Sync(pass, salt, iterations, keyLen, digest);
    return key.toString("base64");
}

function checkPass(key, encryptedData, mac) {
    const keyBuff = Buffer.from(key, "base64");
    const encryptedDataBuff = Buffer.from(encryptedData, "base64");
    const macCalc = getMac(keyBuff, encryptedDataBuff);
    if (macCalc !== mac) {
        throw new Error("invalid password");
    }
}

function decrypt(key, encryptedData, algo, iv) {
    const decipher = cryptoLib.createDecipheriv(algo, key, iv);
    let decrypted = decipher.update(encryptedData, "base64", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
}

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
