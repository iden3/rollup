/* eslint-disable no-restricted-syntax */
/* eslint-disable no-await-in-loop */
const fs = require('fs');
const { Wallet } = require('../../src/wallet');
const { send } = require('./sendBot');


function createCodeError() {
    let code;
    const random = Math.ceil(Math.random() * 100);
    switch (true) {
    case (random <= 45):
        code = 0;
        break;
    case (random > 45 && random <= 50):
        code = 1;
        break;
    case (random > 50 && random <= 55):
        code = 2;
        break;
    case (random > 55 && random <= 60):
        code = 3;
        break;
    case (random > 60 && random <= 65):
        code = 4;
        break;
    case (random > 65 && random <= 70):
        code = 5;
        break;
    case (random > 70 && random <= 75):
        code = 6;
        break;
    case (random > 75 && random <= 80):
        code = 7;
        break;
    case (random > 80 && random <= 85):
        code = 8;
        break;
    case (random > 85 && random <= 90):
        code = 9;
        break;
    case (random > 90 && random <= 95):
        code = 10;
        break;
    case (random > 95 && random <= 100):
        code = 11;
        break;
    default:
        throw new Error(`Something go wrong, code: ${code}`);
    }

    return code;
}


async function walletsSend(numTransOffchain, amountToken, passString, urlOperator, userfee, tokenId, path) {
    let files;
    try {
        files = fs.readdirSync(path);
    } catch (err) {
        throw new Error("Directory don't exist");
    }

    if (files.length === 0) {
        throw new Error('No files in this directory');
    }
    const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
    files.sort(collator.compare);// sort by numerical (if not the order would be for example: 1 10 2 3 4...)
    const wallets = [];
    let walletCount = 1;
    for (const file of files) {
        wallets[walletCount] = await Wallet.fromEncryptedJson(JSON.parse(fs.readFileSync(`${path}/${file}`, 'utf8')), passString);
        walletCount += 1;
    }
    let toId;
    let codeError;
    for (let i = 1; i <= files.length; i++) {
        for (let j = 0; j < numTransOffchain; j++) {
            toId = i; // i 1 --> id 1
            if (files.length === 1) { // protection if files.length is 1
                toId = 2;
            } else {
                while (toId === i) { // can't be itself
                    toId = Math.ceil(Math.random() * (files.length)); // random index from 1 to numWallets
                }
            }
            codeError = createCodeError();
            send(urlOperator, toId, amountToken, await wallets[i].toEncryptedJson(passString), passString, tokenId, userfee, codeError);
        }
    }
}

module.exports = {
    walletsSend,
    createCodeError,
};
