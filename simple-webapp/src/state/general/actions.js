import * as CONSTANTS from './constants';
import * as rollup from '../../utils/bundle-cli';
import * as operator from '../../utils/bundle-op';

const ethers = require('ethers');
const { readFile } = require('../../utils/utils');
const FileSaver = require('file-saver');

function loadWallet() {
  return {
    type: CONSTANTS.LOAD_WALLET,
  };
}

function loadWalletSuccess(wallet, password) {
  return {
    type: CONSTANTS.LOAD_WALLET_SUCCESS,
    payload: { wallet, password },
    error: '',
  };
}

function loadWalletError(error) {
  return {
    type: CONSTANTS.LOAD_WALLET_ERROR,
    error,
  };
}

export function handleLoadWallet(walletFile, password, file) {
  return function (dispatch) {
    dispatch(loadWallet());
    return new Promise(async () => {
      try {
        let wallet;
        if (file) {
          wallet = await readFile(walletFile);
        } else {
          wallet = walletFile;
        }
        console.log(wallet);
        await rollup.wallet.Wallet.fromEncryptedJson(wallet, password);
        dispatch(loadWalletSuccess(wallet, password));
      } catch (error) {
        dispatch(loadWalletError(error));
      }
    });
  };
}

function createWallet() {
  return {
    type: CONSTANTS.CREATE_WALLET,
  };
}

function createWalletSuccess() {
  return {
    type: CONSTANTS.CREATE_WALLET_SUCCESS,
    error: '',
  };
}

function createWalletError(error) {
  return {
    type: CONSTANTS.CREATE_WALLET_ERROR,
    error,
  };
}

export function handleCreateWallet(walletName, password) {
  return function (dispatch) {
    dispatch(createWallet());
    return new Promise(async (resolve) => {
      try {
        const wallet = await rollup.wallet.Wallet.createRandom();
        const encWallet = await wallet.toEncryptedJson(password);
        dispatch(createWalletSuccess());
        const blob = new Blob([JSON.stringify(encWallet)], { type: 'text/plain;charset=utf-8' });
        FileSaver.saveAs(blob, `${walletName}.json`);
        resolve(encWallet);
      } catch (error) {
        console.log(error);
        dispatch(createWalletError(error));
      }
    });
  };
}

export function resetWallet() {
  return function (dispatch) {
    return new Promise(async () => {
      try {
        dispatch(loadWalletSuccess({}, ''));
      } catch (error) {
        dispatch(loadWalletError(error));
      }
    });
  };
}

function loadFiles() {
  return {
    type: CONSTANTS.LOAD_FILES,
  };
}

function loadFilesSuccess(config, abiRollup, abiTokens) {
  return {
    type: CONSTANTS.LOAD_FILES_SUCCESS,
    payload: { config, abiRollup, abiTokens },
    error: '',
  };
}

function loadFilesError(error) {
  return {
    type: CONSTANTS.LOAD_FILES_ERROR,
    error,
  };
}

export function handleLoadFiles(config) {
  return function (dispatch) {
    dispatch(loadFiles());
    return new Promise(async (resolve) => {
      try {
        console.log(config)
        dispatch(loadFilesSuccess(config, config.abiRollup, config.abiTokens ));
      } catch (error) {
        dispatch(loadFilesError(error));
      }
    });
  };
}

function loadOperator() {
  return {
    type: CONSTANTS.LOAD_OPERATOR,
  };
}

function loadOperatorSuccess(apiOperator) {
  return {
    type: CONSTANTS.LOAD_OPERATOR_SUCCESS,
    payload: apiOperator,
    error: '',
  };
}

function loadOperatorError(error) {
  return {
    type: CONSTANTS.LOAD_OPERATOR_ERROR,
    error,
  };
}

export function handleLoadOperator(config) {
  return function (dispatch) {
    dispatch(loadOperator());
    return new Promise(async (resolve) => {
      try {
        const apiOperator = new operator.cliExternalOperator(config.operator);
        dispatch(loadOperatorSuccess(apiOperator));
      } catch (error) {
        console.log(error);
        dispatch(loadOperatorError(error));
      }
    });
  };
}


function infoAccount() {
  return {
    type: CONSTANTS.INFO_ACCOUNT,
  };
}

function infoAccountSuccess(balance, tokens, tokensR, tokensA, txs) {
  return {
    type: CONSTANTS.INFO_ACCOUNT_SUCCESS,
    payload: {
 balance, tokens, tokensR, tokensA, txs 
},
    error: '',
  };
}

function infoAccountError(error) {
  return {
    type: CONSTANTS.INFO_ACCOUNT_ERROR,
    error,
  };
}

export function handleInfoAccount(node, addressTokens, abiTokens, encWallet, password, operatorUrl, addressRollup) {
  return function (dispatch) {
    dispatch(infoAccount());
    return new Promise(async (resolve) => {
      try {
        const provider = new ethers.providers.JsonRpcProvider(node);
        const wallet = await rollup.wallet.Wallet.fromEncryptedJson(encWallet, password);
        let walletEth = new ethers.Wallet(wallet.ethWallet.privateKey);
        walletEth = walletEth.connect(provider);
        const balanceHex = await walletEth.getBalance();
        const balance = ethers.utils.formatEther(balanceHex);
        const contractTokens = new ethers.Contract(addressTokens, abiTokens, provider);
        let tokens;
        let tokensA;
        try { 
          const tokensHex = await contractTokens.balanceOf(encWallet.ethWallet.address);
          const tokensAHex = await contractTokens.allowance(encWallet.ethWallet.address, addressRollup);
          tokens = tokensHex.toString();
          tokensA = tokensAHex.toString();
        } catch (err) {
          console.log(err);
          tokens = '0';
          tokensA = '0';
        }
        const apiOperator = new operator.cliExternalOperator(operatorUrl);
        const filters = {
          ethAddr: `0x${encWallet.ethWallet.address}`,
        };
        let tokensRNum = 0;
        const txs = [];
        try {
          const allTxs = await apiOperator.getAccounts(filters);
          const initTx = allTxs.data[0].idx;
          const numTx = allTxs.data[allTxs.data.length - 1].idx;
          for (let i = initTx; i <= numTx; i++) {
            if (allTxs.data.find((tx) => tx.idx === i) !== undefined) {
              txs.push(allTxs.data.find((tx) => tx.idx === i));
              tokensRNum += parseInt(allTxs.data.find(tx => tx.idx === i).amount);
            }
          }
        } catch (err) {
          tokensRNum = 0;
        }
        const tokensR = tokensRNum.toString();
        dispatch(infoAccountSuccess(balance, tokens, tokensR, tokensA, txs));
      } catch (error) {
        console.log(error);
        dispatch(infoAccountError(error));
      }
    });
  };
}
