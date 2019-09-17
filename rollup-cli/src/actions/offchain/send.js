const axios = require("axios");
const { Wallet } = require("../../wallet.js");


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
async function send(UrlOperator, idTo, amount, walletJson, password, tokenId, userFee) {

    let walletRollup= await Wallet.fromEncryptedJson(walletJson, password);
    let walletBaby = walletRollup.babyjubWallet;

    return new Promise (function (resolve, reject){

        axios.get (`${UrlOperator}/offchain/info/${walletBaby.publicKey.toString()}`).then(function(response){

            const transaction = {
                fromIdx: response.data.value.id,
                toIdx: idTo,
                coin: tokenId,
                amount: amount,
                nonce:response.data.value.nonce,
                userFee: userFee,
                rqOffset: 0,
                onChain: 0,
                newAccount:0
            };

            walletRollup.signRollupTx(transaction); //sign included in transaction
            let parsetransaction = JSON.parse(JSON.stringify({transaction}, (key, value) =>//convert bigint to Strings
                typeof value === "bigint"
                    ? value.toString()
                    : value // return everything else unchanged
            ));
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