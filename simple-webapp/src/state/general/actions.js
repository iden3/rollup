import * as CONSTANTS from './constants';
import * as rollup from '../../utils/bundle-cli';
import * as operator from '../../utils/bundle-op';

const ethers = require('ethers');
const FileSaver = require('file-saver');
const { readFile } = require('../../utils/utils');

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
        // eslint-disable-next-line no-console
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

function loadFilesSuccess(config, abiRollup, abiTokens, chainId) {
  return {
    type: CONSTANTS.LOAD_FILES_SUCCESS,
    payload: {
      config, abiRollup, abiTokens, chainId,
    },
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
    return new Promise(async () => {
      try {
        const Web3 = require('web3');
        const web3 = new Web3(config.nodeEth);
        const chainId = await web3.eth.getChainId();
        dispatch(loadFilesSuccess(config, config.abiRollup, config.abiTokens, chainId));
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
    return new Promise(async () => {
      try {
        const apiOperator = new operator.cliExternalOperator(config.operator);
        dispatch(loadOperatorSuccess(apiOperator));
      } catch (error) {
        // eslint-disable-next-line no-console
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
      balance, tokens, tokensR, tokensA, txs,
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
    return new Promise(async () => {
      try {
        const provider = new ethers.providers.JsonRpcProvider(node);
        const walletEthAddress = encWallet.ethWallet.address;
        const balanceHex = await provider.getBalance(walletEthAddress);
        const balance = ethers.utils.formatEther(balanceHex);
        const contractTokens = new ethers.Contract(addressTokens, abiTokens, provider);
        const apiOperator = new operator.cliExternalOperator(operatorUrl);
        const filters = {};
        if (walletEthAddress.startsWith('0x')) filters.ethAddr = walletEthAddress;
        else filters.ethAddr = `0x${walletEthAddress}`;
        let tokens = '0';
        let tokensA = '0';
        let tokensRNum = 0;
        const txs = [];
        try {
          const tokensHex = await contractTokens.balanceOf(encWallet.ethWallet.address);
          const tokensAHex = await contractTokens.allowance(encWallet.ethWallet.address, addressRollup);
          tokens = tokensHex.toString();
          tokensA = tokensAHex.toString();
          const allTxs = await apiOperator.getAccounts(filters);
          const initTx = allTxs.data[0].idx;
          const numTx = allTxs.data[allTxs.data.length - 1].idx;
          for (let i = initTx; i <= numTx; i++) {
            if (allTxs.data.find((tx) => tx.idx === i) !== undefined) {
              txs.push(allTxs.data.find((tx) => tx.idx === i));
              // eslint-disable-next-line radix
              tokensRNum += parseInt(allTxs.data.find((tx) => tx.idx === i).amount);
            }
          }
        } catch (err) {
          dispatch(infoAccountError(err));
        }
        const tokensR = tokensRNum.toString();
        dispatch(infoAccountSuccess(balance, tokens, tokensR, tokensA, txs));
      } catch (error) {
        // eslint-disable-next-line no-console
        console.log(error);
        dispatch(infoAccountError(error));
      }
    });
  };
}

function checkApprovedTokensError() {
  return {
    type: CONSTANTS.CHECK_APPROVED_TOKENS_ERROR,
  };
}

export function checkApprovedTokens(tokensToSend, approvedTokens) {
  return function (dispatch) {
    if (tokensToSend > approvedTokens) {
      dispatch(checkApprovedTokensError());
    }
  };
}

function checkEtherError() {
  return {
    type: CONSTANTS.CHECK_ETHER_ERROR,
  };
}

export function checkEther(etherToSend, ether) {
  return function (dispatch) {
    if (etherToSend > ether) {
      dispatch(checkEtherError());
    }
  };
}

function initApprovedTokensError() {
  return {
    type: CONSTANTS.INIT_ETHER_ERROR,
  };
}

function initEtherError() {
  return {
    type: CONSTANTS.INIT_APPROVED_TOKENS_ERROR,
  };
}

export function initErrors() {
  return function (dispatch) {
    dispatch(initApprovedTokensError());
    dispatch(initEtherError());
  };
}
