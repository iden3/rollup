import * as CONSTANTS from './constants';

const initialState = {
  tx: {},
  isLoadingDeposit: false,
  isLoadingWithdraw: false,
  isLoadingForceExit: false,
  isLoadingSend: false,
  isLoadingApprove: false,
  isLoadingGetTokens: false,
  exitRoots: [],
  isLoadingGetExitRoot: false,
  successGetExitRoot: false,
  isLoadingGetIDs: false,
  ids: [],
  successGetIds: false,
  successTx: false,
  successForceExit: false,
  successDeposit: false,
  successSend: false,
  messageOpen: false,
  batch: 0,
  error: '',
};

function transactions(state = initialState, action) {
  switch (action.type) {
    case CONSTANTS.SEND_DEPOSIT:
      return {
        ...state,
        isLoadingDeposit: true,
        successDeposit: false,
        error: '',
      };
    case CONSTANTS.SEND_DEPOSIT_SUCCESS:
      return {
        ...state,
        isLoadingDeposit: false,
        tx: action.payload.res,
        batch: action.payload.currentBatch,
        successDeposit: true,
        successTx: false,
        successForceExit: false,
        messageOpen: true,
        error: '',
      };
    case CONSTANTS.SEND_DEPOSIT_ERROR:
      return {
        ...state,
        isLoadingDeposit: false,
        successDeposit: false,
        messageOpen: true,
        error: action.error,
      };
    case CONSTANTS.SEND_WITHDRAW:
      return {
        ...state,
        isLoadingWithdraw: true,
        successTx: false,
        error: '',
      };
    case CONSTANTS.SEND_WITHDRAW_SUCCESS:
      return {
        ...state,
        isLoadingWithdraw: false,
        tx: action.payload.res,
        batch: action.payload.currentBatch,
        successTx: true,
        messageOpen: true,
        error: '',
      };
    case CONSTANTS.SEND_WITHDRAW_ERROR:
      return {
        ...state,
        isLoadingWithdraw: false,
        successTx: false,
        messageOpen: true,
        error: action.error,
      };
    case CONSTANTS.SEND_FORCE_EXIT:
      return {
        ...state,
        isLoadingForceExit: true,
        successForceExit: false,
        error: '',
      };
    case CONSTANTS.SEND_FORCE_EXIT_SUCCESS:
      return {
        ...state,
        isLoadingForceExit: false,
        tx: action.payload.res,
        batch: action.payload.currentBatch,
        successForceExit: true,
        messageOpen: true,
        error: '',
      };
    case CONSTANTS.SEND_FORCE_EXIT_ERROR:
      return {
        ...state,
        isLoadingForceExit: false,
        successForceExit: false,
        messageOpen: true,
        error: action.error,
      };
    case CONSTANTS.SEND_SEND:
      return {
        ...state,
        isLoadingSend: true,
        successSend: false,
        error: '',
      };
    case CONSTANTS.SEND_SEND_SUCCESS:
      return {
        ...state,
        isLoadingSend: false,
        successSend: true,
        successTx: false,
        successDeposit: false,
        messageOpen: true,
        successForceExit: false,
        batch: action.payload.currentBatch,
        nonce: action.payload.nonce,
        error: '',
      };
    case CONSTANTS.SEND_SEND_ERROR:
      return {
        ...state,
        isLoadingSend: false,
        successSend: false,
        messageOpen: true,
        error: action.error,
      };
    case CONSTANTS.APPROVE:
      return {
        ...state,
        isLoadingApprove: true,
        successTx: false,
        error: '',
      };
    case CONSTANTS.APPROVE_SUCCESS:
      return {
        ...state,
        isLoadingApprove: false,
        successTx: true,
        messageOpen: true,
        tx: action.payload,
        error: '',
      };
    case CONSTANTS.APPROVE_ERROR:
      return {
        ...state,
        isLoadingApprove: false,
        successTx: false,
        messageOpen: true,
        error: action.error,
      };
    case CONSTANTS.GET_TOKENS:
      return {
        ...state,
        isLoadingGetTokens: true,
        successTx: false,
        error: '',
      };
    case CONSTANTS.GET_TOKENS_SUCCESS:
      return {
        ...state,
        isLoadingGetTokens: false,
        tx: action.payload,
        successTx: true,
        messageOpen: true,
        error: '',
      };
    case CONSTANTS.GET_TOKENS_ERROR:
      return {
        ...state,
        isLoadingGetTokens: false,
        successTx: false,
        messageOpen: true,
        error: action.error,
      };
    case CONSTANTS.GET_IDS:
      return {
        ...state,
        isLoadingGetIds: true,
        successGetIds: false,
        error: '',
      };
    case CONSTANTS.GET_IDS_SUCCESS:
      return {
        ...state,
        isLoadingGetIDs: false,
        ids: action.payload,
        successGetIds: true,
        error: '',
      };
    case CONSTANTS.GET_IDS_ERROR:
      return {
        ...state,
        isLoadingGetIds: false,
        successGetIds: false,
        error: action.error,
      };
    case CONSTANTS.CLOSE_MESSAGE:
      return {
        ...state,
        messageOpen: false,
      };
    case CONSTANTS.GET_INIT:
      return {
        ...state,
        isLoadingDeposit: false,
        isLoadingWithdraw: false,
        isLoadingForceExit: false,
        isLoadingSend: false,
        successSend: false,
        isLoadingApprove: false,
        isLoadingGetTokens: false,
        successTx: false,
        successDeposit: false,
        successForceExit: false,
        messageOpen: false,
        exitRoots: [],
        isLoadingGetExitRoot: false,
        successGetExitRoot: false,
        isLoadingGetIDs: false,
        ids: [],
        successGetIds: false,
        error: '',
      };
    default:
      return state;
  }
}

export default transactions;
