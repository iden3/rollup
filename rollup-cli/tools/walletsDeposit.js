const { Wallet } = require("../src/wallet");
const fs = require("fs");
const { deposit } = require("../src/actions/onchain/deposit");



async function walletsDeposit(numTransOnchain, amountToken, passString, addressRollup, abiRollupPath, node, tokenId, path){

    let files;
    try{
        files = fs.readdirSync(path);
    } catch (err){
        throw new Error("Directory don't exist");
    }

    if (files.length == 0){
        throw new Error("No files in this directory");
    }
    var collator = new Intl.Collator(undefined, {numeric: true, sensitivity: "base"});
    files.sort(collator.compare);//sort by numerical (if not the order would be for example: 1 10 2 3 4...)

    let wallets = [];
    let i = 1;
    for (var file of files){
        wallets[i] = await Wallet.fromEncryptedJson(JSON.parse(fs.readFileSync(path + "/" + file, "utf8")), passString);
        i++;
    }
    for(let i = 1; i <= files.length; i++){
        for(let j = 0; j < numTransOnchain; j++) {
            await deposit(node, addressRollup, Math.floor(amountToken/numTransOnchain), tokenId, await wallets[i].toEncryptedJson(passString), 
                passString, JSON.parse(fs.readFileSync(abiRollupPath, "utf8")));
            
        }
    }

  

    
}


module.exports = {
    walletsDeposit
};