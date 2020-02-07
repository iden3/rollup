import * as CONSTANTS from './constants';
import * as rollup from '../../utils/bundle-cli';
import * as operator from '../../utils/bundle-op';

const ethers = require('ethers');
const gasLimit = 5000000;

function sendDeposit() {
  return {
    type: CONSTANTS.SEND_DEPOSIT,
  };
}

function sendDepositSuccess(res) {
  return {
    type: CONSTANTS.SEND_DEPOSIT_SUCCESS,
    payload: res,
    error: '',
  };
}

function sendDepositError(error) {
  return {
    type: CONSTANTS.SEND_DEPOSIT_ERROR,
    error,
  };
}

export function handleSendDeposit(nodeEth, addressSC, amount, tokenId, wallet, password, ethAddress, abiRollup, gasMultiplier) {
  return function (dispatch) {
    dispatch(sendDeposit());
    return new Promise(async (resolve) => {
      try {
        const res = await rollup.onchain.deposit.deposit(nodeEth, addressSC, amount, tokenId, wallet,
          password, ethAddress, abiRollup, gasLimit, gasMultiplier);
        resolve(res);
        dispatch(sendDepositSuccess(res));
      } catch (error) {
        resolve(error);
        dispatch(sendDepositError(error.message));
      }
    });
  };
}


function getNumExitRoot() {
  return {
    type: CONSTANTS.GET_EXIT_ROOT,
  };
}

function getNumExitRootSuccess(res) {
  return {
    type: CONSTANTS.GET_EXIT_ROOT_SUCCESS,
    payload: res,
    error: '',
  };
}

function getNumExitRootError(error) {
  return {
    type: CONSTANTS.GET_EXIT_ROOT_ERROR,
    error,
  };
}

export function handleGetExitRoot(urlOperator, id) {
  return function (dispatch) {
    dispatch(getNumExitRoot());
    return new Promise(async (resolve) => {
      try {
        const apiOperator = new operator.cliExternalOperator(urlOperator);
        const res = await apiOperator.getExits(id);
        const infoExits = [];
        res.data.map(async (key, index) => {
          const info = await apiOperator.getExitInfo(id, key);
          const amount = ethers.utils.formatEther(info.data.state.amount);
          infoExits.push({
            key: index, value: key, amount, text: `Num: ${key} Amount: ${amount}`,
          });
        });
        resolve(infoExits);
        dispatch(getNumExitRootSuccess(infoExits));
      } catch (err) {
        resolve([]);
        dispatch(getNumExitRootError(err.message));
      }
    });
  };
}

function sendWithdraw() {
  return {
    type: CONSTANTS.SEND_WITHDRAW,
  };
}

function sendWithdrawSuccess(res) {
  return {
    type: CONSTANTS.SEND_WITHDRAW_SUCCESS,
    payload: res,
    error: '',
  };
}

function sendWithdrawError(error) {
  return {
    type: CONSTANTS.SEND_WITHDRAW_ERROR,
    error,
  };
}

export function handleSendWithdraw(nodeEth, addressSC, wallet, password, abiRollup, op, idFrom, numExitRoot, gasMultiplier) {
  return function (dispatch) {
    dispatch(sendWithdraw());
    return new Promise(async (resolve) => {
      try {
        if(numExitRoot === -1) {
          dispatch(sendWithdrawError("No numExitRoot"));
          resolve("No numExitRoot");
        } else {
          const res = await rollup.onchain.withdraw.withdraw(nodeEth, addressSC, wallet, password, abiRollup,
            op, idFrom, numExitRoot, gasLimit, gasMultiplier);
          dispatch(sendWithdrawSuccess(res));
          resolve(res);
        }
      } catch (error) {
        dispatch(sendWithdrawError(error.message));
        resolve(error.message);
      }
    });
  };
}

function sendSend() {
  return {
    type: CONSTANTS.SEND_SEND,
  };
}

function sendSendSuccess() {
  return {
    type: CONSTANTS.SEND_SEND_SUCCESS,
    error: '',
  };
}

function sendSendError(error) {
  return {
    type: CONSTANTS.SEND_SEND_ERROR,
    error,
  };
}

export function handleSendSend(op, idTo, amount, wallet, password, tokenId, fee, idFrom) {
  return function (dispatch) {
    dispatch(sendSend());
    return new Promise(async (resolve) => {
      try {
        const item = localStorage.getItem('nonceObject');
        let nonceObject;
        if (item === null) {
          nonceObject = undefined;
        } else {
          nonceObject = JSON.parse(item);
        }
        const res = await rollup.offchain.send.send(op, idTo, amount, wallet, password, tokenId, fee, idFrom, undefined, nonceObject);
        localStorage.setItem('nonceObject', JSON.stringify(res.nonceObject));
        dispatch(sendSendSuccess());
        resolve(res);
      } catch (error) {
        dispatch(sendSendError(error.message));
        resolve(error.message);
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

export function handleApprove(addressTokens, abiTokens, encWallet, amountToken, addressRollup, password, node, gasMultiplier) {
  return function (dispatch) {
    dispatch(approve());
    return new Promise(async (resolve) => {
      try {
        const provider = new ethers.providers.JsonRpcProvider(node);
        const wallet = await rollup.wallet.Wallet.fromEncryptedJson(encWallet, password);
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
      } catch (error) {
        dispatch(approveError(error.message));
        // eslint-disable-next-line no-console
        console.log(error.message);
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

export function handleGetTokens(node, addressTokens, encWallet, password) {
  return function (dispatch) {
    dispatch(getTokens());
    return new Promise(async (resolve) => {
      try {
        const provider = new ethers.providers.JsonRpcProvider(node);
        const wallet = await rollup.wallet.Wallet.fromEncryptedJson(encWallet, password);
        let walletEth = new ethers.Wallet(wallet.ethWallet.privateKey);
        walletEth = walletEth.connect(provider);
        const tx = {
          to: addressTokens,
          value: ethers.utils.parseEther('0'),
        };
        const res = await walletEth.sendTransaction(tx);
        // eslint-disable-next-line no-console
        console.log(res);
        dispatch(getTokensSuccess(res));
        resolve(res);
      } catch (error) {
        dispatch(getTokensError(error.message));
        // eslint-disable-next-line no-console
        console.log(error.message);
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
