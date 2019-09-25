const ethers = require('ethers');
const fs = require('fs');
const { BabyJubWallet } = require('../../../../rollup-utils/babyjub-wallet');
const axios = require('axios');

async function withdraw(urlNodo, addressSC, balance, tokenId, walletEthJson, BabyjubJson, password, abi, UrlOperator)  {

    //console.log({urlNodo}, {addressSC}, {balance}, {tokenId}, {walletEthJson}, {BabyjubJson}, {password}, {abi})
    const provider = new ethers.providers.JsonRpcProvider(urlNodo);
    let wallet =await ethers.Wallet.fromEncryptedJson(walletEthJson, password);
    let walletBaby = await BabyJubWallet.fromEncryptedJson(BabyjubJson, password)
    let pubKeyBabyjub = [walletBaby.publicKey[0].toString(), walletBaby.publicKey[1].toString()] ;


    wallet = wallet.connect(provider);
    let address = await wallet.getAddress()
    let contractWithSigner = new ethers.Contract(addressSC, abi, wallet)
    
    let overrides = {
        gasLimit: 800000,
        value: ethers.utils.parseEther('1.0'),
    };
   
//priemero send a 0 o force withdraw y despues esto.

    try{
      return new Promise ( function (resolve, reject){

        axios.get (`${UrlOperator}/offchain/info/${walletBaby.publicKey.toString()}`).then(async function(response){

          // function depositOnTop(
          //   uint64 idBalanceTree,
          //   uint128 loadAmount,
          //   uint32 tokenId,
          //   uint48 nonce
          
          console.log({sibilings})
            let receipt = await contractWithSigner.withdraw(response.data.value.id, balance, tokenId, response.data.value.exitRoot,
                response.data.value.nonce, pubKeyBabyjub, response.data.value.sibilings, overrides)
            resolve(receipt)
        })
          //(id, leafId.balance.toString(), leafId.tokenId.toString(),
       //BigInt(lastBlock).sub(BigInt(1)).toString(), leafId.nonce(),[leafId.Ax.toString(), leafId.Ay.toString()],
        //siblingsId    
        .catch(function (error) {
            reject(error);
          });
     
    })

  }
    catch (error) {
        console.log("error.... ", error) //fires as the contract reverted the payment
      }
    
    //uint16 depositAmount,uint16 tokenId, uint256[2] babyPubKey, address withdrawAddress
         
  }
  
module.exports = {
     withdraw
  };

  