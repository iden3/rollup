const ethers = require("ethers");
const { BabyJubWallet } = require("../../../../rollup-utils/babyjub-wallet");
const axios = require("axios");

async function depositOnTop(urlNodo, addressSC, balance, tokenId, walletEthJson, BabyjubJson, password, abi, UrlOperator)  {

    //console.log({urlNodo}, {addressSC}, {balance}, {tokenId}, {walletEthJson}, {BabyjubJson}, {password}, {abi})
    const provider = new ethers.providers.JsonRpcProvider(urlNodo);
    let wallet =await ethers.Wallet.fromEncryptedJson(walletEthJson, password);
    let walletBaby = await BabyJubWallet.fromEncryptedJson(BabyjubJson, password);

    wallet = wallet.connect(provider);
    let contractWithSigner = new ethers.Contract(addressSC, abi, wallet);
    
    let overrides = {
        gasLimit: 800000,
        value: ethers.utils.parseEther("1.0"),
    };
   

    try{
        return new Promise ( function (resolve, reject){

            axios.get (`${UrlOperator}/offchain/info/${walletBaby.publicKey.toString()}`).then(async function(response){
                let receipt = await contractWithSigner.depositOnTop(response.data.value.id, balance, tokenId, overrides);//response.data.value.nonce,
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
    
    //uint16 depositAmount,uint16 tokenId, uint256[2] babyPubKey, address withdrawAddress
         
}
  
module.exports = {
    depositOnTop
};

  
