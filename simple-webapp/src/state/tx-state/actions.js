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

export function handleStateSend(res, urlOperator, amount, fee, tokenId, babyJubReceiver, pendingOff, babyjub) {
  const infoTx = {
    currentBatch: res.currentBatch,
    nonce: res.nonce,
    id: res.nonce.toString() + tokenId,
    amount: web3.utils.fromWei(amount, 'ether'),
    receiver: babyJubReceiver,
    maxNumBatch: Number(res.currentBatch) + 2,
    finalBatch: 'Pending',
    fee,
    tokenId,
    from: babyjub,
    timestamp: Date.now(),
  };
  if (babyJubReceiver === 'exit') {
    infoTx.type = 'Exit';
  } else {
    infoTx.type = 'Send';
  }
  return async function (dispatch) {
    if (pendingOff.filter((tx) => tx.id === infoTx.id).length === 0) {
      dispatch(stateSend(infoTx));
      try {
        const nonceTx = res.nonce;
        let currentBatch = Number(res.currentBatch);
        const { maxNumBatch } = infoTx;
        const apiOperator = new operator.cliExternalOperator(urlOperator);
        let actualNonce;
        try {
          const resFrom = await apiOperator.getStateAccountByAddress(tokenId, babyjub);
          actualNonce = resFrom.data.nonce;
        } catch (err) {
          actualNonce = 0;
        }
        while (actualNonce <= nonceTx && currentBatch <= maxNumBatch) {
          // eslint-disable-next-line no-await-in-loop
          const newState = await getNewState(apiOperator, tokenId, babyjub);
          actualNonce = newState.actualNonce;
          currentBatch = newState.currentBatch;
        }
        infoTx.finalBatch = currentBatch;
        infoTx.currentBatch = currentBatch;
        if (actualNonce > nonceTx) {
          infoTx.state = 'Success (pending confirmation batches)';
          dispatch(stateSendSuccess(infoTx));
          while (currentBatch < maxNumBatch + 5) {
            // eslint-disable-next-line no-await-in-loop
            currentBatch = await getCurrentBatch(apiOperator);
          }
          infoTx.currentBatch = currentBatch;
          infoTx.state = 'Success';
          dispatch(stateSendSuccess(infoTx));
        } else {
          dispatch(stateSendError(infoTx));
        }
      } catch (error) {
        dispatch(stateSendError(infoTx));
      }
    } else {
      infoTx.id = `${res.nonce.toString() + tokenId}error`;
      infoTx.error = 'Nonce Error';
      dispatch(stateSendError(infoTx));
    }
  };
}

function getNewState(apiOperator, tokenId, address) {
  return new Promise(((resolve) => {
    setTimeout(async () => {
      let actualNonce;
      let currentBatch;
      try {
        const resFrom = await apiOperator.getStateAccountByAddress(tokenId, address);
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

export function handleStateDeposit(tx, tokenId, urlOperator, amount) {
  const infoTx = {
    currentBatch: tx.currentBatch,
    nonce: tx.res.nonce,
    id: tx.res.hash,
    amount: web3.utils.fromWei(amount, 'ether'),
    type: 'Deposit',
    from: tx.res.from,
    to: tx.res.to,
    maxNumBatch: 'Pending',
    finalBatch: 'Pending',
    tokenId,
    timestamp: Date.now(),
  };
  return async function (dispatch) {
    infoTx.state = 'Pending (Ethereum)';
    dispatch(stateDeposit(infoTx));
    try {
      await tx.res.wait();
      const apiOperator = new operator.cliExternalOperator(urlOperator);
      const resState = await apiOperator.getState();
      let currentBatch = resState.data.rollupSynch.lastBatchSynched;
      const maxNumBatch = currentBatch + 2;
      infoTx.currentBatch = currentBatch;
      infoTx.state = 'Pending (Operator)';
      infoTx.maxNumBatch = maxNumBatch;
      dispatch(stateDeposit(infoTx));
      while (currentBatch < maxNumBatch) {
        // eslint-disable-next-line no-await-in-loop
        currentBatch = await getCurrentBatch(apiOperator);
      }
      infoTx.currentBatch = currentBatch;
      infoTx.finalBatch = currentBatch;
      infoTx.state = 'Success (pending confirmation batches)';
      // infoTx.confirmationBatch = maxNumBatch + 5;
      dispatch(stateDepositSuccess(infoTx));
      while (currentBatch < maxNumBatch + 5) {
        // eslint-disable-next-line no-await-in-loop
        currentBatch = await getCurrentBatch(apiOperator);
      }
      // infoTx.confirmedBatch = currentBatch;
      infoTx.currentBatch = currentBatch;
      infoTx.state = 'Success';
      dispatch(stateDepositSuccess(infoTx));
    } catch (error) {
      dispatch(stateDepositError(infoTx));
    }
  };
}

function getCurrentBatch(apiOperator) {
  return new Promise(((resolve) => {
    setTimeout(async () => {
      let currentBatch;
      try {
        const resOperator = await apiOperator.getState();
        currentBatch = resOperator.data.rollupSynch.lastBatchSynched;
      } catch (err) {
        currentBatch = 0;
      }
      resolve(currentBatch);
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

export function handleStateWithdraw(tx, tokenId) {
  const infoTx = {
    currentBatch: tx.currentBatch,
    nonce: tx.res.nonce,
    id: tx.res.hash,
    amount: web3.utils.fromWei(tx.amount, 'ether'),
    type: 'Withdraw',
    from: tx.res.from,
    to: tx.res.to,
    tokenId,
    timestamp: Date.now(),
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

export function handleStateForceExit(tx, urlOperator, tokenId, amount) {
  const infoTx = {
    currentBatch: tx.currentBatch,
    nonce: tx.res.nonce,
    id: tx.res.hash,
    amount: web3.utils.fromWei(amount, 'ether'),
    type: 'ForceExit',
    from: tx.res.from,
    to: tx.res.to,
    tokenId,
    maxNumBatch: 'Pending',
    finalBatch: 'Pending',
    timestamp: Date.now(),
  };
  return async function (dispatch) {
    infoTx.state = 'Pending (Ethereum)';
    dispatch(stateForceExit(infoTx));
    try {
      await tx.res.wait();
      const apiOperator = new operator.cliExternalOperator(urlOperator);
      const resState = await apiOperator.getState();
      let currentBatch = resState.data.rollupSynch.lastBatchSynched;
      const maxNumBatch = currentBatch + 2;
      infoTx.state = 'Pending (Operator)';
      infoTx.currentBatch = currentBatch;
      infoTx.maxNumBatch = maxNumBatch;
      dispatch(stateForceExit(infoTx));
      while (currentBatch < maxNumBatch) {
        // eslint-disable-next-line no-await-in-loop
        currentBatch = await getCurrentBatch(apiOperator);
      }
      infoTx.currentBatch = currentBatch;
      infoTx.finalBatch = currentBatch;
      infoTx.state = 'Success (pending confirmation batches)';
      infoTx.confirmationBatch = maxNumBatch + 5;
      dispatch(stateForceExitSuccess(infoTx));
      while (currentBatch < maxNumBatch + 5) {
        // eslint-disable-next-line no-await-in-loop
        currentBatch = await getCurrentBatch(apiOperator);
      }
      infoTx.currentBatch = currentBatch;
      infoTx.confirmedBatch = currentBatch;
      infoTx.state = 'Success';
      dispatch(stateForceExitSuccess(infoTx));
    } catch (error) {
      dispatch(stateForceExitError(infoTx));
    }
  };
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
