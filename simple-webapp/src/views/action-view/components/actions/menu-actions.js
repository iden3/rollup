import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import {
  Icon, Container, Menu, Dropdown, Segment,
} from 'semantic-ui-react';

class MenuActions extends Component {
  static propTypes = {
    handleItemClick: PropTypes.func.isRequired,
    noImported: PropTypes.bool.isRequired,
    tokensA: PropTypes.string.isRequired,
    tokensR: PropTypes.string.isRequired,
    tokensE: PropTypes.string.isRequired,
    balance: PropTypes.string.isRequired,
    isLoadingInfoAccount: PropTypes.bool.isRequired,
  }

  constructor(props) {
    super(props);
    this.state = {
      onChainDisabled: false,
      offChainDisabled: false,
      getResourcesDisabled: false,
      depositDisabled: false,
      withdrawDisabled: false,
      forcexitDisabled: false,
      sendDisabled: false,
      exitDisabled: false,
      getTokensDisabled: false,
      approveTokensDisabled: false,
    };
  }

  componentDidUpdate = (prevProps) => {
    const {
      tokensR, tokensA, tokensE, balance, isLoadingInfoAccount,
    } = this.props;
    if (prevProps.isLoadingInfoAccount !== isLoadingInfoAccount) {
      if (isLoadingInfoAccount) {
        this.setState({
          onChainDisabled: true,
          offChainDisabled: true,
          getResourcesDisabled: true,
        });
      } else {
        this.setState({
          onChainDisabled: false,
          offChainDisabled: false,
          getResourcesDisabled: false,
          getTokensDisabled: false,
          approveTokensDisabled: false,
        });
        if (Number(balance) === 0) {
          this.setState({
            depositDisabled: true,
            withdrawDisabled: true,
            forcexitDisabled: true,
            getTokensDisabled: true,
            approveTokensDisabled: true,
          });
        }
        if (Number(tokensA) === 0) {
          this.setState({
            depositDisabled: true,
          });
        }
        if (Number(tokensR) === 0) {
          this.setState({
            sendDisabled: true,
            exitDisabled: true,
            forcexitDisabled: true,
          });
        }
        if (Number(tokensE) === 0) {
          this.setState({
            withdrawDisabled: true,
          });
        }
      }
    }
    if (prevProps.tokensA !== tokensA || prevProps.balance !== balance) {
      if (Number(tokensA) === 0 || Number(balance) === 0) {
        this.setState({ depositDisabled: true });
      } else {
        this.setState({ depositDisabled: false });
      }
    }
    if (prevProps.tokensR !== tokensR) {
      if (Number(tokensR) === 0 || Number(balance) === 0) {
        this.setState({
          sendDisabled: true,
          exitDisabled: true,
          forcexitDisabled: true,
        });
      } else {
        this.setState({
          sendDisabled: false,
          exitDisabled: false,
          forcexitDisabled: false,
        });
      }
    }
    if (prevProps.tokensE !== tokensE || prevProps.balance !== balance) {
      if (Number(tokensE) === 0 || Number(balance) === 0) {
        this.setState({ withdrawDisabled: true });
      } else {
        this.setState({ withdrawDisabled: false });
      }
    }
    if (prevProps.balance !== balance) {
      if (Number(balance) === 0) {
        this.setState({ getTokensDisabled: true, approveTokensDisabled: true });
      } else {
        this.setState({ getTokensDisabled: false, approveTokensDisabled: false });
      }
    }
  }

  render() {
    const { noImported } = this.props;
    const {
      depositDisabled, forcexitDisabled, withdrawDisabled, exitDisabled, sendDisabled, getResourcesDisabled,
      onChainDisabled, offChainDisabled, getTokensDisabled, approveTokensDisabled,
    } = this.state;
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
            className="icon item"
            disabled={noImported || onChainDisabled}>
            <Dropdown.Menu>
              <Dropdown.Item
                name="deposit"
                onClick={this.props.handleItemClick}
                disabled={noImported || depositDisabled}>
                <Segment textAlign="center">
                  <Icon name="sign-in" />
                  DEPOSIT
                </Segment>
              </Dropdown.Item>
              <Dropdown.Item
                name="withdraw"
                onClick={this.props.handleItemClick}
                disabled={noImported || withdrawDisabled}>
                <Segment textAlign="center">
                  <Icon name="sign-out" />
                  WITHDRAW
                </Segment>
              </Dropdown.Item>
              <Dropdown.Item
                name="forcexit"
                onClick={this.props.handleItemClick}
                disabled={noImported || forcexitDisabled}>
                <Segment textAlign="center">
                  <Icon name="reply" />
                  FORCE EXIT
                </Segment>
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>
          <Dropdown
            trigger={(
              <span>
                <Icon name="life ring" />
                OFF-CHAIN
              </span>
            )}
            pointing
            className="icon item"
            disabled={noImported || offChainDisabled}>
            <Dropdown.Menu>
              <Dropdown.Item name="send" onClick={this.props.handleItemClick} disabled={noImported || sendDisabled}>
                <Segment textAlign="center">
                  <Icon name="exchange" />
                  SEND
                </Segment>
              </Dropdown.Item>
              <Dropdown.Item name="send0" onClick={this.props.handleItemClick} disabled={noImported || exitDisabled}>
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
                <Icon name="cogs" />
                GET RESOURCES
              </span>
            )}
            pointing
            className="icon item"
            disabled={noImported || getResourcesDisabled}>
            <Dropdown.Menu>
              <Dropdown.Item>
                <a href="https://goerli-faucet.slock.it/" target="_blank" rel="noopener noreferrer">
                  <Segment textAlign="center">
                    <Icon name="arrow circle right" color="blue" />
                    GET ETHER
                  </Segment>
                </a>
              </Dropdown.Item>
              <Dropdown.Item
                name="getTokens"
                onClick={this.props.handleItemClick}
                disabled={noImported || getTokensDisabled}>
                <Segment textAlign="center">
                  <Icon name="cart arrow down" />
                  GET TOKENS
                </Segment>
              </Dropdown.Item>
              <Dropdown.Item
                name="approve"
                onClick={this.props.handleItemClick}
                disabled={noImported || approveTokensDisabled}>
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

const mapStateToProps = (state) => ({
  balance: state.general.balance,
  tokensR: state.general.tokensR,
  tokensA: state.general.tokensA,
  tokensE: state.general.tokensE,
  isLoadingInfoAccount: state.general.isLoadingInfoAccount,
});


export default connect(mapStateToProps, {})(MenuActions);
