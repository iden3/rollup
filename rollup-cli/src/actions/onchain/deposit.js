const ethers = require('ethers');
const { BabyJubWallet } = require('../../../../rollup-utils/babyjub-wallet');

async function deposit(urlNodo, addressSC, balance, tokenId, walletEthJson, BabyjubJson, password, abi) {
  const provider = new ethers.providers.JsonRpcProvider(urlNodo);
  let wallet = await ethers.Wallet.fromEncryptedJson(walletEthJson, password);
  const walletBaby = await BabyJubWallet.fromEncryptedJson(BabyjubJson, password);
  const pubKeyBabyjub = [walletBaby.publicKey[0].toString(), walletBaby.publicKey[1].toString()];
  wallet = wallet.connect(provider);
  const address = await wallet.getAddress();
  const contractWithSigner = new ethers.Contract(addressSC, abi, wallet);
  const overrides = {
    gasLimit: 800000,
    value: ethers.utils.parseEther('1.0'),
  };
  try {
    return new Promise (async function (resolve){
      const response = await contractWithSigner.deposit(balance, tokenId, pubKeyBabyjub, address, overrides); //await? promise?s
      // let wait = await response.wait()
      // console.log(wait.events)
      resolve(response);
    })
  } catch (error) {
    console.log("error.... ", error) //fires as the contract reverted the payment
  }
  // uint16 depositAmount,uint16 tokenId, uint256[2] babyPubKey, address withdrawAddress      
}
  
module.exports = {
    deposit
};
