const ethers = require("ethers");
const { BabyJubWallet } = require("../../../../rollup-utils/babyjub-wallet");
const axios = require("axios");

async function forceWithdrawV2(urlNodo, addressSC, balance, tokenId, walletEthJson, BabyjubJson, password, abi, UrlOperator)  {

    //console.log({urlNodo}, {addressSC}, {balance}, {tokenId}, {walletEthJson}, {BabyjubJson}, {password}, {abi})
    const provider = new ethers.providers.JsonRpcProvider(urlNodo);
    let wallet =await ethers.Wallet.fromEncryptedJson(walletEthJson, password);
    let walletBaby = await BabyJubWallet.fromEncryptedJson(BabyjubJson, password);
    let pubKeyBabyjub = [walletBaby.publicKey[0].toString(), walletBaby.publicKey[1].toString()] ;


    wallet = wallet.connect(provider);
    //let address = await wallet.getAddress()
    let contractWithSigner = new ethers.Contract(addressSC, abi, wallet);
    
    let overrides = {
        gasLimit: 800000,
        value: ethers.utils.parseEther("1.0"),
    };
   

    try{
        return new Promise ( function (resolve, reject){

            axios.get (`${UrlOperator}/offchain/info/${walletBaby.publicKey.toString()}`).then(async function(response){

                console.log("forcewithdraw", {pubKeyBabyjub});
                let receipt = await contractWithSigner.forceWithdraw(response.data.value.id, balance, pubKeyBabyjub, overrides);
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
    forceWithdrawV2
};

  