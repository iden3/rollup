import * as CONSTANTS from './constants';

const initialState = {
  errorWallet: '',
  isLoadingWallet: false,
  wallet: {},
  metamaskWallet: {},
  desWallet: {},
  password: '',
  errorCreateWallet: '',
  isCreatingWallet: false,
  created: false,
  isLoadingFiles: false,
  errorFiles: '',
  config: {},
  abiRollup: [],
  abiTokens: [],
  isLoadingOp: false,
  apiOperator: {},
  errorOp: '',
  isLoadingInfoAccount: false,
  balance: '0.0',
  tokensList: [],
  tokensArray: [],
  tokensAArray: [],
  tokensRArray: [],
  tokens: '0',
  tokensR: '0',
  tokensE: '0',
  tokensA: '0',
  tokensTotal: '0',
  txs: [],
  txsExits: [],
  chainId: -1,
  errorInfoAccount: '',
  gasMultiplier: 2,
  currentBatch: 0,
};

function general(state = initialState, action) {
  switch (action.type) {
    case CONSTANTS.LOAD_WALLET:
      return {
        ...state,
        isLoadingWallet: true,
        errorWallet: '',
      };
    case CONSTANTS.LOAD_WALLET_SUCCESS:
      return {
        ...state,
        isLoadingWallet: false,
        wallet: action.payload.wallet,
        password: action.payload.password,
        desWallet: action.payload.desWallet,
        errorWallet: '',
      };
    case CONSTANTS.LOAD_WALLET_ERROR:
      return {
        ...state,
        isLoadingWallet: false,
        wallet: {},
        password: '',
        desWallet: {},
        errorWallet: action.error,
      };
    case CONSTANTS.CREATE_WALLET:
      return {
        ...state,
        isCreatingWallet: true,
        errorCreateWallet: '',
      };
    case CONSTANTS.CREATE_WALLET_SUCCESS:
      return {
        ...state,
        isCreatingWallet: false,
        created: true,
        errorCreateWallet: '',
      };
    case CONSTANTS.CREATE_WALLET_ERROR:
      return {
        ...state,
        isCreatingWallet: false,
        created: false,
        errorCreateWallet: action.error,
      };
    case CONSTANTS.LOAD_FILES:
      return {
        ...state,
        isLoadingFiles: true,
        errorFiles: '',
      };
    case CONSTANTS.LOAD_FILES_SUCCESS:
      return {
        ...state,
        config: action.payload.config,
        abiRollup: action.payload.abiRollup,
        abiTokens: action.payload.abiTokens,
        chainId: action.payload.chainId,
        isLoadingFiles: false,
        errorFiles: action.error,
      };
    case CONSTANTS.LOAD_FILES_ERROR:
      return {
        ...state,
        isLoadingFiles: false,
        chainId: -1,
        config: action.payload.config,
        errorFiles: action.error,
      };
    case CONSTANTS.LOAD_OPERATOR:
      return {
        ...state,
        isLoadingOp: true,
        errorOp: '',
      };
    case CONSTANTS.LOAD_OPERATOR_SUCCESS:
      return {
        ...state,
        isLoadingOp: false,
        apiOperator: action.payload.apiOperator,
        errorOp: '',
      };
    case CONSTANTS.LOAD_OPERATOR_ERROR:
      return {
        ...state,
        isLoadingOp: false,
        errorInfoOp: action.error,
      };
    case CONSTANTS.LOAD_METAMASK:
      return {
        ...state,
        isLoadingWallet: true,
        errorWallet: '',
      };
    case CONSTANTS.LOAD_METAMASK_SUCCESS:
      return {
        ...state,
        isLoadingWallet: false,
        metamaskWallet: action.payload.metamaskWallet,
        errorWallet: '',
      };
    case CONSTANTS.LOAD_METAMASK_ERROR:
      return {
        ...state,
        isLoadingWallet: false,
        metamaskWallet: {},
        errorWallet: action.error,
        };
    case CONSTANTS.INFO_ACCOUNT:
      return {
        ...state,
        isLoadingInfoAccount: true,
        errorInfoAccount: '',
      };
    case CONSTANTS.INFO_ACCOUNT_SUCCESS:
      return {
        ...state,
        isLoadingInfoAccount: false,
        balance: action.payload.balance,
        tokensList: action.payload.tokensList,
        tokens: action.payload.tokens,
        tokensR: action.payload.tokensR,
        tokensE: action.payload.tokensE,
        tokensA: action.payload.tokensA,
        tokensTotal: action.payload.tokensTotal,
        txs: action.payload.txs,
        txsExits: action.payload.txsExits,
        tokensArray: action.payload.tokensArray,
        tokensAArray: action.payload.tokensAArray,
        tokensRArray: action.payload.tokensRArray,
        errorInfoAccount: '',
      };
    case CONSTANTS.INFO_ACCOUNT_ERROR:
      return {
        ...state,
        isLoadingInfoAccount: false,
        errorInfoAccount: action.error,
        tokens: '0',
        tokensR: '0',
        tokensE: '0',
        tokensA: '0',
        tokensTotal: '0',
      };
    case CONSTANTS.CHECK_APPROVED_TOKENS_ERROR:
      return {
        ...state,
        errorApprovedTokens: true,
      };
    case CONSTANTS.CHECK_ETHER_ERROR:
      return {
        ...state,
        errorEther: true,
      };
    case CONSTANTS.INIT_APPROVED_TOKENS_ERROR:
      return {
        ...state,
        errorApprovedTokens: false,
      };
    case CONSTANTS.INIT_ETHER_ERROR:
      return {
        ...state,
        errorEther: false,
      };
    case CONSTANTS.SET_GAS_MULTIPLIER:
      return {
        ...state,
        gasMultiplier: action.payload,
      };
    case CONSTANTS.GET_CURRENT_BATCH:
      return {
        ...state,
        currentBatch: action.payload,
      };
    case CONSTANTS.GET_CURRENT_BATCH_ERROR:
      return {
        ...state,
        currentBatch: state.currentBatch,
      };
    default:
      return state;
  }
}

export default general;
