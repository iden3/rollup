const ethers = require("ethers");
const { BabyJubWallet } = require("../../../../rollup-utils/babyjub-wallet");

async function deposit(urlNodo, addressSC, balance, tokenId, walletEthJson, BabyjubJson, password, abi)  {

    //console.log({urlNodo}, {addressSC}, {balance}, {tokenId}, {walletEthJson}, {BabyjubJson}, {password}, {abi})
    const provider = new ethers.providers.JsonRpcProvider(urlNodo);
    let wallet =await ethers.Wallet.fromEncryptedJson(walletEthJson, password);
    let walletBaby = await BabyJubWallet.fromEncryptedJson(BabyjubJson, password);
    let pubKeyBabyjub = [walletBaby.publicKey[0].toString(), walletBaby.publicKey[1].toString()] ;

    wallet = wallet.connect(provider);
    let address = await wallet.getAddress();
    let contractWithSigner = new ethers.Contract(addressSC, abi, wallet);
    
    let overrides = {
        gasLimit: 800000,
        value: ethers.utils.parseEther("1.0"),
    };
    
    try{
        return new Promise (function (resolve){
            contractWithSigner.deposit(balance, tokenId, address, pubKeyBabyjub, overrides).then(response => {
                resolve(response);
            });
        });
    }
    catch (error) {
        console.log("error.... ", error); //fires as the contract reverted the payment
    }
     
}
  
module.exports = {
    deposit
};

  