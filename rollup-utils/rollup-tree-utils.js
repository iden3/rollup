const {
    hash, padZeroes, arrayHexToBigInt, buildElement,
} = require("./utils");

function hashLeafValue(balance, tokenId, Ax, Ay, withdrawAddress, nonce) {
    // Build Entry
    // element 0
    const amountStr = padZeroes(balance.toString("16"), 4);
    const tokenStr = padZeroes(tokenId.toString("16"), 4);
    const withdrawStr = padZeroes(withdrawAddress.toString("16"), 40);
    const nonceStr = padZeroes(nonce.toString("16"), 8);
    const e1 = buildElement([nonceStr, withdrawStr, tokenStr, amountStr]);
    // element 1
    const e2 = buildElement([Ax.toString("16")]);
    // element 2
    const e3 = buildElement([Ay.toString("16")]);
    // Get array BigInt
    const entryBigInt = arrayHexToBigInt([e1, e2, e3]);
    // Object leaf
    const leafObj = {
        balance,
        tokenId,
        Ax,
        Ay,
        withdrawAddress,
        nonce,
    };
    // Hash entry and object
    return { leafObj, hash: hash(entryBigInt) };
}

function hashStateTree(balance, tokenId, Ax, Ay, ethAddress, nonce) {
    // Build Entry
    // element 0
    const tokenStr = padZeroes(tokenId.toString("16"), 8);
    const nonceStr = padZeroes(nonce.toString("16"), 12);
    const e0 = buildElement([nonceStr, tokenStr]);
    // element 1
    const e1 = buildElement([balance.toString("16")]);
    // element 2
    const e2 = buildElement([Ax.toString("16")]);
    // element 3
    const e3 = buildElement([Ay.toString("16")]);
    // element 4
    const e4 = buildElement([ethAddress.toString("16")]);
    // Get array BigInt
    const entryBigInt = arrayHexToBigInt([e0, e1, e2, e3, e4]);
    // Object leaf
    const leafObj = {
        balance,
        tokenId,
        Ax,
        Ay,
        ethAddress,
        nonce,
    };
    // Hash entry and object
    return { leafObj, elements: {e0, e1, e2, e3, e4}, hash: hash(entryBigInt) };
}

function hashExitLeafValue(id, amount, tokenId, withdrawAddress) {
    // Build Entry
    // element 0
    const idStr = padZeroes(id.toString("16"), 6);
    const amountStr = padZeroes(amount.toString("16"), 4);
    const tokenStr = padZeroes(tokenId.toString("16"), 4);
    const withdrawStr = padZeroes(withdrawAddress.toString("16"), 40);
    const e1 = buildElement([withdrawStr, tokenStr, amountStr, idStr]);
    // Get array BigInt
    const entryBigInt = arrayHexToBigInt([e1]);
    // Object leaf
    const leafObj = {
        id,
        amount,
        tokenId,
        withdrawAddress,
    };
    // Hash entry and object
    return { leafObj, hash: hash(entryBigInt) };
}


module.exports = {
    buildElement,
    hashLeafValue,
    hashExitLeafValue,
    hashStateTree,
};
