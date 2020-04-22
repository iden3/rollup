const eddsa = require("circomlib").eddsa;
const crypto = require("crypto");
const web3 = require("web3");
const Scalar = require("ffjavascript").Scalar;

const {
    hash, padZeroes, buildElement, arrayHexToBigInt, num2Buff,
} = require("./utils");
const { fix2float } = require("../js/utils");


/**
 * Simulate off-chain transaction hash
 * @param {Number} numTx - number of off-chain transaction to add
 * @returns {Object} - Contains raw bytes of off-chain transaction and it hash 
 */
function createOffChainTx(numTx) {
    // create bunch of tx
    let buffTotalTx = Buffer.alloc(0);
    let hashTotal = 0;
    for (let i = 0; i < numTx; i++) {
        const from = Scalar.e(i).toString("16");
        const to = Scalar.e(i).toString("16");
        const amount = Scalar.e(i).toString("16");

        const fromBuff = Buffer.from(padZeroes(from, 6), "hex");
        const toBuff = Buffer.from(padZeroes(to, 6), "hex");
        const amoutBuff = Buffer.from(padZeroes(amount, 4), "hex");

        const txBuff = Buffer.concat([fromBuff, toBuff, amoutBuff]);
        buffTotalTx = Buffer.concat([buffTotalTx, txBuff]);

        // Caculate hash to check afterwards
        const e1 = Scalar.fromString(`0x${txBuff.toString("hex")}`, 16);
        const hashTmp = hash([e1, 0, 0, 0, 0]);
        hashTotal = hash([hashTotal, hashTmp]);
    }
    const bytesTx = `0x${buffTotalTx.toString("hex")}`;

    return { bytesTx, hashOffChain: hashTotal };
}

/**
 * Calculate hash of off-chain transactions data
 * @param {String} hexOffChainTx - Raw data containing all off-chain transactions
 * @returns {BigInt} - Hash of off-chain transactions
 */
function hashOffChainTx(hexOffChainTx) {
    // remove '0x'
    const hexOffChain = hexOffChainTx.substring(2);
    const numTx = hexOffChain.length / 16;
    let hashTotal = Scalar.e(0);

    let tmpStr = "";
    for (let i = 0; i < numTx; i++) {
        tmpStr = hexOffChain.substring(i * 16, (i + 1) * 16);
        const hashTmp = hash([Scalar.fromString(`0x${tmpStr.toString("hex")}`, 16)]);
        hashTotal = hash([hashTotal, hashTmp]);
    }
    return hashTotal;
}

/**
 * Get raw off-chain transaction in hex string
 * @param {Number} from - sender identifier
 * @param {Number} to - recipient identifier
 * @param {Number} amount - amount sent
 * @returns {Buffer} - Raw off-chain transaction data
 */
function buildOffChainTx(from, to, amount) {
    return Buffer.concat([
        num2Buff(from, 3), 
        num2Buff(to, 3), 
        num2Buff(amount, 2)
    ]);
}

/**
 * Hash deposit leaf
 * @param {BigInt} id - account identifier
 * @param {BigInt} balance - account balance
 * @param {BigInt} tokenId - token identifier
 * @param {BigInt} Ax - X point babyjubjub
 * @param {BigInt} Ay - Y point babyjubjub
 * @param {BigInt} withdrawAddress - ethereum address 
 * @param {BigInt} nonce - nonce
 * @returns {BigInt} - hash of the state
 */
function hashDeposit(id, balance, tokenId, Ax, Ay, withdrawAddress, nonce) {
    // Build Entry
    // element 0
    const idStr = padZeroes(id.toString("16"), 6);
    const amountStr = padZeroes(balance.toString("16"), 4);
    const tokenStr = padZeroes(tokenId.toString("16"), 4);
    const withdrawStr = padZeroes(withdrawAddress.toString("16"), 40);
    const e1 = buildElement([withdrawStr, tokenStr, amountStr, idStr]);
    // element 1
    const nonceStr = padZeroes(nonce.toString("16"), 8);
    const e2 = buildElement([nonceStr]);
    // element 2
    const e3 = buildElement([Ax.toString("16")]);
    // element 3
    const e4 = buildElement([Ay.toString("16")]);
    // Get array BigInt
    const entryBigInt = arrayHexToBigInt([e1, e2, e3, e4]);

    // Hash entry and object
    return hash(entryBigInt);
}

/**
 * Encode rollup transaction
 * @param {Number} fromId - sender
 * @param {Number} toId - recipient 
 * @param {Number} amount - amount sent
 * @param {Number} token - token identifier
 * @param {Number} nonce - nonce
 * @param {Number} maxFee - max fee
 * @param {Number} rqOffset - request offset (atomic transactions)
 * @param {Bool} onChain - if the transaction has been created on-chain
 * @param {Bool} newAccount - if the transaction represents a new account
 * @returns {String} - transaction encoded as hexadecimal string 
 */
function buildTxData(fromId, toId, amount, token, nonce, maxFee, rqOffset, onChain, newAccount) {
    // Build Elemnt Tx Data
    // element 0
    const fromStr = fromId ? padZeroes(fromId.toString("16"), 16) : padZeroes("", 16);
    const toStr = toId ? padZeroes(toId.toString("16"), 16) : padZeroes("", 16);
    const amountStr = amount ? padZeroes(fix2float(amount).toString("16"), 4) : padZeroes("", 4);
    const tokenStr = token ? padZeroes(token.toString("16"), 8) : padZeroes("", 8);
    const nonceStr = nonce ? padZeroes(nonce.toString("16"), 12) : padZeroes("", 12);
    const maxFeeStr = maxFee ? padZeroes(fix2float(maxFee).toString("16"), 4) : padZeroes("", 4);
    let last = rqOffset ? (rqOffset & 0x07) : 0x00;
    last = onChain ? ( last | 0x08 ): last;
    last = newAccount ? ( last | 0x10 ): last;
    const element = buildElement([last.toString("16"), maxFeeStr,
        nonceStr, tokenStr, amountStr, toStr, fromStr]);
    return element;
}

/**
 * Simulates on-chain hash for on-chain transactions
 * @param {BigInt} oldOnChainHash - previous on.chain hash
 * @param {BigInt} txData - transaction data encoded
 * @param {BigInt} loadAmount - amount loaded
 * @param {BigInt} ethAddress - athereum address
 * @param {BigInt} Ax - X point babyjubjub
 * @param {BigInt} Ay - Y point babyjubjub
 * @returns {Object} - Contains Entry elememnts and its hash value
 */
function hashOnChain(oldOnChainHash, txData, loadAmount, ethAddress, Ax, Ay) {
    // Build Entry
    // element 0
    const e0 = buildElement([oldOnChainHash.toString("16")]);
    // element 1
    const e1 = buildElement([txData.toString("16")]);
    // element 2
    const e2 = buildElement([loadAmount.toString("16")]);
    // element 3
    const e3 = buildElement([ethAddress.toString("16")]); 
    // element 4
    const e4 = buildElement([Ax.toString("16")]);
    // element 5
    const e5 = buildElement([Ay.toString("16")]);
    
    // Get array BigInt
    const entryBigInt = arrayHexToBigInt([e0, e1, e2, e3, e4, e5]);
    // Hash entryobject
    return { elements: {e0, e1, e2, e3, e4, e5}, hash: hash(entryBigInt)};
}

/**
 * Sign rollup transaction and add signature to transaction
 * @param {Object} walletBabyJub - Rerpresents a babyjubjub wallet which will sign the rollup transaction 
 * @param {Object} tx - Rollup transaction 
 */
function signRollupTx(walletBabyJub, tx) {
    const IDEN3_ROLLUP_TX = Scalar.e("1625792389453394788515067275302403776356063435417596283072371667635754651289");
    const data = buildTxData(tx.fromIdx, tx.toIdx, tx.amount, tx.coin, tx.nonce,
        tx.userFee, tx.rqOffset, tx.onChain, tx.newAccount);

    const h = hash([
        IDEN3_ROLLUP_TX,
        data,
        tx.rqData || 0
    ]);
    const signature = eddsa.signPoseidon(walletBabyJub.privateKey.toString("hex"), h);
    tx.r8x = signature.R8[0];
    tx.r8y = signature.R8[1];
    tx.s = signature.S;
    tx.ax = walletBabyJub.publicKey[0].toString(16);
    tx.ay = walletBabyJub.publicKey[1].toString(16);
}

/**
 * Build feePlanCoins and feePlanFees from feePlan array
 * @param {Array} feePlan - fee plan
 * @returns {Array} - feePlanCoin at index 0 and feePlanFees at index 1 
 */
function buildFeeInputSm(feePlan) {
    if (feePlan == undefined) return ["0", "0"];
    if (feePlan.length > 16){
        throw new Error("Not allowed more than 16 coins with fee");
    }
    let feePlanCoins = Scalar.e(0);
    let feePlanFees = Scalar.e(0);
    for (let i = 0; i < feePlan.length; i++) {
        feePlanCoins = Scalar.add(feePlanCoins, Scalar.shl(feePlan[i][0], 16*i));
        feePlanFees = Scalar.add(feePlanFees, Scalar.shl(feePlan[i][1], 16*i));
    }
    return [feePlanCoins.toString(), feePlanFees.toString()];
}

/**
 * Gets seed from private key
 * @param {String} pvk - private Key
 * @returns {String} - seed 
 */
function getSeedFromPrivKey(pvk){
    const IDEN3_ROLLUP_SEED = "IDEN3_ROLLUP_SEED";
    const seed = `${pvk}${IDEN3_ROLLUP_SEED}`;
    const hash = crypto.createHash("sha256");
    hash.update(seed);
    return hash.digest("hex");
}

/**
 * Compute hashchain from seed
 * @param {String} seed - seed
 * @returns {Array} - Hash chain array 
 */
function loadHashChain(seed){
    const hashChain = [];
    const hashChainLength = Math.pow(2, 16);
    hashChain.push(web3.utils.keccak256(seed));
    for (let i = 1; i < hashChainLength; i++) {
        hashChain.push(web3.utils.keccak256(hashChain[i - 1]));
    }
    return hashChain;
}

module.exports = {
    createOffChainTx,
    hashDeposit,
    hashOffChainTx,
    buildOffChainTx,
    buildTxData,
    hashOnChain,
    signRollupTx,
    buildFeeInputSm,
    getSeedFromPrivKey,
    loadHashChain,
};