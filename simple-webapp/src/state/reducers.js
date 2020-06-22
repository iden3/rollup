import { combineReducers } from 'redux';
import general from './general';
import transactions from './tx';
import txState from './tx-state';

export default combineReducers({
  general: general.reducer,
  transactions: transactions.reducer,
  txState: txState.reducer,
});
