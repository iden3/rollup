const { Wallet } = require("../src/wallet");
const fs = require("fs");
const { send } = require("./resourcesBot/sendBot");



async function walletsSend(numTransOffchain, amountToken, passString, urlOperator, userfee, tokenId, path){

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

    let toId;
    let codeError;
           
    for(let i = 1; i <= files.length; i++){
        for(let j = 0; j < numTransOffchain; j++) {
            toId = i;        //i 1 --> id 1
            if (files.length==1){//protection if files.length is 1
                toId = 2;
            }
            else{
                while (toId == i){//can't be itself
                    toId = Math.ceil(Math.random()*(files.length)); // random index from 1 to numWallets
                    console.log({toId});
                }
            }
            codeError = createCodeError();
            console.log({codeError});
            send(urlOperator, toId, amountToken, await wallets[i].toEncryptedJson(passString), passString, tokenId, userfee, codeError);
        }
    }

  

    
}

function createCodeError(){
    let code;
    let random = Math.ceil(Math.random()*100);
    switch(true){
    case (random<=45): 
        code = 0;
        break;
    case (45 < random && random <= 50): 
        code = 1;
        break;
    case (50 < random && random <= 55): 
        code = 2;
        break;
    case (55 < random && random <= 60): 
        code = 3;
        break;
    case (60 < random && random <= 65): 
        code = 4;
        break;
    case (65 < random && random <= 70): 
        code = 5;
        break;
    case (70 < random && random <= 75): 
        code = 6;
        break;
    case (75 < random && random <= 80): 
        code = 7;
        break;
    case (80 < random && random <= 85): 
        code = 8;
        break;
    case (85 < random && random <= 90): 
        code = 9;
        break;
    case (90 < random && random <= 95): 
        code = 10;
        break;
    case (95 < random && random <= 100): 
        code = 11;
        break; 
    default: 
        throw new Error("Something go wrong, code: "+ code);
    }

    return code;
}

module.exports = {
    walletsSend,
    createCodeError
};

