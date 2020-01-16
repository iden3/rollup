import React, { Component } from 'react';
import { Menu, Icon } from 'semantic-ui-react';
import { Link } from 'react-router-dom';

class MenuBack extends Component {
  render() {
    return (
      <Menu secondary>
        <Menu.Menu position="right">
          <Link to="/">
            <Menu.Item
              name="initView">
              <Icon name="upload" />
              Import another wallet
            </Menu.Item>
          </Link>
          <Link to="/">
            <Menu.Item
              name="initView">
              <Icon name="reply" />
              Back
            </Menu.Item>
          </Link>
        </Menu.Menu>
      </Menu>
    );
  }
}

export default MenuBack;
