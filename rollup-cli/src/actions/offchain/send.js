const axios = require('axios');
const { BabyJubWallet } = require('../../../../rollup-utils/babyjub-wallet');

function send(UrlOperator, idTo, amount, BabyjubJson, password, tokenId, userFee) {

    console.log({UrlOperator}, {idTo}, {amount}, {BabyjubJson}, {password});
    let walletBaby = BabyJubWallet.fromEncryptedJson(BabyjubJson, password)
  

    return new Promise (function (resolve, reject){

        axios.get (`${UrlOperator}/offchain/info/${walletBaby.publicKey.toString()}`).then(function(response){

            const transaction = {
                IdFrom: response.data.value.id,//IdFrom,
                idTo: idTo,
                coin: tokenId,
                amount: amount,
                nonce:response.data.value.nonce,
                userFee: userFee
            }// 3 parametros a 0 al final, firmar con otra funcion,
            //cliente crea tree? ocn post? o hardcorded?

            let sign = walletBaby.signMessage(JSON.stringify(transaction));

            axios.post(`${UrlOperator}/offchain/send`,{transaction,sign}).then(function(response){
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
      .catch((error) => {
        reject(error);
      });
  });
}
module.exports = { send };
