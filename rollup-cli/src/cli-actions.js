const { createEth, importEth, readFile, createBabyJub, importBabyJub, decrypt } = require('./wallet');

async function send(walletPath, passString, to, amount, operator) {
  console.log(walletPath, passString, to, amount, operator)
  const encData = await readFile(walletPath);
  const decData = decrypt(encData.encPrivateKey, passString);
  //const sign = ;
  const obj = {
      from: decData.address,
      to: to,
      amount: amount,
      operator: operator,
      //sign: sign,
  }
  console.log(obj)
}
  
function deposit(walletPath, passString) {
  console.log(walletPath, passString)
}
  
module.exports = {
  send,
  deposit
};
  