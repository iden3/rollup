import * as CONSTANTS from './constants';

const initialState = {
  txOnchain: [],
  txOffchain: [],
  txTotal: [],
  pendingOffchain: [],
  pendingOnchain: [],
};

function transactions(state = initialState, action) {
  switch (action.type) {
    case CONSTANTS.STATE_SEND:
      action.payload.state = 'Pending';
      return {
        ...state,
        pendingOffchain: [...state.pendingOffchain, action.payload],
      };
    case CONSTANTS.STATE_SEND_SUCCESS:
      return {
        ...state,
        txOffchain: [...state.txOffchain.filter((tx) => tx.id !== action.payload.id), action.payload],
        pendingOffchain: state.pendingOffchain.filter((tx) => tx.id !== action.payload.id),
        txTotal: [...state.txTotal.filter((tx) => tx.id !== action.payload.id), action.payload],
      };
    case CONSTANTS.STATE_SEND_ERROR:
      action.payload.state = 'Error';
      return {
        ...state,
        txTotal: [...state.txTotal, action.payload],
        pendingOffchain: state.pendingOffchain.filter((tx) => tx.id !== action.payload.id),
      };
    case CONSTANTS.STATE_DEPOSIT:
      return {
        ...state,
        pendingOnchain: [...state.pendingOnchain.filter((tx) => tx.id !== action.payload.id), action.payload],
      };
    case CONSTANTS.STATE_DEPOSIT_SUCCESS:
      return {
        ...state,
        txOnchain: [...state.txOnchain.filter((tx) => tx.id !== action.payload.id), action.payload],
        pendingOnchain: state.pendingOnchain.filter((tx) => tx.id !== action.payload.id),
        txTotal: [...state.txTotal.filter((tx) => tx.id !== action.payload.id), action.payload],
      };
    case CONSTANTS.STATE_DEPOSIT_ERROR:
      action.payload.state = 'Error';
      return {
        ...state,
        txTotal: [...state.txTotal.filter((tx) => tx.id !== action.payload.id), action.payload],
        pendingOnchain: state.pendingOnchain.filter((tx) => tx.id !== action.payload.id),
      };
    case CONSTANTS.STATE_WITHDRAW:
      action.payload.state = 'Pending (Ethereum)';
      return {
        ...state,
        pendingOnchain: [...state.pendingOnchain, action.payload],
      };
    case CONSTANTS.STATE_WITHDRAW_SUCCESS:
      action.payload.state = 'Success';
      return {
        ...state,
        txOnchain: [...state.txOnchain, action.payload],
        pendingOnchain: state.pendingOnchain.filter((tx) => tx.id !== action.payload.id),
        txTotal: [...state.txTotal, action.payload],
      };
    case CONSTANTS.STATE_WITHDRAW_ERROR:
      action.payload.state = 'Error';
      return {
        ...state,
        txTotal: [...state.txTotal, action.payload],
        pendingOnchain: state.pendingOnchain.filter((tx) => tx.id !== action.payload.id),
      };
    case CONSTANTS.STATE_FORCE_EXIT:
      return {
        ...state,
        pendingOnchain: [...state.pendingOnchain.filter((tx) => tx.id !== action.payload.id), action.payload],
      };
    case CONSTANTS.STATE_FORCE_EXIT_SUCCESS:
      return {
        ...state,
        txOnchain: [...state.txOnchain.filter((tx) => tx.id !== action.payload.id), action.payload],
        pendingOnchain: state.pendingOnchain.filter((tx) => tx.id !== action.payload.id),
        txTotal: [...state.txTotal.filter((tx) => tx.id !== action.payload.id), action.payload],
      };
    case CONSTANTS.STATE_FORCE_EXIT_ERROR:
      action.payload.state = 'Error';
      return {
        ...state,
        pendingOnchain: state.pendingOnchain.filter((tx) => tx.id !== action.payload.id),
        txTotal: [...state.txTotal, action.payload],
      };
    case CONSTANTS.RESET_TXS:
      return {
        ...state,
        txOnchain: [],
        txOffchain: [],
        txTotal: [],
        pendingOffchain: [],
        pendingOnchain: [],
      };
    default:
      return state;
  }
}

export default transactions;
