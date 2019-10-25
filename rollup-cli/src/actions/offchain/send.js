/* eslint-disable no-restricted-syntax */
const { stringifyBigInts } = require('snarkjs');
const { Wallet } = require('../../wallet.js');
const CliExternalOperator = require('../../../../rollup-operator/src/cli-external-operator');
/**
 * @dev off-chain transaction between users
 * transfer tokens from an id to another offchain
 * @param UrlOperator URl from operator
 * @param idTo reciever
 * @param amount initial balance on balance tree
 * @param walletJson from this one can obtain the ethAddress and babyPubKey
 * @param password for decrypt the Wallet
 * @param tokenId token type identifier, the sender and the reciever must use the same token
 * @param userFee fee the user is diposed to pay
*/
async function send(UrlOperator, idTo, amount, walletJson, password, tokenId, userFee, idFrom) {
    const apiOperator = new CliExternalOperator(UrlOperator);
    const walletRollup = await Wallet.fromEncryptedJson(walletJson, password);

    const responseLeaf = await apiOperator.getInfoByIdx(idFrom);
    const tx = {
        fromIdx: responseLeaf.data.id,
        toIdx: idTo,
        coin: tokenId,
        amount,
        nonce: responseLeaf.data.nonce,
        userFee,
        rqOffset: 0,
        onChain: 0,
        newAccount: 0,
    };

    walletRollup.signRollupTx(tx); // sign included in transaction
    const parseTx = stringifyBigInts(tx);// convert bigint to Strings

    const res = await apiOperator.sendOffChainTx(parseTx);
    return res.status;
}

module.exports = { send };
