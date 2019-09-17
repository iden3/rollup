const { BabyJubWallet } = require('../../../../rollup-utils/babyjub-wallet');

function send(amount, idReceiver, password, from, walletJson, operator) {
    console.log(amount, idReceiver, password, from, walletJson, operator);
    const wallet = BabyJubWallet.fromEncryptedJson(walletJson, password);

    const obj = {
        from: from,
        to: idReceiver,
        amount: amount,
        operator: operator,
        wallet: wallet
    }

    console.log(obj)
}

module.exports = { send };