const ethers = require('ethers');
const axios = require('axios');
const { BabyJubWallet } = require('../../../../rollup-utils/babyjub-wallet');

async function depositOnTop(urlNodo, addressSC, balance, tokenId, walletEthJson, BabyjubJson, password, abi, UrlOperator) {
  const provider = new ethers.providers.JsonRpcProvider(urlNodo);
  let wallet = await ethers.Wallet.fromEncryptedJson(walletEthJson, password);
  const walletBaby = await BabyJubWallet.fromEncryptedJson(BabyjubJson, password);
  wallet = wallet.connect(provider);
  const contractWithSigner = new ethers.Contract(addressSC, abi, wallet);
  const overrides = {
    gasLimit: 800000,
    value: ethers.utils.parseEther('1.0'),
  };
  try {
    return new Promise((resolve, reject) => {
      axios.get(`${UrlOperator}/offchain/info/${walletBaby.publicKey.toString()}`).then( async function (response){
        // function depositOnTop(
        //   uint64 idBalanceTree,
        //   uint128 loadAmount,
        //   uint32 tokenId,
        //   uint48 nonce
        const receipt = await contractWithSigner.depositOnTop(response.data.value.id, balance, tokenId, overrides); // response.data.value.nonce,
        resolve(receipt);
      })
        .catch(function (error) {
          reject(error);
        });
    });
  } catch (error) {
    console.log('error.... ', error); //fires as the contract reverted the payment
  }
  // uint16 depositAmount,uint16 tokenId, uint256[2] babyPubKey, address withdrawAddress
}

module.exports = {
  depositOnTop,
};
