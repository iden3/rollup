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
 * @dev send off-chain transaction
 * @param urlOperator url from operator
 * @param idTo receiver
 * @param amount amount to transfer
 * @param walletRollup ethAddress and babyPubKey together
 * @param tokenId token type identifier, the sender and the reciever must use the same token
 * @param userFee amount of fee that the user is willing to pay
 * @param idFrom self balance tree identifier
 * @param nonce hardcoded from user
 * @param nonceObejct stored object wich keep tracking of the last transaction nonce sent by the client
*/
async function send(urlOperator, idTo, amount, walletRollup, tokenId, userFee, idFrom, nonce, nonceObject) {
    const apiOperator = new CliExternalOperator(urlOperator);
    const generalInfo = await apiOperator.getState();
    const currentBatch = generalInfo.data.rollupSynch.lastBatchSynched;
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
