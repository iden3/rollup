const ethers = require("ethers");
const axios = require("axios");
const { Wallet } = require("../../wallet.js");


/**
 * @dev Withdraw balance from identifier balance tree
 * @param urlNode URL of the ethereum node
 * @param addressSC Rollup address
 * @param walletJson From this one can obtain the ethAddress and BabyPubKey
 * @param password For desencrypt the Wallet
 * @param abi abi of Rollup Contract
 * @param UrlOperator URl from Operator
 * @params_for_TxforceWithdraw :
    * @param idBalanceTree account identifier on the balance tree which will do the withdraw
    * @param amount total amount coded as float 16 bits
    * @param babyPubKey public key babyjubjub represented as point (Ax, Ay)
 */

async function forceWithdraw(urlNode, addressSC, balance, tokenId, walletJson, password, abi, UrlOperator)  {

    let walletRollup= await Wallet.fromEncryptedJson(walletJson, password);
    let walletEth = walletRollup.ethWallet.wallet;
    let walletBaby = walletRollup.babyjubWallet;

    const provider = new ethers.providers.JsonRpcProvider(urlNode);
    let pubKeyBabyjub = [walletBaby.publicKey[0].toString(), walletBaby.publicKey[1].toString()] ;


    walletEth = walletEth.connect(provider);
    let contractWithSigner = new ethers.Contract(addressSC, abi, walletEth);
    
    let overrides = {
        gasLimit: 800000,
        value: ethers.utils.parseEther("1.0"),
    };
   

    try{
        return new Promise ( function (resolve, reject){

            axios.get (`${UrlOperator}/offchain/info/${walletBaby.publicKey[0].toString()}/${walletBaby.publicKey[1].toString()}`).then(async function(response){

                let coorectLeaf = [];
                for ( let leaf of response.data){
                    if (leaf.tokenId ==tokenId){
                        coorectLeaf = leaf;
                    }
                }
          
                if (coorectLeaf == []){
                    reject("There're no leafs with this wallet (babyjub) and this tokenID");
                }

                let receipt = await contractWithSigner.forceWithdraw(coorectLeaf.id, balance, pubKeyBabyjub, overrides);
                resolve(receipt);
            })
        
                .catch(function (error) {
                    reject(error);
                });
     
        });

    }
    catch (error) {
        console.log("error.... ", error);
    }
         
}
  
module.exports = {
    forceWithdraw
};

  