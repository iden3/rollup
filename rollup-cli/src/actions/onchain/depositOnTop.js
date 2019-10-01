const ethers = require("ethers");
const axios = require("axios");
const { Wallet } = require("../../wallet.js");




/**
 * @dev Deposit on an existing balance tree leaf
 * @param urlNode URL of the ethereum node
 * @param addressSC Rollup address
 * @param walletJson From this one can obtain the ethAddress and BabyPubKey
 * @param password For desencrypt the Wallet
 * @param abi abi of Rollup Contract
 * @param UrlOperator URl from Operator
 * @params_for_TxDepositOnTop :
    * @param balance initial balance on balance tree
    * @param tokenId token type identifier
    * @param idBalanceTree account identifier on the balance tree which will receive the deposit, get from operator (using URL operator and WalletJson)
*/

async function depositOnTop(urlNode, addressSC, balance, tokenId, walletJson, password, abi, UrlOperator)  {

  
    let walletRollup= await Wallet.fromEncryptedJson(walletJson, password);
    let walletEth = walletRollup.ethWallet.wallet;
    let walletBaby = walletRollup.babyjubWallet;

    const provider = new ethers.providers.JsonRpcProvider(urlNode);
    

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
            
                let receipt = await contractWithSigner.depositOnTop(coorectLeaf.id, balance, tokenId, overrides);//response.data.value.nonce,
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

  
