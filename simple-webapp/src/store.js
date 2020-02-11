import { createStore, applyMiddleware, compose } from 'redux';
import thunk from 'redux-thunk';
import rootReducer from './state/reducers';

const initialState = {};

const middleware = [thunk];

const store = createStore(rootReducer, initialState, compose(applyMiddleware(...middleware)));

export default store;
