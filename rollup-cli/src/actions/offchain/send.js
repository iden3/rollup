const { BabyJubWallet } = require('../../../../rollup-utils/babyjub-wallet');
const axios = require('axios');

function send(UrlOperator, IdFrom, idTo, amount, BabyjubJson, password) {

    console.log({UrlOperator}, {IdFrom}, {idTo}, {amount}, {BabyjubJson}, {password});
    let walletBaby = BabyJubWallet.fromEncryptedJson(BabyjubJson, password)
  

    return new Promise (function (resolve, reject){

        axios.get (`http://127.0.0.1:9000/offchain/info/${walletBaby.publicKey.toString()}`).then(function(response){

            const transaction = {
                IdFrom: IdFrom,
                idTo: idTo,
                amount: amount,
                nonce:response.data.value.nonce
            }
            let sign = walletBaby.signMessage(JSON.stringify(transaction));

            axios.post("http://127.0.0.1:9000/offchain/send",{transaction,sign}).then(function(response){
                resolve(response.status)
            }) 
            .catch(function (error) {
                reject(error);
              });

        })
        .catch(function (error) {
            reject(error);
          });
     
    })
    


}

module.exports = { send };