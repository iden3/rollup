import * as CONSTANTS from './constants';

const initialState = {
  tx: {},
  isLoadingDeposit: false,
  successDeposit: false,
  isLoadingWithdraw: false,
  successWithdraw: false,
  isLoadingSend: false,
  successSend: false,
  isLoadingApprove: false,
  successApprove: false,
  isLoadingGetTokens: false,
  successGetTokens: false,
  exitRoots: [],
  isLoadingGetExitRoot: false,
  successGetExitRoot: false,
  error: '',
  /* errorDeposit: '',
  errorWithdraw: '',
  errorSend: '',
  errorGetTokens: '',
  errorApprove: '',
  errorGetExitRoot: '', */
};

function transactions(state = initialState, action) {
  switch (action.type) {
    case CONSTANTS.SEND_DEPOSIT:
      return {
        ...state,
        isLoadingDeposit: true,
        successDeposit: false,
        // errorDeposit: '',
        error: '',
      };
    case CONSTANTS.SEND_DEPOSIT_SUCCESS:
      return {
        ...state,
        isLoadingDeposit: false,
        tx: action.payload,
        successDeposit: true,
        // errorDeposit: '',
        error: '',
      };
    case CONSTANTS.SEND_DEPOSIT_ERROR:
      return {
        ...state,
        isLoadingDeposit: false,
        successDeposit: false,
        // errorDeposit: action.error,
        error: action.error,
      };
    case CONSTANTS.SEND_WITHDRAW:
      return {
        ...state,
        isLoadingWithdraw: true,
        successWithdraw: false,
        // errorWithdraw: '',
        error: '',
      };
    case CONSTANTS.SEND_WITHDRAW_SUCCESS:
      return {
        ...state,
        isLoadingWithdraw: false,
        tx: action.payload,
        successWithdraw: true,
        // errorWithdraw: '',
        error: '',
      };
    case CONSTANTS.SEND_WITHDRAW_ERROR:
      return {
        ...state,
        isLoadingWithdraw: false,
        successWithdraw: false,
        // errorWithdraw: action.error,
        error: action.error,
      };
    case CONSTANTS.SEND_SEND:
      return {
        ...state,
        isLoadingSend: true,
        successSend: false,
        // errorSend: '',
        error: '',
      };
    case CONSTANTS.SEND_SEND_SUCCESS:
      return {
        ...state,
        isLoadingSend: false,
        successSend: true,
        // errorSend: '',
        error: '',
      };
    case CONSTANTS.SEND_SEND_ERROR:
      return {
        ...state,
        isLoadingSend: false,
        successSend: false,
        // errorSend: action.error,
        error: action.error,
      };
    case CONSTANTS.APPROVE:
      return {
        ...state,
        isLoadingApprove: true,
        successApprove: false,
        // errorApprove: '',
        error: '',
      };
    case CONSTANTS.APPROVE_SUCCESS:
      return {
        ...state,
        isLoadingApprove: false,
        successApprove: true,
        tx: action.payload,
        // errorApprove: '',
        error: '',
      };
    case CONSTANTS.APPROVE_ERROR:
      return {
        ...state,
        isLoadingApprove: false,
        successApprove: false,
        // errorApprove: action.error,
        error: action.error,
      };
    case CONSTANTS.GET_TOKENS:
      return {
        ...state,
        isLoadingGetTokens: true,
        successGetTokens: false,
        // errorGetTokens: '',
        error: '',
      };
    case CONSTANTS.GET_TOKENS_SUCCESS:
      return {
        ...state,
        isLoadingGetTokens: false,
        tx: action.payload,
        successGetTokens: true,
        // errorGetTokens: '',
        error: '',
      };
    case CONSTANTS.GET_TOKENS_ERROR:
      return {
        ...state,
        isLoadingGetTokens: false,
        successGetTokens: false,
        // errorGetTokens: action.error,
        error: action.error,
      };
    case CONSTANTS.GET_EXIT_ROOT:
      return {
        ...state,
        isLoadingGetExitRoot: true,
        successGetExitRoot: false,
        // errorGetExitRoot: '',
        error: '',
      };
    case CONSTANTS.GET_EXIT_ROOT_SUCCESS:
      return {
        ...state,
        isLoadingGetExitRoot: false,
        exitRoots: action.payload,
        successGetExitRoot: true,
        // errorGetExitRoot: '',
        error: '',
      };
    case CONSTANTS.GET_EXIT_ROOT_ERROR:
      return {
        ...state,
        isLoadingGetExitRoot: false,
        successGetExitRoot: false,
        // errorGetExitRoot: action.error,
        error: action.error,
      };
    case CONSTANTS.GET_INIT:
      return {
        ...state,
        isLoadingDeposit: false,
        successDeposit: false,
        isLoadingWithdraw: false,
        successWithdraw: false,
        isLoadingSend: false,
        successSend: false,
        isLoadingApprove: false,
        successApprove: false,
        isLoadingGetTokens: false,
        successGetTokens: false,
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
