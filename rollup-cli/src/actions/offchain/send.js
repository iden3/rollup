/* eslint-disable no-restricted-syntax */
const { stringifyBigInts } = require('snarkjs');
const CliExternalOperator = require('../../../../rollup-operator/src/cli-external-operator');

// check the nonce from the operator and Nonce object and decide wich one use
async function _checkNonce(responseLeaf, currentBatch, nonceObject) {
    const nonceId = nonceObject.find((x) => x.idFrom === responseLeaf.data.idx);
    let nonce;
    if (nonceId !== undefined && nonceId.batch === currentBatch) { // only if the nonce object stores the nonce of the current batch
        nonce = nonceId.nonce;
    } else {
        nonce = responseLeaf.data.nonce;
    }
    const infoTx = { idFrom: responseLeaf.data.idx, currentBatch, nonce };
    return infoTx;
}

function _addNonce(nonceObject, currentBatch, nonce, idFrom) {
    const newNonce = nonce + 1;
    if (nonceObject !== undefined) {
        if (nonceObject.length > 0) {
            const nonceId = nonceObject.find((x) => x.idFrom === idFrom);
            if (nonceId !== undefined) {
                nonceObject = nonceObject.filter((x) => x.idFrom !== idFrom);
            }
        }
    } else {
        nonceObject = [];
    }
    nonceObject.push({ idFrom, batch: currentBatch, nonce: newNonce });
    return nonceObject;
}

/**
 * send off-chain transaction
 * @param {String} urlOperator - url from operator
 * @param {Number} idTo - receiver
 * @param {String} amount - amount to transfer
 * @param {Object} walletRollup - ethAddress and babyPubKey together
 * @param {Number} tokenId - token type identifier, the sender and the reciever must use the same token
 * @param {String} userFee - amount of fee that the user is willing to pay
 * @param {Number} idFrom - self balance tree identifier
 * @param {String} nonce - hardcoded from user
 * @param {Object} nonceObject - stored object wich keep tracking of the last transaction nonce sent by the client
 * @returns {Object} - return a object with the response status, current batch, current nonce, and nonceObject
*/
async function send(urlOperator, idTo, amount, walletRollup, tokenId, userFee, idFrom, nonce, nonceObject) {
    const apiOperator = new CliExternalOperator(urlOperator);
    const generalInfo = await apiOperator.getState();
    const currentBatch = generalInfo.data.rollup.lastBatchSynched;
    let nonceToSend;
    if (nonce !== undefined) nonceToSend = nonce;
    else {
        const responseLeaf = await apiOperator.getAccountByIdx(idFrom);
        if (nonceObject !== undefined) {
            const res = await _checkNonce(responseLeaf, currentBatch, nonceObject);
            nonceToSend = res.nonce;
        } else nonceToSend = responseLeaf.data.nonce;
    }
    const tx = {
        fromIdx: idFrom,
        toIdx: idTo,
        coin: tokenId,
        amount,
        nonce: nonceToSend,
        userFee,
        rqOffset: 0,
        onChain: 0,
        newAccount: 0,
    };
    walletRollup.signRollupTx(tx); // sign included in transaction
    const parseTx = stringifyBigInts(tx);// convert bigint to Strings
    const resTx = await apiOperator.sendTx(parseTx);
    let nonceObjectToWrite;
    if (resTx.status.toString() === '200') {
        nonceObjectToWrite = _addNonce(nonceObject, currentBatch, nonceToSend, idFrom);
    }
    const res = {
        status: resTx.status,
        currentBatch,
        nonce: nonceToSend,
        nonceObject: nonceObjectToWrite,
    };
    return res;
}

module.exports = { send };
