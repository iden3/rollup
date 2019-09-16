const ethers = require('ethers');
const fs = require('fs');
const { BabyJubWallet } = require('../../../../rollup-utils/babyjub-wallet');

async function deposit(urlNodo, addressSC, balance, tokenId, walletEthJson, BabyjubJson, password, abi)  {

    //console.log({urlNodo}, {addressSC}, {balance}, {tokenId}, {walletEthJson}, {BabyjubJson}, {password}, {abi})
    const provider = new ethers.providers.JsonRpcProvider(urlNodo);
    let wallet =await ethers.Wallet.fromEncryptedJson(walletEthJson, password);
    let walletBaby = await BabyJubWallet.fromEncryptedJson(BabyjubJson, password)
    let pubKeyBabyjub = [walletBaby.publicKey[0].toString(), walletBaby.publicKey[1].toString()] ;
    console.log(pubKeyBabyjub)

    wallet = wallet.connect(provider);
    let address = await wallet.getAddress()
    let contractWithSigner = new ethers.Contract(addressSC, abi, wallet)
    
    let overrides = {
        gasLimit: 800000,
        value: ethers.utils.parseEther('1.0'),
    };
    
    try{
        return new Promise (async function (resolve, reject){
            let response = await contractWithSigner.deposit(balance, tokenId, pubKeyBabyjub, address, overrides)//await? promise?s
            // let wait = await response.wait()
            // console.log(wait.events)
            resolve(response)

        })
    }
    catch (error) {
        console.log("error.... ", error) //fires as the contract reverted the payment
      }
    
    //uint16 depositAmount,uint16 tokenId, uint256[2] babyPubKey, address withdrawAddress
         
  }
  
module.exports = {
    deposit
  };

  