import React, { Component } from 'react';
import PropTypes from 'prop-types';
import {
  Table, Button, Container, Icon, Popup,
} from 'semantic-ui-react';
import ModalInfoId from './modal-info-id';
import ModalInfoIdExits from './modal-info-id-exits';
import ButtonGM from './gmButtons';
import { pointToCompress } from '../../../utils/utils';

const web3 = require('web3');

class InfoWallet extends Component {
  static propTypes = {
    desWallet: PropTypes.object.isRequired,
    isLoadingInfoAccount: PropTypes.bool.isRequired,
    tokens: PropTypes.string,
    tokensR: PropTypes.string,
    tokensE: PropTypes.string,
    tokensA: PropTypes.string,
    balance: PropTypes.string,
    tokensAddress: PropTypes.string,
    txs: PropTypes.array,
    txsExits: PropTypes.array,
    handleClickApprove: PropTypes.func.isRequired,
    handleClickGetTokens: PropTypes.func.isRequired,
    getInfoAccount: PropTypes.func.isRequired,
    noImported: PropTypes.bool.isRequired,
  }

  static defaultProps = {
    tokens: '0',
    tokensR: '0',
    tokensE: '0',
    balance: '0',
    txs: [],
  }

  constructor(props) {
    super(props);
    this.state = {
      address: '0x0000000000000000000000000000000000000000',
      babyjub: '0x0000000000000000000000000000000000000000',
      loading: false,
      firstLoading: true,
    };
    this.addressTokensRef = React.createRef();
    this.amountTokensRef = React.createRef();
  }

  async componentDidMount() {
    try {
      let address;
      if (Object.keys(this.props.desWallet).length !== 0) {
        if (this.props.desWallet.ethWallet.address.startsWith('0x')) {
          address = this.props.desWallet.ethWallet.address;
        } else {
          address = `0x${this.props.desWallet.ethWallet.address}`;
        }
        if (this.state.address !== address) {
          const babyjub = pointToCompress(this.props.desWallet.babyjubWallet.publicKey);
          this.setState({ address, babyjub });
        }
      }
    } catch (e) {
      this.state.address = '0x0000000000000000000000000000000000000000';
      this.state.babyjub = '0x0000000000000000000000000000000000000000';
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
    let amountTokens;
    try {
      amountTokens = web3.utils.toWei(this.amountTokensRef.current.value, 'ether');
    } catch (err) {
      amountTokens = "0";
    }
    this.props.handleClickApprove(this.addressTokensRef.current.value, amountTokens);
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

  importedWalletBabyJub = () => {
    if (this.state.babyjub === '0x0000000000000000000000000000000000000000') {
      return (
        <div>
          <Icon name="close" color="red" />
              You must import a wallet!
        </div>
      );
    }
    return this.state.babyjub;
  }

  reload = () => {
    this.setState({ firstLoading: true });
    this.props.getInfoAccount();
  }

  isLoadingTokens = () => {
    if (this.state.loading === false) {
      return web3.utils.fromWei(this.props.tokens, 'ether');
    }
    return <Icon name="circle notched" loading />;
  }

  isLoadingTokensR = () => {
    if (this.state.loading === false) {
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

  isLoadingTokensE = () => {
    if (this.state.loading === false) {
      return web3.utils.fromWei(this.props.tokensE, 'ether');
    }
    return <Icon name="circle notched" loading />;
  }

  isLoadingEthers = () => {
    if (this.state.loading === false) {
      return this.props.balance;
    }
    return <Icon name="circle notched" loading />;
  }

  copyAddress = () => {
    const aux = document.createElement('input');
    aux.setAttribute('value', this.state.address);
    document.body.appendChild(aux);
    aux.select();
    document.execCommand('copy');
    document.body.removeChild(aux);
  }

  copyBabyJub = () => {
    const auxBaby = document.createElement('input');
    auxBaby.setAttribute('value', this.state.babyjub);
    document.body.appendChild(auxBaby);
    auxBaby.select();
    document.execCommand('copy');
    document.body.removeChild(auxBaby);
  }

  render() {
    return (
      <Container>
        <Table attached color="blue" inverted>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell colSpan="3">INFORMATION</Table.HeaderCell>
              <Table.HeaderCell textAlign="right">
                <Button onClick={this.reload} disabled={this.props.noImported}>
                  <Icon name="sync" color="blue" />
                  Reload
                </Button>
              </Table.HeaderCell>
            </Table.Row>
          </Table.Header>
        </Table>
        <Table attached>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell colSpan="3">Ethereum</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
        </Table>
        <Table attached fixed>
          <Table.Body>
            <Table.Row>
              <Table.Cell colSpan="1" width="3">
                Ethereum Address:
              </Table.Cell>
              <Table.Cell colSpan="2">
                {this.importedWallet()}
              </Table.Cell>
              <Table.Cell colSpan="2" floated="left">
                <Button
                  icon="copy outline"
                  circular
                  size="large"
                  onClick={this.copyAddress}
                  disabled={this.props.noImported} />
              </Table.Cell>
            </Table.Row>
            <Table.Row>
              <Table.Cell colSpan="1" width="3">
                Transaction Fee:
              </Table.Cell>
              <Table.Cell colSpan="4">
                <ButtonGM />
              </Table.Cell>
            </Table.Row>
            <Table.Row>
              <Table.Cell>
                ETH:
              </Table.Cell>
              <Table.Cell colSpan="3">
                {this.isLoadingEthers()}
              </Table.Cell>
              <Table.Cell textAlign="right">
                <a href="https://goerli-faucet.slock.it/" target="_blank" rel="noopener noreferrer">
                  <Button disabled={this.props.noImported}>
                    GET ETHER
                    <Icon name="arrow alternate circle right" color="blue" />
                  </Button>
                </a>
              </Table.Cell>
            </Table.Row>
            <Table.Row>
              <Table.Cell>
                TOKENS:
              </Table.Cell>
              <Table.Cell colSpan="3">
                {this.isLoadingTokens()}
              </Table.Cell>
              <Table.Cell textAlign="right">
                <Popup
                  content="You need ether to get tokens"
                  trigger={<Icon name="info" circular />} />
                <Button
                  onClick={this.handleClickTokens}
                  disabled={this.state.loading || this.props.balance === '0.0' || this.props.noImported}>
                  GET TOKENS
                  <Icon name="ethereum" />
                </Button>
              </Table.Cell>
            </Table.Row>
          </Table.Body>
        </Table>
        <Table attached>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell colSpan="3">Rollup</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
        </Table>
        <Table attached fixed>
          <Table.Body>
            <Table.Row>
              <Table.Cell colSpan="1" width="3">
                Rollup Address (BabyJubJub):
              </Table.Cell>
              <Table.Cell colSpan="2">
                {this.importedWalletBabyJub()}
              </Table.Cell>
              <Table.Cell colSpan="1" floated="left">
                <Button
                  icon="copy outline"
                  circular
                  size="large"
                  onClick={this.copyBabyJub}
                  disabled={this.props.noImported} />
              </Table.Cell>
            </Table.Row>
            <Table.Row>
              <Table.Cell>
                TOKENS ROLLUP:
              </Table.Cell>
              <Table.Cell textAlign="left" colSpan="3">
                <ModalInfoId txs={this.props.txs} noImported={this.props.noImported} />
                {this.isLoadingTokensR()}
              </Table.Cell>
            </Table.Row>
            <Table.Row>
              <Table.Cell>
                PENDING EXIT TOKENS:
              </Table.Cell>
              <Table.Cell textAlign="left" colSpan="3">
                <ModalInfoIdExits txsExits={this.props.txsExits} noImported={this.props.noImported} />
                {this.isLoadingTokensE()}
              </Table.Cell>
            </Table.Row>
          </Table.Body>
        </Table>
        <Table attached="top" color="teal" inverted>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell colSpan="4">
                APPROVE TOKENS
              </Table.HeaderCell>
            </Table.Row>
          </Table.Header>
        </Table>
        <Table attached fixed>
          <Table.Body>
            <Table.Row>
              <Table.Cell>
                Approved tokens
              </Table.Cell>
              <Table.Cell colSpan="2">
                {this.isLoadingTokensA()}
              </Table.Cell>
            </Table.Row>
            <Table.Row>
              <Table.Cell>
                Address SC Tokens:
              </Table.Cell>
              <Table.Cell colSpan="2">
                <input
                  type="text"
                  disabled
                  placeholder="0x0000000000000000000000000000000000000000"
                  ref={this.addressTokensRef}
                  defaultValue={this.props.tokensAddress}
                  size="40" />
              </Table.Cell>
            </Table.Row>
            <Table.Row>
              <Table.Cell>
                Amount Tokens:
              </Table.Cell>
              <Table.Cell colSpan="1">
                <input
                  type="text"
                  ref={this.amountTokensRef}
                  size="40"
                  disabled={this.props.noImported} />
              </Table.Cell>
              <Table.Cell colSpan="1">
                <Button floated="right" onClick={this.handleClick} disabled={this.props.noImported}>
                  APPROVE
                  <Icon name="ethereum" />
                </Button>
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
