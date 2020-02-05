import { combineReducers } from 'redux';
import general from './general';
import transactions from './tx';

export default combineReducers({
  general: general.reducer,
  transactions: transactions.reducer,
});
