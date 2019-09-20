const axios = require('axios');
const { BabyJubWallet } = require('../../../../rollup-utils/babyjub-wallet');

function send(UrlOperator, idTo, amount, BabyjubJson, password) {
  const walletBaby = BabyJubWallet.fromEncryptedJson(BabyjubJson, password);
  return new Promise((resolve, reject) => {
    axios.get(`${UrlOperator}/offchain/info/${walletBaby.publicKey.toString()}`).then(function(response) {
      const transaction = {
        IdFrom: response.data.value.id, // IdFrom,
        idTo: idTo,
        amount: amount,
        nonce: response.data.value.nonce,
      };
      const sign = walletBaby.signMessage(JSON.stringify(transaction));
      axios.post(`${UrlOperator}/offchain/send`, { transaction, sign }).then(function(response) {
        resolve(response.status);
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
