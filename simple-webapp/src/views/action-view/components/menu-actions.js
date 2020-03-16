import React, { Component } from 'react';
import PropTypes from 'prop-types';
import {
  Icon, Container, Menu, Dropdown, Segment,
} from 'semantic-ui-react';

class MenuActions extends Component {
  static propTypes = {
    handleItemClick: PropTypes.func.isRequired,
    noImported: PropTypes.bool.isRequired,
  }

  render() {
    return (
      <Container>
        <Segment color="blue" inverted secondary>
          <b>ACTIONS</b>
        </Segment>
        <Menu widths="3">
          <Dropdown
            trigger={(
              <span>
                <Icon name="ethereum" />
                ON-CHAIN
              </span>
            )}
            pointing
            className="icon item">
            <Dropdown.Menu>
              <Dropdown.Item name="deposit" onClick={this.props.handleItemClick} disabled={this.props.noImported}>
                <Segment textAlign="center">
                  <Icon name="sign-in" />
                  DEPOSIT
                </Segment>
              </Dropdown.Item>
              <Dropdown.Item name="withdraw" onClick={this.props.handleItemClick} disabled={this.props.noImported}>
                <Segment textAlign="center">
                  <Icon name="sign-out" />
                  WITHDRAW
                </Segment>
              </Dropdown.Item>
              <Dropdown.Item name="forcexit" onClick={this.props.handleItemClick} disabled={this.props.noImported}>
                <Segment textAlign="center">
                  <Icon name="reply" />
                  FORCE EXIT
                </Segment>
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>
          <Dropdown text="OFF-CHAIN" pointing className="link item">
            <Dropdown.Menu>
              <Dropdown.Item name="send" onClick={this.props.handleItemClick} disabled={this.props.noImported}>
                <Segment textAlign="center">
                  <Icon name="exchange" />
                  SEND
                </Segment>
              </Dropdown.Item>
              <Dropdown.Item name="send0" onClick={this.props.handleItemClick} disabled={this.props.noImported}>
                <Segment textAlign="center">
                  <Icon name="reply" />
                  EXIT
                </Segment>
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>
          <Dropdown
            trigger={(
              <span>
                GET RESOURCES
              </span>
            )}
            pointing
            className="link item">
            <Dropdown.Menu>
              <Dropdown.Item>
                <a href="https://goerli-faucet.slock.it/" target="_blank" rel="noopener noreferrer">
                  <Segment textAlign="center">
                    <Icon name="arrow circle right" color="blue" />
                    GET ETHER
                  </Segment>
                </a>
              </Dropdown.Item>
              <Dropdown.Item name="getTokens" onClick={this.props.handleItemClick} disabled={this.props.noImported}>
                <Segment textAlign="center">
                  <Icon name="cart arrow down" />
                  GET TOKENS
                </Segment>
              </Dropdown.Item>
              <Dropdown.Item name="approve" onClick={this.props.handleItemClick} disabled={this.props.noImported}>
                <Segment textAlign="center">
                  <Icon name="checkmark" />
                  APPROVE TOKENS
                </Segment>
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>
        </Menu>
      </Container>
    );
  }
}
export default MenuActions;
