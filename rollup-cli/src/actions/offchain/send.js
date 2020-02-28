/* eslint-disable no-restricted-syntax */
const { stringifyBigInts } = require('snarkjs');
const CliExternalOperator = require('../../../../rollup-operator/src/cli-external-operator');

async function _checkNonce(responseLeaf, currentBatch, nonceObject) {
    const batchID = nonceObject.filter((x) => x.fromId === responseLeaf.data.idx);
    let nonce;
    if (batchID.length > 0 && batchID[0].batch === currentBatch) {
        nonce = batchID[0].nonce;
    } else {
        nonce = responseLeaf.data.nonce;
    }
    const infoTx = { fromId: responseLeaf.data.idx, currentBatch, nonce };
    return infoTx;
}

function _addNonce(nonceObject, currentBatch, nonce, fromId) {
    const newNonce = nonce + 1;
    if (nonceObject !== undefined) {
        if (nonceObject.length > 0) {
            const batchID = nonceObject.filter((x) => x.fromId === fromId);
            if (batchID.length > 0) {
                nonceObject = nonceObject.filter((x) => x.fromId !== fromId);
            }
        }
    } else {
        nonceObject = [];
    }
    nonceObject.push({ fromId, batch: currentBatch, nonce: newNonce });
    return nonceObject;
}

/**
 * @dev sends off-chain transaction
 * @param urlOperator url from operator
 * @param idTo receiver
 * @param amount initial balance on balance tree
 * @param walletJson from this one can obtain the ethAddress and babyPubKey
 * @param password for decrypt the Wallet
 * @param tokenId token type identifier, the sender and the reciever must use the same token
 * @param userFee amount of fee that the user is willing to pay
 * @param idFrom Self balance tree identifier
*/
async function send(urlOperator, idTo, amount, walletRollup, tokenId, userFee, fromId, nonce, nonceObject) {
    const apiOperator = new CliExternalOperator(urlOperator);
    const generalInfo = await apiOperator.getState();
    const currentBatch = generalInfo.data.rollupSynch.lastBatchSynched;
    let nonceToSend;
    if (nonce !== undefined) nonceToSend = nonce;
    else {
        const responseLeaf = await apiOperator.getAccountByIdx(fromId);
        if (nonceObject !== undefined) {
            const res = await _checkNonce(responseLeaf, currentBatch, nonceObject);
            nonceToSend = res.nonce;
        } else nonceToSend = responseLeaf.data.nonce;
    }
    const tx = {
        fromIdx: fromId,
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
        nonceObjectToWrite = _addNonce(nonceObject, currentBatch, nonceToSend, fromId);
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
