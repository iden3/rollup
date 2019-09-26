const ethers = require("ethers");
const { BabyJubWallet } = require("../../../../rollup-utils/babyjub-wallet");
const axios = require("axios");

async function withdraw(urlNodo, addressSC, balance, tokenId, walletEthJson, BabyjubJson, password, abi, UrlOperator)  {

    //console.log({urlNodo}, {addressSC}, {balance}, {tokenId}, {walletEthJson}, {BabyjubJson}, {password}, {abi})
    const provider = new ethers.providers.JsonRpcProvider(urlNodo);
    let wallet =await ethers.Wallet.fromEncryptedJson(walletEthJson, password);
    let walletBaby = await BabyJubWallet.fromEncryptedJson(BabyjubJson, password);
    let pubKeyBabyjub = [walletBaby.publicKey[0].toString(), walletBaby.publicKey[1].toString()] ;

    wallet = wallet.connect(provider);
    let contractWithSigner = new ethers.Contract(addressSC, abi, wallet);


    try{
        return new Promise ( function (resolve, reject){

            axios.get (`${UrlOperator}/offchain/info/${walletBaby.publicKey.toString()}`).then(async function(response){

                console.log("sibilings",response.data.value.sibilings);
                console.log("id: ",response.data.value.id, {balance}, {tokenId}, "exitroot: ", response.data.value.exitRoot, "nonce: ",response.data.value.nonce, {pubKeyBabyjub}  );
                let receipt = await contractWithSigner.withdraw(response.data.value.id, balance, tokenId, response.data.value.exitRoot,
                    response.data.value.nonce, pubKeyBabyjub, response.data.value.sibilings);
                resolve(receipt);
            }) 
                .catch(function (error) {
                    reject(error);
                });
     
        });

    }
    catch (error) {
        console.log("error.... ", error); //fires as the contract reverted the payment
    }
         
}
  
module.exports = {
    withdraw
};

  