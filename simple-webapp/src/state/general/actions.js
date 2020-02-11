/* global BigInt */
import * as CONSTANTS from './constants';
import { getNullifier } from '../../utils/utils';

const ethers = require('ethers');
const FileSaver = require('file-saver');
const rollup = require('bundle-cli');
const operator = require('bundle-op');
const { readFile } = require('../../utils/utils');

function loadWallet() {
  return {
    type: CONSTANTS.LOAD_WALLET,
  };
}

function loadWalletSuccess(wallet, password, desWallet) {
  return {
    type: CONSTANTS.LOAD_WALLET_SUCCESS,
    payload: { wallet, password, desWallet },
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
  return async function (dispatch) {
    dispatch(loadWallet());
    try {
      let wallet;
      if (file) {
        wallet = await readFile(walletFile);
      } else {
        wallet = walletFile;
      }
      const desWallet = await rollup.wallet.Wallet.fromEncryptedJson(wallet, password);
      dispatch(loadWalletSuccess(wallet, password, desWallet));
    } catch (error) {
      dispatch(loadWalletError(error.message));
    }
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

function loadFilesSuccess(config, abiRollup, abiTokens, chainId, errorMessage) {
  return {
    type: CONSTANTS.LOAD_FILES_SUCCESS,
    payload: {
      config, abiRollup, abiTokens, chainId,
    },
    error: errorMessage,
  };
}

function loadFilesError(config, error) {
  return {
    type: CONSTANTS.LOAD_FILES_ERROR,
    payload: { config },
    error,
  };
}

export function handleLoadFiles(config) {
  return function (dispatch) {
    dispatch(loadFiles());
    return new Promise(async (resolve) => {
      try {
        const Web3 = require('web3');
        let chainId;
        let web3;
        let errorMessage = '';
        if (config.nodeEth) {
          web3 = new Web3(config.nodeEth);
          chainId = await web3.eth.getChainId();
        } else {
          chainId = -1;
          errorMessage = 'No Node Ethereum';
        }
        if (!config.operator) errorMessage = 'No operator';
        if (!config.address) errorMessage = 'No Rollup Address';
        if (!config.abiRollup) errorMessage = 'No Rollup ABI';
        if (!config.abiTokens) errorMessage = 'No Tokens ABI';
        if (!config.tokensAddress) errorMessage = 'No Tokens Address';

        if (errorMessage !== '') {
          resolve(false);
        } else {
          resolve(true);
        }
        dispatch(loadFilesSuccess(config, config.abiRollup, config.abiTokens, chainId, errorMessage));
      } catch (error) {
        const newConfig = config;
        newConfig.nodeEth = undefined;
        resolve(false);
        dispatch(loadFilesError(newConfig, 'Error Configuration'));
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
    try {
      const apiOperator = new operator.cliExternalOperator(config.operator);
      dispatch(loadOperatorSuccess(apiOperator));
    } catch (error) {
      dispatch(loadOperatorError(error));
    }
  };
}


function infoAccount() {
  return {
    type: CONSTANTS.INFO_ACCOUNT,
  };
}

function infoAccountSuccess(balance, tokens, tokensR, tokensA, tokensE, txs, txsExits) {
  return {
    type: CONSTANTS.INFO_ACCOUNT_SUCCESS,
    payload: {
      balance, tokens, tokensR, tokensA, tokensE, txs, txsExits,
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

export function handleInfoAccount(node, addressTokens, abiTokens, wallet, operatorUrl, addressRollup, abiRollup) {
  return async function (dispatch) {
    dispatch(infoAccount());
    try {
      let tokens = '0';
      let tokensA = '0';
      let tokensE = '0';
      let tokensR = '0';
      const txs = [];
      const txsExits = [];
      const provider = new ethers.providers.JsonRpcProvider(node);
      const walletEthAddress = wallet.ethWallet.address;
      let walletEth = new ethers.Wallet(wallet.ethWallet.privateKey);
      walletEth = walletEth.connect(provider);
      const balanceHex = await provider.getBalance(walletEthAddress);
      const balance = ethers.utils.formatEther(balanceHex);
      const contractTokens = new ethers.Contract(addressTokens, abiTokens, provider);
      const apiOperator = new operator.cliExternalOperator(operatorUrl);
      const filters = {};
      if (walletEthAddress.startsWith('0x')) filters.ethAddr = walletEthAddress;
      else filters.ethAddr = `0x${walletEthAddress}`;
      const contractRollup = new ethers.Contract(addressRollup, abiRollup, walletEth);
      const tokensHex = await contractTokens.balanceOf(walletEthAddress);
      const tokensAHex = await contractTokens.allowance(walletEthAddress, addressRollup);
      let allTxs = {};
      try {
        allTxs = await apiOperator.getAccounts(filters);
      } catch (err) {
        allTxs.data = [];
      }
      const tokensRNum = getTokensRollup(allTxs, txs);
      const tokensENum = await getTokensExit(txsExits, apiOperator, wallet, allTxs, contractRollup);
      tokens = tokensHex.toString();
      tokensA = tokensAHex.toString();
      tokensE = tokensENum.toString();
      tokensR = tokensRNum.toString();
      dispatch(infoAccountSuccess(balance, tokens, tokensR, tokensA, tokensE, txs, txsExits));
    } catch (error) {
      dispatch(infoAccountError(error));
    }
  };
}

function getTokensRollup(allTxs, txs) {
  let tokensRNum = BigInt(0);
  if (allTxs.data.length !== 0) {
    const initTx = allTxs.data[0].idx;
    const numTx = allTxs.data[allTxs.data.length - 1].idx;
    for (let i = initTx; i <= numTx; i++) {
      if (allTxs.data.find((tx) => tx.idx === i) !== undefined) {
        txs.push(allTxs.data.find((tx) => tx.idx === i));
        tokensRNum += BigInt(allTxs.data.find((tx) => tx.idx === i).amount);
      }
    }
  }
  return tokensRNum;
}

async function getTokensExit(txsExits, apiOperator, wallet, allTxs, contractRollup) {
  let tokensENum = BigInt(0);
  for (const tx in allTxs.data) {
    if ({}.hasOwnProperty.call(allTxs.data, tx)) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const exits = await apiOperator.getExits(allTxs.data[tx].idx);
        const batches = exits.data;
        if (batches) {
          for (const batch in batches) {
            if ({}.hasOwnProperty.call(batches, batch)) {
              // eslint-disable-next-line no-await-in-loop
              const info = await apiOperator.getExitInfo(allTxs.data[tx].idx, batches[batch]);
              if (info.data.found) {
                // eslint-disable-next-line no-await-in-loop
                const boolNullifier = await getNullifier(wallet, info, contractRollup, batches[batch]);
                if (!boolNullifier) {
                  if (!txsExits.find((leaf) => leaf.idx === allTxs.data[tx].idx && leaf.batch === batches[batch])) {
                    const amount = ethers.utils.formatEther(info.data.state.amount);
                    txsExits.push({
                      idx: allTxs.data[tx].idx, batch: batches[batch], amount,
                    });
                    tokensENum += BigInt(info.data.state.amount);
                  }
                }
              }
            }
          }
        }
      } catch (err) {
        // eslint-disable-next-line no-continue
        continue;
      }
    }
  }
  return tokensENum;
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

function setGasMultiplier(num) {
  return {
    type: CONSTANTS.SET_GAS_MULTIPLIER,
    payload: num,
  };
}

export function selectGasMultiplier(num) {
  return function (dispatch) {
    dispatch(setGasMultiplier(num));
  };
}

function getInfoOperator() {
  return {
    type: CONSTANTS.INFO_OPERATOR,
  };
}

function getInfoOperatorSuccess(currentBlock, currentEra, currentSlot, currentBatch) {
  return {
    type: CONSTANTS.INFO_OPERATOR_SUCCESS,
    payload: {
      currentBlock, currentEra, currentSlot, currentBatch,
    },
    error: '',
  };
}

function getInfoOperatorError(error) {
  return {
    type: CONSTANTS.INFO_OPERATOR_ERROR,
    error,
  };
}


export function handleInfoOperator(operatorUrl) {
  return async function (dispatch) {
    dispatch(getInfoOperator());
    try {
      const apiOperator = new operator.cliExternalOperator(operatorUrl);
      const res = await apiOperator.getState();
      const generalInfo = res.data;
      const { currentBlock } = generalInfo;
      const { currentEra } = generalInfo.posSynch;
      const { currentSlot } = generalInfo.posSynch;
      const currentBatch = generalInfo.rollupSynch.lastBatchSynched;
      dispatch(getInfoOperatorSuccess(currentBlock, currentEra, currentSlot, currentBatch));
    } catch (error) {
      dispatch(getInfoOperatorError(error));
    }
  };
}
