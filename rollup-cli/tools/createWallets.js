const { Wallet } = require("../src/wallet");
const fs = require("fs");
const ethers = require("ethers");

async function createWallets(numWallets, amountToken, passString, addressRollup, walletEthFunder, amountEther, addressTokens, abiTokens, node, path, mnemonic){

    
    let pathNewWallets = (path) ? path : "../tools/resourcesBot/wallets";
    
    if (!fs.existsSync(pathNewWallets)){
        fs.mkdirSync(pathNewWallets);
    }
    let wallets = [];
    const provider = new ethers.providers.JsonRpcProvider(node);
    walletEthFunder = walletEthFunder.connect(provider);

    let contractTokensFunder = new ethers.Contract(addressTokens, abiTokens, walletEthFunder);

    for(let i = 1; i <= numWallets; i++){

        if(mnemonic){
            wallets[i] = await Wallet.fromMnemonic(mnemonic, i-1);
        }
        else{
            wallets[i] = await Wallet.createRandom();
        }

        //guardar wallets:
        let encWalletI = await wallets[i].toEncryptedJson(passString);
        fs.writeFileSync(pathNewWallets+`/${i}wallet.json`, JSON.stringify(encWalletI, null, 1), "utf-8");
            
        //provide funds
        let walletEth = wallets[i].ethWallet.wallet.connect(provider);
        let balance = await walletEth.getBalance();
        let address = await walletEth.getAddress();
        if (ethers.utils.formatEther(balance)< amountEther){ //if dont have enough funds:
            let tx = {
                to: address,
                value: amountEther
            };
            await walletEthFunder.sendTransaction(tx);
        }

        //provide tokens:
        let tokens = await contractTokensFunder.balanceOf(address); // if dont have enough tokens:
        if (parseInt(tokens._hex) < amountToken){
            await contractTokensFunder.transfer(address, amountToken);
        }
        
        //approve tokens.
        walletEth = walletEth.connect(provider);
        let contractTokensBot = new ethers.Contract(addressTokens, abiTokens, walletEth);
        await contractTokensBot.approve(addressRollup, amountToken);//config.Json address of rollupSC
    }
    return wallets;

    
}


module.exports = {
    createWallets
};