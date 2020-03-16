import * as CONSTANTS from './constants';

const web3 = require('web3');
const operator = require('bundle-op');

function stateSend(tx) {
  return {
    type: CONSTANTS.STATE_SEND,
    payload: tx,
  };
}

function stateSendSuccess(tx) {
  return {
    type: CONSTANTS.STATE_SEND_SUCCESS,
    payload: tx,
  };
}

function stateSendError(tx) {
  return {
    type: CONSTANTS.STATE_SEND_ERROR,
    payload: tx,
  };
}

export function handleStateSend(res, idFrom, urlOperator, amount, babyJubReceiver, pendingOffchain, idTo) {
  const infoTx = {
    currentBatch: res.currentBatch,
    nonce: res.nonce,
    id: res.nonce.toString() + idFrom,
    amount: web3.utils.fromWei(amount, 'ether'),
    receiver: babyJubReceiver,
    maxNumBatch: Number(res.currentBatch) + 3,
  };
  if (idTo === 0) {
    infoTx.type = 'Exit';
  } else {
    infoTx.type = 'Send';
  }
  return async function (dispatch) {
    if (pendingOffchain.filter((tx) => tx.id === infoTx.id).length === 0) {
      dispatch(stateSend(infoTx));
      try {
        const nonceTx = res.nonce;
        let currentBatch = Number(res.currentBatch);
        const maxNumBatch = currentBatch + 3;
        const apiOperator = new operator.cliExternalOperator(urlOperator);
        let actualNonce;
        try {
          const resFrom = await apiOperator.getAccountByIdx(idFrom);
          actualNonce = resFrom.data.nonce;
        } catch (err) {
          actualNonce = 0;
        }
        while (actualNonce <= nonceTx && currentBatch < maxNumBatch) {
          // eslint-disable-next-line no-await-in-loop
          const newState = await getNewState(apiOperator, idFrom);
          actualNonce = newState.actualNonce;
          currentBatch = newState.currentBatch;
        }

        if (actualNonce > nonceTx) {
          dispatch(stateSendSuccess(infoTx));
        } else {
          dispatch(stateSendError(infoTx));
        }
      } catch (error) {
        dispatch(stateSendError(infoTx));
      }
    } else {
      infoTx.id = `${res.nonce.toString() + idFrom}error`;
      dispatch(stateSendError(infoTx));
    }
  };
}

function getNewState(apiOperator, idFrom) {
  return new Promise(((resolve) => {
    setTimeout(async () => {
      let actualNonce;
      let currentBatch;
      try {
        const resFrom = await apiOperator.getAccountByIdx(idFrom);
        actualNonce = resFrom.data.nonce;
      } catch (err) {
        actualNonce = 0;
      }
      try {
        const resOperator = await apiOperator.getState();
        currentBatch = resOperator.data.rollupSynch.lastBatchSynched;
      } catch (err) {
        currentBatch = 0;
      }
      resolve({ actualNonce, currentBatch });
    }, 30000);
  }));
}

function stateDeposit(tx) {
  return {
    type: CONSTANTS.STATE_DEPOSIT,
    payload: tx,
  };
}

function stateDepositSuccess(tx) {
  return {
    type: CONSTANTS.STATE_DEPOSIT_SUCCESS,
    payload: tx,
  };
}

function stateDepositError(tx) {
  return {
    type: CONSTANTS.STATE_DEPOSIT_ERROR,
    payload: tx,
  };
}

export function handleStateDeposit(tx, urlOperator, filter, amount) {
  const infoTx = {
    currentBatch: tx.currentBatch,
    nonce: tx.res.nonce,
    id: tx.res.hash,
    amount: web3.utils.fromWei(amount, 'ether'),
    type: 'Deposit',
    from: tx.res.from,
    to: tx.res.to,
    maxNumBatch: 'Pending',
  };
  return async function (dispatch) {
    infoTx.state = 'Pending (Ethereum)';
    dispatch(stateDeposit(infoTx));
    try {
      await tx.res.wait();
      const apiOperator = new operator.cliExternalOperator(urlOperator);
      const resState = await apiOperator.getState();
      let currentBatch = resState.data.rollupSynch.lastBatchSynched;
      const maxNumBatch = currentBatch + 3;
      infoTx.state = 'Pending (Operator)';
      infoTx.currentBatch = currentBatch;
      infoTx.maxNumBatch = maxNumBatch;
      dispatch(stateDeposit(infoTx));
      let initLenghtAccounts;
      try {
        const resFrom = await apiOperator.getAccounts(filter);
        initLenghtAccounts = resFrom.data.length;
      } catch (err) {
        initLenghtAccounts = 0;
      }
      let lengthAccounts = initLenghtAccounts;
      while (initLenghtAccounts === lengthAccounts && currentBatch < maxNumBatch) {
        // eslint-disable-next-line no-await-in-loop
        const newState = await getNewAccounts(apiOperator, filter);
        lengthAccounts = newState.lengthAccounts;
        currentBatch = newState.currentBatch;
      }
      if (lengthAccounts > initLenghtAccounts) {
        dispatch(stateDepositSuccess(infoTx));
      } else {
        dispatch(stateDepositError(infoTx));
      }
    } catch (error) {
      dispatch(stateDepositError(infoTx));
    }
  };
}

function getNewAccounts(apiOperator, filter) {
  return new Promise(((resolve) => {
    setTimeout(async () => {
      let lengthAccounts;
      let currentBatch;
      try {
        const resFrom = await apiOperator.getAccounts(filter);
        lengthAccounts = resFrom.data.length;
      } catch (err) {
        lengthAccounts = 0;
      }
      try {
        const resOperator = await apiOperator.getState();
        currentBatch = resOperator.data.rollupSynch.lastBatchSynched;
      } catch (err) {
        currentBatch = 0;
      }
      resolve({ lengthAccounts, currentBatch });
    }, 30000);
  }));
}

function stateWithdraw(tx) {
  return {
    type: CONSTANTS.STATE_WITHDRAW,
    payload: tx,
  };
}

function stateWithdrawSuccess(tx) {
  return {
    type: CONSTANTS.STATE_WITHDRAW_SUCCESS,
    payload: tx,
  };
}

function stateWithdrawError(tx) {
  return {
    type: CONSTANTS.STATE_WITHDRAW_ERROR,
    payload: tx,
  };
}

export function handleStateWithdraw(tx, idFrom, amount) {
  const infoTx = {
    currentBatch: tx.currentBatch,
    nonce: tx.res.nonce,
    id: tx.res.hash,
    amount,
    type: 'Withdraw',
    from: tx.res.from,
    to: tx.res.to,
    idFrom,
    maxNumBatch: Number(tx.currentBatch) + 3,
  };
  return async function (dispatch) {
    dispatch(stateWithdraw(infoTx));
    try {
      await tx.res.wait();
      dispatch(stateWithdrawSuccess(infoTx));
    } catch (error) {
      dispatch(stateWithdrawError(infoTx));
    }
  };
}

function stateForceExit(tx) {
  return {
    type: CONSTANTS.STATE_FORCE_EXIT,
    payload: tx,
  };
}

function stateForceExitSuccess(tx) {
  return {
    type: CONSTANTS.STATE_FORCE_EXIT_SUCCESS,
    payload: tx,
  };
}

function stateForceExitError(tx) {
  return {
    type: CONSTANTS.STATE_FORCE_EXIT_ERROR,
    payload: tx,
  };
}

export function handleStateForceExit(tx, urlOperator, idFrom, amount) {
  const infoTx = {
    currentBatch: tx.currentBatch,
    nonce: tx.res.nonce,
    id: tx.res.hash,
    amount: web3.utils.fromWei(amount, 'ether'),
    type: 'ForceExit',
    from: tx.res.from,
    to: tx.res.to,
    idFrom,
    maxNumBatch: 'Pending',
  };
  return async function (dispatch) {
    infoTx.state = 'Pending (Ethereum)';
    dispatch(stateForceExit(infoTx));
    try {
      await tx.res.wait();
      const apiOperator = new operator.cliExternalOperator(urlOperator);
      const resState = await apiOperator.getState();
      let currentBatch = resState.data.rollupSynch.lastBatchSynched;
      const maxNumBatch = currentBatch + 3;
      infoTx.state = 'Pending (Operator)';
      infoTx.currentBatch = currentBatch;
      infoTx.maxNumBatch = maxNumBatch;
      dispatch(stateForceExit(infoTx));
      let initLenghtExits;
      try {
        const resFrom = await apiOperator.getExits(idFrom);
        initLenghtExits = resFrom.data.length;
      } catch (err) {
        initLenghtExits = 0;
      }
      let lengthExits = initLenghtExits;
      while (initLenghtExits === lengthExits && currentBatch < maxNumBatch) {
        // eslint-disable-next-line no-await-in-loop
        const newState = await getNewExits(apiOperator, idFrom);
        lengthExits = newState.lengthExits;
        currentBatch = newState.currentBatch;
      }
      if (lengthExits > initLenghtExits) {
        dispatch(stateForceExitSuccess(infoTx));
      } else {
        dispatch(stateForceExitError(infoTx));
      }
    } catch (error) {
      dispatch(stateForceExitError(infoTx));
    }
  };
}


function getNewExits(apiOperator, idFrom) {
  return new Promise(((resolve) => {
    setTimeout(async () => {
      let lengthExits;
      let currentBatch;
      try {
        const resFrom = await apiOperator.getExits(idFrom);
        lengthExits = resFrom.data.length;
      } catch (err) {
        lengthExits = 0;
      }
      try {
        const resOperator = await apiOperator.getState();
        currentBatch = resOperator.data.rollupSynch.lastBatchSynched;
      } catch (err) {
        currentBatch = 0;
      }
      resolve({ lengthExits, currentBatch });
    }, 30000);
  }));
}

function resetTxs() {
  return {
    type: CONSTANTS.RESET_TXS,
  };
}

export function handleResetTxs() {
  return function (dispatch) {
    dispatch(resetTxs());
  };
}
