/* eslint-disable no-restricted-syntax */
const { stringifyBigInts } = require('snarkjs');
const { Wallet } = require('../../wallet.js');
const CliExternalOperator = require('../../../../rollup-operator/src/cli-external-operator');

async function _checkNonce(urlOperator, currentBatch, nonceObject, idFrom) {
    const batch = nonceObject.filter((x) => x.batch === currentBatch);
    let nonce;
    if (batch.length > 0) {
        const nonceList = batch.map((x) => x.nonce);
        nonce = Math.max(...nonceList);
    } else {
        const apiOperator = new CliExternalOperator(urlOperator);
        const responseLeaf = await apiOperator.getAccountByIdx(idFrom);
        nonce = responseLeaf.data.nonce;
    }
    const infoTx = { currentBatch, nonce };
    return infoTx;
}

function _addNonce(nonceObject, currentBatch, nonce) {
    const newNonce = nonce + 1;
    if (nonceObject !== undefined) {
        if (nonceObject.length > 0) {
            const batch = nonceObject.filter((x) => x.batch === currentBatch);
            if (batch.length === 0) {
                nonceObject.splice(0, nonceObject.length);
            }
        }
    } else {
        nonceObject = [];
    }
    nonceObject.push({ batch: currentBatch, nonce: newNonce });
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
async function send(urlOperator, idTo, amount, walletJson, password, tokenId, userFee, idFrom, nonce, nonceObject) {
    const apiOperator = new CliExternalOperator(urlOperator);
    const walletRollup = await Wallet.fromEncryptedJson(walletJson, password);
    const responseLeaf = await apiOperator.getAccountByIdx(idFrom);
    const generalInfo = await apiOperator.getState();
    const currentBatch = generalInfo.data.rollupSynch.lastBatchSynched;
    let nonceToSend;
    if (nonce !== undefined) nonceToSend = nonce;
    else if (nonceObject !== undefined) {
        const res = await _checkNonce(urlOperator, currentBatch, nonceObject, idFrom);
        nonceToSend = res.nonce;
    } else nonceToSend = responseLeaf.data.nonce;
    const tx = {
        fromIdx: responseLeaf.data.idx,
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
    if (resTx.status.toString() === '200' && nonce === undefined) {
        nonceObjectToWrite = _addNonce(nonceObject, currentBatch, nonceToSend);
    } else if (resTx.status.toString() === '200' && nonce !== undefined) {
        nonceObjectToWrite = [{ batch: currentBatch, nonce: nonce + 1 }];
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
