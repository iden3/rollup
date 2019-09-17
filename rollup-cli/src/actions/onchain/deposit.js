const ethers = require('ethers');
const fs = require('fs');


async function deposit(urlNodo, addressSC, balance, tokenId, walletEth, password, pubKeyBabyjub, abi)  {
    //config.json: urlNodo, addresssc, walleteth,pubkeybabyjub

    
    const provider = new ethers.providers.JsonRpcProvider(urlNodo);
    let wallet =await ethers.Wallet.fromEncryptedJson(walletEth, password);
    wallet = wallet.connect(provider);
    let address = await wallet.getAddress()
    
    let contractWithSigner = new Contract(addressSC, abi, wallet)

    // let transaction = {
    //     nonce: provider.getBalance(walllet.getAddress()),
    //     gasLimit: 21000,
    //     gasPrice: utils.bigNumberify("20000000000"),
    //     to: addressSC,
    //     value: utils.parseEther(balance.toString()), //value: utils.parseEther("1.0"),
    //     data: "0x",
    //     chainId:provider.getNetwork.chainId
    // }
      //let signPromise = await wallet.sign(transaction)
    // provider.sendTransaction(signedTransaction).then((tx) => {
    //     console.log(tx);
    // });

    //return id;
    let response = await contractWithSigner.deposit(balance, tokenId, pubKeyBabyjub, 
    address,{ from: address, value: web3.utils.toWei("1", "ether") })//uint16 depositAmount,uint16 tokenId, uint256[2] babyPubKey, address withdrawAddress
    console.log(response)
  }
  

module.exports = {
    deposit
  };