import {
  fix2float,
} from './utils';

const ethers = require('ethers');
const Web3 = require('web3');
const { Scalar } = require('ffjavascript');
const operator = require('bundle-op');

/**
 * Get current average gas price from the last ethereum blocks and multiply it
 * @param {Number} multiplier - multiply the average gas price by this parameter
 * @param {Object} provider - ethereum provider object
 * @returns {Promise} - promise will return the gas price obtained.
*/
async function getGasPrice(multiplier, provider) {
  const strAvgGas = await provider.getGasPrice();
  const avgGas = Scalar.e(strAvgGas);
  const res = (avgGas * Scalar.e(multiplier));
  const retValue = res.toString();
  return retValue;
}

export const deposit = async (nodeEth, addressSC, loadAmount, tokenId, walletRollup,
  ethAddress, abi, gasLimit = 5000000, gasMultiplier = 1) => {
  const web3 = new Web3(Web3.givenProvider || nodeEth);
  const walletBaby = walletRollup.babyjubWallet;
  const pubKeyBabyjub = [walletBaby.publicKey[0].toString(), walletBaby.publicKey[1].toString()];

  if (web3.currentProvider.host) {
    let walletEth = walletRollup.ethWallet.wallet;
    const provider = new ethers.providers.JsonRpcProvider(nodeEth);
    walletEth = walletEth.connect(provider);
    const contractWithSigner = new ethers.Contract(addressSC, abi, walletEth);

    const address = ethAddress || await walletEth.getAddress();

    const feeOnchainTx = await contractWithSigner.feeOnchainTx();
    const feeDeposit = await contractWithSigner.depositFee();

    const overrides = {
      gasLimit,
      gasPrice: await getGasPrice(gasMultiplier, provider),
      value: `0x${(Scalar.add(feeOnchainTx, feeDeposit)).toString(16)}`,
    };
    try {
      return await contractWithSigner.deposit(loadAmount, tokenId, address, pubKeyBabyjub, overrides);
    } catch (error) {
      throw new Error(`Message error: ${error.message}`);
    }
  } else {
    const accounts = await web3.eth.requestAccounts();
    const contract = new web3.eth.Contract(abi, addressSC);
    const feeOnchainTx = await contract.methods.feeOnchainTx().call();
    const feeDeposit = await contract.methods.depositFee().call();
    const account = accounts[0];

    const tx = {
      from: account,
      to: addressSC,
      gasLimit,
      gasPrice: await getGasPrice(gasMultiplier, web3.eth),
      value: `0x${(Scalar.add(feeOnchainTx, feeDeposit)).toString(16)}`,
      data: contract.methods.deposit(loadAmount, tokenId, account, pubKeyBabyjub).encodeABI(),
    };
    try {
      const hash = await web3.eth.personal.sendTransaction(tx);
      return await web3.eth.getTransaction(hash);
    } catch (error) {
      throw new Error(`Message error: ${error.message}`);
    }
  }
};

export const depositOnTop = async (nodeEth, addressSC, loadAmount, tokenId, babyjubTo, walletRollup,
  abi, gasLimit = 5000000, gasMultiplier = 1) => {
  const web3 = new Web3(Web3.givenProvider || nodeEth);

  if (web3.currentProvider.host) {
    let walletEth = walletRollup.ethWallet.wallet;
    const provider = new ethers.providers.JsonRpcProvider(nodeEth);
    walletEth = walletEth.connect(provider);
    const contractWithSigner = new ethers.Contract(addressSC, abi, walletEth);

    const feeOnchainTx = await contractWithSigner.feeOnchainTx();
    const overrides = {
      gasLimit,
      gasPrice: await getGasPrice(gasMultiplier, provider),
      value: feeOnchainTx,
    };

    try {
      return await contractWithSigner.depositOnTop(babyjubTo, loadAmount, tokenId, overrides);
    } catch (error) {
      throw new Error(`Message error: ${error.message}`);
    }
  } else {
    const accounts = await web3.eth.requestAccounts();
    const contract = new web3.eth.Contract(abi, addressSC);
    const feeOnchainTx = await contract.methods.feeOnchainTx().call();
    const account = accounts[0];

    const tx = {
      from: account,
      to: addressSC,
      gasLimit,
      gasPrice: await getGasPrice(gasMultiplier, web3.eth),
      value: feeOnchainTx,
      data: contract.methods.depositOnTop(babyjubTo, loadAmount, tokenId).encodeABI(),
    };
    try {
      const hash = await web3.eth.personal.sendTransaction(tx);
      return await web3.eth.getTransaction(hash);
    } catch (error) {
      throw new Error(`Message error: ${error.message}`);
    }
  }
};

export const withdraw = async (nodeEth, addressSC, tokenId, walletRollup, abi, urlOperator,
  numExitRoot, gasLimit = 5000000, gasMultiplier = 1) => {
  const web3 = new Web3(Web3.givenProvider || nodeEth);
  const apiOperator = new operator.cliExternalOperator(urlOperator);
  const walletBaby = walletRollup.babyjubWallet;
  const pubKeyBabyjub = [walletBaby.publicKey[0].toString(16), walletBaby.publicKey[1].toString(16)];
  const pubKeyBabyjubEthCall = [walletBaby.publicKey[0].toString(), walletBaby.publicKey[1].toString()];

  if (web3.currentProvider.host) {
    let walletEth = walletRollup.ethWallet.wallet;
    const provider = new ethers.providers.JsonRpcProvider(nodeEth);
    walletEth = walletEth.connect(provider);
    const contractWithSigner = new ethers.Contract(addressSC, abi, walletEth);

    const overrides = {
      gasLimit,
      gasPrice: await getGasPrice(gasMultiplier, provider),
    };

    try {
      const res = await apiOperator.getExitInfo(tokenId, pubKeyBabyjub[0], pubKeyBabyjub[1], numExitRoot);
      const infoExitTree = res.data;
      if (infoExitTree.found) {
        return await contractWithSigner.withdraw(infoExitTree.state.amount, numExitRoot,
          infoExitTree.siblings, pubKeyBabyjubEthCall, tokenId, overrides);
      }
      throw new Error(`No exit tree leaf was found in batch: ${numExitRoot} with babyjub: ${pubKeyBabyjub}`);
    } catch (error) {
      throw new Error(`Message error: ${error.message}`);
    }
  } else {
    const accounts = await web3.eth.requestAccounts();
    const contract = new web3.eth.Contract(abi, addressSC);
    const account = accounts[0];

    try {
      const res = await apiOperator.getExitInfo(tokenId, pubKeyBabyjub[0], pubKeyBabyjub[1], numExitRoot);
      const infoExitTree = res.data;
      const tx = {
        from: account,
        to: addressSC,
        gasLimit,
        gasPrice: await getGasPrice(gasMultiplier, web3.eth),
        data: contract.methods.withdraw(infoExitTree.state.amount, numExitRoot,
          infoExitTree.siblings, pubKeyBabyjubEthCall, tokenId).encodeABI(),
      };
      const hash = await web3.eth.personal.sendTransaction(tx);
      return await web3.eth.getTransaction(hash);
    } catch (error) {
      throw new Error(`Message error: ${error.message}`);
    }
  }
};

export const forceWithdraw = async (nodeEth, addressSC, tokenId, amount, walletRollup, abi,
  gasLimit = 5000000, gasMultiplier = 1) => {
  const web3 = new Web3(Web3.givenProvider || nodeEth);
  const walletBaby = walletRollup.babyjubWallet;
  const pubKeyBabyjub = [walletBaby.publicKey[0].toString(16), walletBaby.publicKey[1].toString(16)];

  if (web3.currentProvider.host) {
    let walletEth = walletRollup.ethWallet.wallet;
    const provider = new ethers.providers.JsonRpcProvider(nodeEth);
    walletEth = walletEth.connect(provider);
    const contractWithSigner = new ethers.Contract(addressSC, abi, walletEth);

    const feeOnchainTx = await contractWithSigner.feeOnchainTx();
    const overrides = {
      gasLimit,
      gasPrice: await getGasPrice(gasMultiplier, provider),
      value: feeOnchainTx,
    };

    const amountF = fix2float(amount);
    try {
      return await contractWithSigner.forceWithdraw(pubKeyBabyjub, tokenId, amountF, overrides);
    } catch (error) {
      throw new Error(`Message error: ${error.message}`);
    }
  } else {
    const accounts = await web3.eth.requestAccounts();
    const contract = new web3.eth.Contract(abi, addressSC);
    const account = accounts[0];

    const amountF = fix2float(amount);
    const tx = {
      from: account,
      to: addressSC,
      gasLimit,
      gasPrice: await getGasPrice(gasMultiplier, web3.eth),
      data: contract.methods.forceWithdraw(pubKeyBabyjub, tokenId, amountF).encodeABI(),
    };

    try {
      const hash = await web3.eth.personal.sendTransaction(tx);
      return await web3.eth.getTransaction(hash);
    } catch (error) {
      throw new Error(`Message error: ${error.message}`);
    }
  }
};
