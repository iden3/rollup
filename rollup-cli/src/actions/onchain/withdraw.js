const ethers = require("ethers");
const axios = require("axios");
const { Wallet } = require("../../wallet.js");


/**
 * @dev withdraw on-chain transaction to get balance from balance tree
 * Before this call an off-chain withdraw transaction must be done
 * Off-chain withdraw transaction will build a leaf on exit tree
 * Each batch forged will publish its exit tree root
 * All leaves created on the exit are allowed to call on-chain transaction to finish the withdraw
 * @param urlNode URL of the ethereum node
 * @param addressSC Rollup address
 * @param walletJson From this one can obtain the ethAddress and BabyPubKey
 * @param password For desencrypt the Wallet
 * @param abi abi of Rollup Contract
 * @param UrlOperator URl from Operator
 * @params_for_TxWithdraw :
    * @param idBalanceTree account identifier on the balance tree, get from operator 
    * @param amount amount to retrieve
    * @param tokenId token type
    * @param numExitRoot exit root depth. Number of batch where the withdraw transaction has been done, get from operator 
    * @param nonce nonce exit tree leaf, get from operator 
    * @param babyPubKey public key babyjubjub represented as point (Ax, Ay)
    * @param siblings siblings to demonstrate merkle tree proof, get from operator 
 */
                
async function withdraw(urlNode, addressSC, balance, tokenId, walletJson, password, abi, UrlOperator)  {

    let walletRollup= await Wallet.fromEncryptedJson(walletJson, password);
    let walletEth = walletRollup.ethWallet.wallet;
    let walletBaby = walletRollup.babyjubWallet;

    const provider = new ethers.providers.JsonRpcProvider(urlNode);
    let pubKeyBabyjub = [walletBaby.publicKey[0].toString(), walletBaby.publicKey[1].toString()] ;

    walletEth = walletEth.connect(provider);
    let contractWithSigner = new ethers.Contract(addressSC, abi, walletEth);


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

  
                let receipt = await contractWithSigner.withdraw(coorectLeaf.id, balance, tokenId, coorectLeaf.exitRoot,
                    coorectLeaf.nonce, pubKeyBabyjub, coorectLeaf.sibilings);
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

  