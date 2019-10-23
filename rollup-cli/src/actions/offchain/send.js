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
async function send(UrlOperator, idTo, amount, walletJson, password, tokenId, userFee) {
    const apiOperator = new CliExternalOperator(UrlOperator);
    const walletRollup = await Wallet.fromEncryptedJson(walletJson, password);
    const walletBaby = walletRollup.babyjubWallet;

    return new Promise(((resolve, reject) => {
        apiOperator.getInfoByAxAy(walletBaby.publicKey[0].toString(), walletBaby.publicKey[1].toString())
            .then((responseLeaf) => {
                let correctLeaf = [];
                for (const leaf of responseLeaf.data) {
                    if (leaf.tokenId === tokenId) {
                        correctLeaf = leaf;
                    }
                }
                if (correctLeaf === []) {
                    reject(new Error("There're no leafs with this wallet (babyjub) and this tokenID"));
                }
                const transaction = {
                    fromIdx: correctLeaf.id,
                    toIdx: idTo,
                    coin: tokenId,
                    amount,
                    nonce: correctLeaf.nonce,
                    userFee,
                    rqOffset: 0,
                    onChain: 0,
                    newAccount: 0,
                };
                walletRollup.signRollupTx(transaction); // sign included in transaction
                const parseTransaction = stringifyBigInts(transaction);// convert bigint to Strings
                apiOperator.sendOffChainTx(parseTransaction)
                    .then((response) => {
                        resolve(response.status);
                    })
                    .catch((error) => {
                        reject(error);
                    });
            })
            .catch((error) => {
                reject(error);
            });
    }));
}

module.exports = { send };
