import * as CONSTANTS from './constants';

const ethers = require('ethers');
const rollup = require('bundle-cli');
const operator = require('bundle-op');
const abiDecoder = require('abi-decoder');
const Web3 = require('web3');

const gasLimit = 5000000;

function sendDeposit() {
  return {
    type: CONSTANTS.SEND_DEPOSIT,
  };
}

function sendDepositSuccess(res, currentBatch) {
  return {
    type: CONSTANTS.SEND_DEPOSIT_SUCCESS,
    payload: { res, currentBatch },
    error: '',
  };
}

function sendDepositError(error) {
  return {
    type: CONSTANTS.SEND_DEPOSIT_ERROR,
    error,
  };
}

export function handleSendDeposit(nodeEth, addressSC, amount, tokenId, wallet, ethAddress,
  abiRollup, gasMultiplier, operatorUrl) {
  return function (dispatch) {
    dispatch(sendDeposit());
    return new Promise(async (resolve) => {
      try {
        if (amount === '0') {
          dispatch(sendDepositError('Deposit Error: \'The amount must be greater than 0\''));
          resolve('Deposit Error');
        } else {
          const apiOperator = new operator.cliExternalOperator(operatorUrl);
          const resOperator = await apiOperator.getState();
          const currentBatch = resOperator.data.rollupSynch.lastBatchSynched;
          const res = await rollup.onchain.deposit.deposit(nodeEth, addressSC, amount, tokenId, wallet,
            ethAddress, abiRollup, gasLimit, gasMultiplier);
          dispatch(sendDepositSuccess(res, currentBatch));
          resolve({ res, currentBatch });
        }
      } catch (error) {
        dispatch(sendDepositError(`Deposit Error: ${error.message}`));
        resolve(error);
      }
    });
  };
}

function sendWithdraw() {
  return {
    type: CONSTANTS.SEND_WITHDRAW,
  };
}

function sendWithdrawSuccess(res, currentBatch) {
  return {
    type: CONSTANTS.SEND_WITHDRAW_SUCCESS,
    payload: { res, currentBatch },
    error: '',
  };
}

function sendWithdrawError(error) {
  return {
    type: CONSTANTS.SEND_WITHDRAW_ERROR,
    error,
  };
}

export function handleSendWithdraw(nodeEth, addressSC, wallet, abiRollup, op,
  idFrom, numExitRoot, gasMultiplier) {
  return function (dispatch) {
    dispatch(sendWithdraw());
    return new Promise(async (resolve) => {
      try {
        if (numExitRoot === -1) {
          dispatch(sendWithdrawError('The num exit root must be entered'));
          resolve('No numExitRoot');
        } else {
          const apiOperator = new operator.cliExternalOperator(op);
          const resOperator = await apiOperator.getState();
          const currentBatch = resOperator.data.rollupSynch.lastBatchSynched;
          const res = await rollup.onchain.withdraw.withdraw(nodeEth, addressSC, wallet, abiRollup,
            op, idFrom, numExitRoot, gasLimit, gasMultiplier);
          abiDecoder.addABI(abiRollup);
          const web3 = new Web3(nodeEth);
          const txData = await web3.eth.getTransaction(res.hash);
          const decodedData = abiDecoder.decodeMethod(txData.input);
          const amount = decodedData.params[1].value;
          dispatch(sendWithdrawSuccess(res, currentBatch));
          resolve({ res, currentBatch, amount });
        }
      } catch (error) {
        dispatch(sendWithdrawError(`Withdraw Error: ${error.message}`));
        resolve(error);
      }
    });
  };
}

function sendForceExit() {
  return {
    type: CONSTANTS.SEND_FORCE_EXIT,
  };
}

function sendForceExitSuccess(res, currentBatch) {
  return {
    type: CONSTANTS.SEND_FORCE_EXIT_SUCCESS,
    payload: { res, currentBatch },
    error: '',
  };
}

function sendForceExitError(error) {
  return {
    type: CONSTANTS.SEND_FORCE_EXIT_ERROR,
    error,
  };
}

export function handleSendForceExit(nodeEth, addressSC, amount, wallet, abiRollup, urlOperator,
  idFrom, gasMultiplier) {
  return function (dispatch) {
    dispatch(sendForceExit());
    return new Promise(async (resolve) => {
      try {
        const apiOperator = new operator.cliExternalOperator(urlOperator);
        const resId = await apiOperator.getAccountByIdx(idFrom);
        let { address } = wallet.ethWallet;
        if (!wallet.ethWallet.address.startsWith('0x')) {
          address = `0x${wallet.ethWallet.address}`;
        }
        if (resId && resId.data.ethAddress.toUpperCase() === address.toUpperCase()) {
          const resOperator = await apiOperator.getState();
          const currentBatch = resOperator.data.rollupSynch.lastBatchSynched;
          const res = await rollup.onchain.forceWithdraw.forceWithdraw(nodeEth, addressSC,
            amount, wallet, abiRollup, idFrom, gasLimit, gasMultiplier);
          dispatch(sendForceExitSuccess(res, currentBatch));
          resolve({ res, currentBatch });
        } else {
          dispatch(sendForceExitError('This is not your ID'));
          resolve('This is not your ID');
        }
      } catch (error) {
        dispatch(sendSendError(`Send Error: ${error.message}`));
        resolve(error);
      }
    });
  };
}

function getIds() {
  return {
    type: CONSTANTS.GET_IDS,
  };
}

function getIdsSuccess(res) {
  return {
    type: CONSTANTS.GET_IDS_SUCCESS,
    payload: res,
    error: '',
  };
}

function getIdsError(error) {
  return {
    type: CONSTANTS.GET_IDS_ERROR,
    error,
  };
}

export function handleGetIds(urlOperator, filters, address) {
  return function (dispatch) {
    dispatch(getIds());
    return new Promise(async (resolve) => {
      try {
        const apiOperator = new operator.cliExternalOperator(urlOperator);
        const res = await apiOperator.getAccounts(filters);
        const ids = [];
        res.data.map(async (key) => {
          ids.push({
            key: key.idx, value: key.idx, amount: key.amount, text: key.idx,
          });
        });
        resolve(ids);
        dispatch(getIdsSuccess(ids));
      } catch (err) {
        resolve([]);
        dispatch(getIdsError(`There are no IDs associated with this address ${address}`));
      }
    });
  };
}

function sendSend() {
  return {
    type: CONSTANTS.SEND_SEND,
  };
}

function sendSendSuccess(nonce, currentBatch) {
  return {
    type: CONSTANTS.SEND_SEND_SUCCESS,
    payload: { nonce, currentBatch },
    error: '',
  };
}

function sendSendError(error) {
  return {
    type: CONSTANTS.SEND_SEND_ERROR,
    error,
  };
}

export function handleSendSend(urlOperator, idTo, amount, wallet, tokenId, fee, idFrom) {
  return function (dispatch) {
    dispatch(sendSend());
    return new Promise(async (resolve) => {
      try {
        if (fee === '0') {
          dispatch(sendSendError(
            'If a fee greater than 1 token is not entered,the operator will not forge the transaction',
          ));
          resolve('If a fee greater than 1 token is not entered, the operator will not forge the transaction');
        } else {
          const item = localStorage.getItem('nonceObject');
          let nonceObject;
          if (item === null) {
            nonceObject = undefined;
          } else {
            nonceObject = JSON.parse(item);
          }
          const apiOperator = new operator.cliExternalOperator(urlOperator);
          const resId = await apiOperator.getAccountByIdx(idFrom);
          let { address } = wallet.ethWallet;
          if (!wallet.ethWallet.address.startsWith('0x')) {
            address = `0x${wallet.ethWallet.address}`;
          }
          if (resId && resId.data.ethAddress.toUpperCase() === address.toUpperCase()) {
            const resOperator = await apiOperator.getState();
            const currentBatch = resOperator.data.rollupSynch.lastBatchSynched;
            const res = await rollup.offchain.send.send(urlOperator, idTo, amount, wallet, tokenId,
              fee, idFrom, undefined, nonceObject);
            localStorage.setItem('nonceObject', JSON.stringify(res.nonceObject));
            dispatch(sendSendSuccess(res.nonce, currentBatch));
            resolve(res);
          } else {
            dispatch(sendSendError('This is not your ID'));
            resolve('This is not your ID');
          }
        }
      } catch (error) {
        dispatch(sendSendError(`Send Error: ${error.message}`));
        resolve(error);
      }
    });
  };
}

function approve() {
  return {
    type: CONSTANTS.APPROVE,
  };
}

function approveSuccess(res) {
  return {
    type: CONSTANTS.APPROVE_SUCCESS,
    payload: res,
    error: '',
  };
}

function approveError(error) {
  return {
    type: CONSTANTS.APPROVE_ERROR,
    error,
  };
}

export function handleApprove(addressTokens, abiTokens, wallet, amountToken, addressRollup,
  node, gasMultiplier) {
  return function (dispatch) {
    dispatch(approve());
    return new Promise(async (resolve) => {
      try {
        if (amountToken === '0') {
          dispatch(approveError('The amount of tokens must be greater than 0'));
          resolve('Approve Error');
        } else {
          const provider = new ethers.providers.JsonRpcProvider(node);
          let walletEth = new ethers.Wallet(wallet.ethWallet.privateKey);
          walletEth = walletEth.connect(provider);
          const contractTokens = new ethers.Contract(addressTokens, abiTokens, walletEth);
          const gasPrice = await rollup.onchain.utils.getGasPrice(gasMultiplier, provider);
          const overrides = {
            gasLimit,
            gasPrice: gasPrice._hex,
          };
          const res = await contractTokens.approve(addressRollup, amountToken, overrides);
          dispatch(approveSuccess(res));
          resolve(res);
        }
      } catch (error) {
        resolve(error.message);
        dispatch(approveError(`Approve Error: ${error.message}`));
      }
    });
  };
}


function getTokens() {
  return {
    type: CONSTANTS.GET_TOKENS,
  };
}

function getTokensSuccess(res) {
  return {
    type: CONSTANTS.GET_TOKENS_SUCCESS,
    payload: res,
    error: '',
  };
}

function getTokensError(error) {
  return {
    type: CONSTANTS.GET_TOKENS_ERROR,
    error,
  };
}

export function handleGetTokens(node, addressTokens, wallet) {
  return function (dispatch) {
    dispatch(getTokens());
    return new Promise(async (resolve) => {
      try {
        const provider = new ethers.providers.JsonRpcProvider(node);
        let walletEth = new ethers.Wallet(wallet.ethWallet.privateKey);
        walletEth = walletEth.connect(provider);
        const tx = {
          to: addressTokens,
          value: ethers.utils.parseEther('0'),
        };
        const res = await walletEth.sendTransaction(tx);
        dispatch(getTokensSuccess(res));
        resolve(res);
      } catch (error) {
        dispatch(getTokensError(`Get Tokens Error: ${error.message}`));
        resolve(error);
      }
    });
  };
}

function getInitStateTx() {
  return {
    type: CONSTANTS.GET_INIT,
  };
}

export function handleInitStateTx() {
  return function (dispatch) {
    localStorage.clear();
    dispatch(getInitStateTx());
  };
}

function closeMessage() {
  return {
    type: CONSTANTS.CLOSE_MESSAGE,
  };
}

export function handleCloseMessage() {
  return function (dispatch) {
    dispatch(closeMessage());
  };
}
