const axios = require("axios");
const { Wallet } = require("../../src/wallet");

/**
 * @dev Deposit on-chain transaction
 * add new leaf to balance tree and initializes it with a load amount
 * @param UrlOperator URl from Operator
 * @param idTo Reciever
 * @param amount initial balance on balance tree
 * @param walletJson From this one can obtain the ethAddress and BabyPubKey
 * @param password For desencrypt the Wallet
 * @param tokenId token type identifier
 * @param userFee Fee the user is diposed to pay
*/
async function send(UrlOperator, idTo, amount, walletJson, password, tokenId, userFee, codeWrongTransaction) {
    
    let walletRollup= await Wallet.fromEncryptedJson(walletJson, password);
    let walletBaby = walletRollup.babyjubWallet;
    
    return new Promise (function (resolve, reject){

        axios.get (`${UrlOperator}/offchain/info/${walletBaby.publicKey[0].toString()}/${walletBaby.publicKey[1].toString()}`).then(function(response){

           
            let coorectLeaf = [];
            for ( let leaf of response.data){
                if (leaf.tokenId ==tokenId){
                    coorectLeaf = leaf;
                }
            }
          
            if (coorectLeaf == []){
                reject("There're no leafs with this wallet (babyjub) and this tokenID");
            }
            const transaction = {
                fromIdx: coorectLeaf.id,
                toIdx: idTo,
                coin: tokenId,
                amount: amount,
                nonce: coorectLeaf.nonce,
                userFee: userFee,
                rqOffset: 0,
                onChain: 0,
                newAccount:0
            };

            switch (codeWrongTransaction){
            case 1: // Sign tx don't match with babyjub publick key
                transaction.fromIdx++;
                break;
            case 2: // Leaf don't have enough funds
                transaction.amount= 100000;
                break;
            case 3:// - Idfrom / Idto don't exist in current tree
                transaction.toIdx = 10000;
                break;
            case 4:// - Nonce don't match with the leaf nonce
                transaction.nonce++;
                break;
            case 5:// - TokenId don't match with the leaf tokenId
                transaction.coin++; //undefined
                break;
            case 6:// - User fee is less than operatos especified?
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
            case 10: //-Float values
                transaction.userFee = 0.5;
                break;

            }


            for (var field in transaction) {
                if (Object.prototype.hasOwnProperty.call(transaction, field)) {
                    if ((transaction[field] % 1) != 0){
                        throw new Error("all fields of transactoin must be integers");
                    }
                }
            }
            walletRollup.signRollupTx(transaction); //sign included in transaction
            let parsetransaction = JSON.parse(JSON.stringify({transaction}, (key, value) =>//convert bigint to Strings
                typeof value === "bigint"
                    ? value.toString()
                    : value // return everything else unchanged
            ));

            if (codeWrongTransaction ==11){// -sign don't matchthe Tx
                transaction.toIdx++;
            }
            axios.post(`${UrlOperator}/offchain/send`,parsetransaction).then(function(response){
                resolve(response.status);
            }) 
                .catch(function (error) {
                    reject(error);
                });

        })
            .catch(function (error) {
                reject(error);
            });
     
    });
    


}

module.exports = { send };