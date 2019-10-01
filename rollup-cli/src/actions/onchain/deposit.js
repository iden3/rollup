const ethers = require("ethers");
const { Wallet } = require("../../wallet.js");

/**
 * @dev Deposit on-chain transaction
 * add new leaf to balance tree and initializes it with a load amount
 * @param urlNode URL of the ethereum node
 * @param addressSC Rollup address
 * @param walletJson From this one can obtain the ethAddress and BabyPubKey
 * @param password For desencrypt the Wallet
 * @param abi abi of Rollup Contract
 * @params_for_TxDeposit :
    * @param balance initial balance on balance tree
    * @param tokenId token type identifier
    * @param ethAddress allowed address to control new balance tree leaf
    * @param babyPubKey public key babyjubjub represented as point (Ax, Ay)  
*/
           
async function deposit(urlNode, addressSC, balance, tokenId, walletJson, password, abi)  {

    let walletRollup= await Wallet.fromEncryptedJson(walletJson, password);
    let walletEth = walletRollup.ethWallet.wallet;
    let walletBaby = walletRollup.babyjubWallet;


    const provider = new ethers.providers.JsonRpcProvider(urlNode);
    let pubKeyBabyjub = [walletBaby.publicKey[0].toString(), walletBaby.publicKey[1].toString()] ;

    walletEth = walletEth.connect(provider);
    let address = await walletEth.getAddress();
    let contractWithSigner = new ethers.Contract(addressSC, abi, walletEth);
    
    let overrides = {
        gasLimit: 800000,
        value: ethers.utils.parseEther("0.11"),
    };
    
    try{
        return new Promise (function (resolve){
            contractWithSigner.deposit(balance, tokenId, address, pubKeyBabyjub, overrides).then(response => {
                resolve(response);
            });
        });
    }
    catch (error) {
        console.log("error.... ", error); //fires as the contract reverted the payment
    }
     
}
  
module.exports = {
    deposit
};

  