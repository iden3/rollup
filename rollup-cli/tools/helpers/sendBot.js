/* eslint-disable no-restricted-syntax */
const { stringifyBigInts } = require('snarkjs');
const { Wallet } = require('../../src/wallet');
const CliExternalOperator = require('../../../rollup-operator/src/cli-external-operator');
/**
 * @dev off-chain fake transaction between users, some of them wrong depending on @codeWrongTransaction parameter
 * transfer tokens from an id to another offchain
 * @param UrlOperator URl from operator
 * @param idTo reciever
 * @param amount initial balance on balance tree
 * @param walletJson from this one can obtain the ethAddress and babyPubKey
 * @param password for desencrypt the Wallet
 * @param tokenId token type identifier, the sender and the reciever must use the same token
 * @param userFee fee the user is diposed to pay
 * @param codeWrongTransaction depending on this parameter produce different errors in transactions
*/
async function send(UrlOperator, idTo, amount, walletJson, password, tokenId, userFee, codeWrongTransaction) {
    const apiOperator = new CliExternalOperator(UrlOperator);
    const walletRollup = await Wallet.fromEncryptedJson(walletJson, password);
    const walletBaby = walletRollup.babyjubWallet;

    return new Promise(((resolve, reject) => {
        apiOperator.getInfoByAxAy(walletBaby.publicKey[0].toString(), walletBaby.publicKey[1].toString())
            .then((info) => {
                let correctLeaf = [];
                for (const leaf of info.data) {
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

                switch (codeWrongTransaction) {
                case 1: // Sign tx don't match with babyjub publick key
                    transaction.fromIdx += 1;
                    break;
                case 2: // Leaf don't have enough funds
                    transaction.amount = 100000;
                    break;
                case 3:// - Idfrom / Idto don't exist in current tree
                    transaction.toIdx = 10000;
                    break;
                case 4:// - Nonce don't match with the leaf nonce
                    transaction.nonce += 1;
                    break;
                case 5:// - TokenId don't match with the leaf tokenId
                    transaction.coin += 1;
                    break;
                case 6:// - User fee is less than operator especified
                    transaction.userFee = 0;
                    break;
                case 7:// - rqOffset must be 0
                    transaction.rqOffset = 1;
                    break;
                case 8:// - Onchain  must be 0 in offchain Tx
                    transaction.onChain = 1;
                    break;
                case 9:// -New account must be 0 in send Tx
                    transaction.newAccount = 1;
                    break;
                case 10: // -Float values
                    transaction.userFee = 0.5;
                    break;
                default:
                    break;
                }

                for (const field in transaction) {
                    if (Object.prototype.hasOwnProperty.call(transaction, field)) {
                        if ((transaction[field] % 1) !== 0) {
                            throw new Error('all fields of transactoin must be integers');
                        }
                    }
                }
                walletRollup.signRollupTx(transaction); // sign included in transaction
                const parseTransaction = stringifyBigInts(transaction);// convert bigint to Strings
                if (codeWrongTransaction === 11) { // -sign don't matchthe Tx
                    transaction.toIdx += 1;
                }
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
