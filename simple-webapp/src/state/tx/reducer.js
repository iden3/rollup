import * as CONSTANTS from './constants';

const initialState = {
  tx: {},
  isLoadingDeposit: false,
  isLoadingWithdraw: false,
  isLoadingSend: false,
  isLoadingApprove: false,
  isLoadingGetTokens: false,
  exitRoots: [],
  isLoadingGetExitRoot: false,
  successGetExitRoot: false,
  successTx: false,
  successSend: false,
  error: '',
};

function transactions(state = initialState, action) {
  switch (action.type) {
    case CONSTANTS.SEND_DEPOSIT:
      return {
        ...state,
        isLoadingDeposit: true,
        successTx: false,
        error: '',
      };
    case CONSTANTS.SEND_DEPOSIT_SUCCESS:
      return {
        ...state,
        isLoadingDeposit: false,
        tx: action.payload,
        successTx: true,
        error: '',
      };
    case CONSTANTS.SEND_DEPOSIT_ERROR:
      return {
        ...state,
        isLoadingDeposit: false,
        successTx: false,
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
        tx: action.payload,
        successTx: true,
        error: '',
      };
    case CONSTANTS.SEND_WITHDRAW_ERROR:
      return {
        ...state,
        isLoadingWithdraw: false,
        successTx: false,
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
        error: '',
      };
    case CONSTANTS.SEND_SEND_ERROR:
      return {
        ...state,
        isLoadingSend: false,
        successSend: false,
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
        tx: action.payload,
        error: '',
      };
    case CONSTANTS.APPROVE_ERROR:
      return {
        ...state,
        isLoadingApprove: false,
        successTx: false,
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
        error: '',
      };
    case CONSTANTS.GET_TOKENS_ERROR:
      return {
        ...state,
        isLoadingGetTokens: false,
        successTx: false,
        error: action.error,
      };
    case CONSTANTS.GET_EXIT_ROOT:
      return {
        ...state,
        isLoadingGetExitRoot: true,
        successGetExitRoot: false,
        error: '',
      };
    case CONSTANTS.GET_EXIT_ROOT_SUCCESS:
      return {
        ...state,
        isLoadingGetExitRoot: false,
        exitRoots: action.payload,
        successGetExitRoot: true,
        error: '',
      };
    case CONSTANTS.GET_EXIT_ROOT_ERROR:
      return {
        ...state,
        isLoadingGetExitRoot: false,
        successGetExitRoot: false,
        error: action.error,
      };
    case CONSTANTS.GET_INIT:
      return {
        ...state,
        isLoadingDeposit: false,
        isLoadingWithdraw: false,
        isLoadingSend: false,
        successSend: false,
        isLoadingApprove: false,
        isLoadingGetTokens: false,
        successTx: false,
        exitRoots: [],
        isLoadingGetExitRoot: false,
        successGetExitRoot: false,
        error: '',
      };
    default:
      return state;
  }
}

export default transactions;
