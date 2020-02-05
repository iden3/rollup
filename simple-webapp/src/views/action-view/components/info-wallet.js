import React, { Component } from 'react';
import PropTypes from 'prop-types';
import {
  Table, Button, Container, Icon, Popup,
} from 'semantic-ui-react';
import ModalInfoId from './modal-info-id';

const web3 = require('web3');

class InfoWallet extends Component {
  static propTypes = {
    wallet: PropTypes.object.isRequired,
    isLoadingInfoAccount: PropTypes.bool.isRequired,
    tokens: PropTypes.string,
    tokensR: PropTypes.string,
    tokensA: PropTypes.string,
    balance: PropTypes.string,
    tokensAddress: PropTypes.string,
    txs: PropTypes.array,
    handleClickApprove: PropTypes.func.isRequired,
    handleClickGetTokens: PropTypes.func.isRequired,
    getInfoAccount: PropTypes.func.isRequired,
  }

  static defaultProps = {
    tokens: '0',
    tokensR: '0',
    balance: '0',
    txs: [],
  }

  constructor(props) {
    super(props);
    this.state = {
      address: '0x0000000000000000000000000000000000000000',
      loading: false,
      firstLoading: true,
    };
    this.addressTokensRef = React.createRef();
    this.amountTokensRef = React.createRef();
  }

  async componentDidMount() {
    try {
      if (Object.keys(this.props.wallet).length !== 0
      && this.state.address !== `0x${this.props.wallet.ethWallet.address}`) {
        this.setState({ address: `0x${this.props.wallet.ethWallet.address}` });
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.log(e);
    }
  }

  componentDidUpdate() {
    if (this.props.isLoadingInfoAccount === true && this.state.firstLoading === true && this.state.loading === false) {
      this.setState({ loading: true });
    } else if (this.props.isLoadingInfoAccount === false && this.state.firstLoading === true
      && this.state.loading === true) {
      this.setState({ firstLoading: false, loading: false });
    }
  }

  handleClick = () => {
    this.props.handleClickApprove(this.addressTokensRef.current.value,
      web3.utils.toWei(this.amountTokensRef.current.value, 'ether'));
  }

  handleClickTokens = () => {
    this.props.handleClickGetTokens();
  }

  importedWallet = () => {
    if (this.state.address === '0x0000000000000000000000000000000000000000') {
      return (
        <div>
          <Icon name="close" color="red" />
              You must import a wallet!
        </div>
      );
    }
    return this.state.address;
  }

  reload = () => {
    this.setState({ firstLoading: true });
    this.props.getInfoAccount();
  }

  isLoadingTokens = () => {
    if (this.state.loading === false) {
      return web3.utils.fromWei(this.props.tokens, 'ether');
      // return this.props.tokens;
    }
    return <Icon name="circle notched" loading />;
  }

  isLoadingTokensR = () => {
    if (this.state.loading === false) {
      // return this.props.tokensR;
      return web3.utils.fromWei(this.props.tokensR, 'ether');
    }
    return <Icon name="circle notched" loading />;
  }

  isLoadingTokensA = () => {
    if (this.state.loading === false) {
      return web3.utils.fromWei(this.props.tokensA, 'ether');
    }
    return <Icon name="circle notched" loading />;
  }

  isLoadingEthers = () => {
    if (this.state.loading === false) {
      return this.props.balance;
    }
    return <Icon name="circle notched" loading />;
  }

  render() {
    return (
      <Container>
        <Table padded>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell colSpan="3">Rollup Wallet</Table.HeaderCell>
              <Table.HeaderCell textAlign="right">
                <Button onClick={this.reload}>
                  <Icon name="sync" />
                  Reload
                </Button>
              </Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            <Table.Row>
              <Table.Cell colSpan="1" width="3">
                Address:
              </Table.Cell>
              <Table.Cell colSpan="3">
                {this.importedWallet()}
              </Table.Cell>
            </Table.Row>
            <Table.Row>
              <Table.Cell>
                Balance
              </Table.Cell>
              <Table.Cell>
                Account
              </Table.Cell>
              <Table.Cell>
                Rollup Network
              </Table.Cell>
              <Table.Cell>
              </Table.Cell>
            </Table.Row>
            <Table.Row>
              <Table.Cell>
                TOKENS:
              </Table.Cell>
              <Table.Cell>
                {this.isLoadingTokens()}
              </Table.Cell>
              <Table.Cell>
                <ModalInfoId txs={this.props.txs} />
                {this.isLoadingTokensR()}
              </Table.Cell>
              <Table.Cell textAlign="right">
                <Button
                  content="GET TOKENS"
                  onClick={this.handleClickTokens}
                  disabled={this.state.loading || this.props.balance === '0.0'} />
                <Popup
                  content="You need ether to get tokens"
                  trigger={<Icon name="info" circular />} />
              </Table.Cell>
            </Table.Row>
            <Table.Row>
              <Table.Cell>
                ETH:
              </Table.Cell>
              <Table.Cell colSpan="2">
                {this.isLoadingEthers()}
              </Table.Cell>
              <Table.Cell textAlign="right">
                <a href="https://goerli-faucet.slock.it/" target="_blank" rel="noopener noreferrer">
                  <Button content="GET ETHER" />
                </a>
              </Table.Cell>
            </Table.Row>
            <Table.Row>
              <Table.Cell colSpan="4">
                Approve tokens
              </Table.Cell>
            </Table.Row>
            <Table.Row>
              <Table.Cell>
                Approved tokens
              </Table.Cell>
              <Table.Cell colSpan="3">
                {this.isLoadingTokensA()}
              </Table.Cell>
            </Table.Row>
            <Table.Row>
              <Table.Cell>
                Amount Tokens:
              </Table.Cell>
              <Table.Cell colSpan="3">
                <input type="text" ref={this.amountTokensRef} />
                <Button content="APPROVE" onClick={this.handleClick} />
              </Table.Cell>
            </Table.Row>
            <Table.Row>
              <Table.Cell>
                Address SC Tokens:
              </Table.Cell>
              <Table.Cell colSpan="3">
                <input
                  type="text"
                  disabled
                  placeholder="0x0000000000000000000000000000000000000000"
                  ref={this.addressTokensRef}
                  defaultValue={this.props.tokensAddress}
                  size="40" />
              </Table.Cell>
            </Table.Row>
          </Table.Body>
        </Table>
        <br />
      </Container>
    );
  }
}

export default InfoWallet;
