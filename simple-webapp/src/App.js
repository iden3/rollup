import React, { Component } from 'react';
import { Route } from 'react-router-dom';
import './App.css';

import InitView from './views/init-view';
import ActionView from './views/action-view';

class App extends Component {
  render() {
    return (
      <>
        <Route
          exact
          path="/"
          render={() => <InitView />} />
        <Route
          exact
          path="/actions"
          render={() => <ActionView />} />
      </>
    );
  }
}

export default (App);
