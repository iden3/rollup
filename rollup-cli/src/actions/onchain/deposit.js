const ethers = require('ethers');
const fs = require('fs');
const { BabyJubWallet } = require('../../../../rollup-utils/babyjub-wallet');

async function deposit(urlNodo, addressSC, balance, tokenId, walletEthJson, BabyjubJson, password, abi)  {

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

    // const privateKey = Buffer.from(
    //     'c5c70b480bcbecb6f43fba946fb7d989e280ca408ad3aa173c1512bcc2d08ebc', 'hex') 

    // const OPTIONS = {//web3 + metamask
    //     defaultBlock: "latest",
    //     transactionConfirmationBlocks: 1,
    //     transactionBlockTimeout: 5
    //   };

    // const web3= new Web3(urlNodo,null,OPTIONS)
    // const account = '0x53878D5E54C6A8d115853cBD663bEfD07b5b118D';
    // const rollup= new web3.eth.Contract (abi,addressSC)
    // let txCount= await web3.eth.getTransactionCount(account)
    // const txObject = {
    //     nonce:    web3.utils.toHex(txCount),//0=>txCount
    //     gasLimit: web3.utils.toHex(800000), // Raise the gas limit to a much higher amount
    //     gasPrice: web3.utils.toHex(web3.utils.toWei('10', 'gwei')),
    //     to: addressSC , //addrestest  config.TODO_LIST_ADDRESS
    //     value: web3.utils.toWei('0.5', 'ether'),
    //     data: rollup.methods.deposit(balance, tokenId, BabyjubJson, account).encodeABI()
    //     //chainId:  web3.utils.toHex(29754)
    //     }
    //     const tx = new Tx(txObject)
    //     tx.sign(privateKey)
        
    //     const serializedTx = tx.serialize()
    //     const raw = '0x' + serializedTx.toString('hex')
    //     web3.eth.sendSignedTransaction(raw, (err, txHash) => {
    //     if (err)
    //     {
    //         console.log(err)
            
    //     }
    //     else{
    //         console.log(txHash)
    //     }
    // })
    


     // let transaction = {
            //     nonce: provider.getBalance(walllet.getAddress()),
            //     gasLimit: 21000,
            //     gasPrice: utils.bigNumberify("20000000000"),
            //     to: addressSC,
            //     value: utils.parseEther(balance.toString()), //value: utils.parseEther("1.0"),
            //     data: "0x",
            //     chainId:provider.getNetwork.chainId
            // }
            // let signPromise = await wallet.sign(transaction)
            // provider.sendTransaction(signedTransaction).then((tx) => {
            //     console.log(tx);
            // });