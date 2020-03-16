import React, { Component } from 'react';
import PropTypes from 'prop-types';
import {
  Table, Button, Container, Icon,
} from 'semantic-ui-react';
import ModalInfoId from './modal-info-id';
import ModalInfoIdExits from './modal-info-id-exits';
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
    tokensTotal: PropTypes.string,
    balance: PropTypes.string,
    txs: PropTypes.array,
    txsExits: PropTypes.array,
    getInfoAccount: PropTypes.func.isRequired,
    noImported: PropTypes.bool.isRequired,
  }

  static defaultProps = {
    tokens: '0',
    tokensR: '0',
    tokensE: '0',
    tokensTotal: '0',
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

  isLoadingTokensTotal = () => {
    if (this.state.loading === false) {
      return web3.utils.fromWei(this.props.tokensTotal, 'ether');
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
        <Table attached color="blue" inverted fixed>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell />
              <Table.HeaderCell colSpan="6" textAlign="center">INFORMATION</Table.HeaderCell>
              <Table.HeaderCell textAlign="right">
                <Button onClick={this.reload} disabled={this.props.noImported}>
                  <Icon name="sync" color="blue" />
                  Reload
                </Button>
              </Table.HeaderCell>
            </Table.Row>
          </Table.Header>
        </Table>
        <Table attached fixed>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell rowSpan="4" textAlign="center" colSpan="1">Ethereum</Table.HeaderCell>
              <Table.Cell colSpan="2"><b>Ethereum Address:</b></Table.Cell>
              <Table.Cell colSpan="5">
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
              <Table.Cell colSpan="2">
                <b>ETH:</b>
              </Table.Cell>
              <Table.Cell colSpan="7">
                {this.isLoadingEthers()}
              </Table.Cell>
            </Table.Row>
            <Table.Row>
              <Table.Cell colSpan="2">
                <b>TOKENS:</b>
              </Table.Cell>
              <Table.Cell colSpan="7">
                {this.isLoadingTokens()}
              </Table.Cell>
            </Table.Row>
            <Table.Row>
              <Table.Cell colSpan="2">
                <b>APPROVED TOKENS:</b>
              </Table.Cell>
              <Table.Cell colSpan="7">
                {this.isLoadingTokensA()}
              </Table.Cell>
            </Table.Row>
          </Table.Header>
        </Table>
        <Table attached fixed>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell rowSpan="3" textAlign="center" colSpan="1">Rollup</Table.HeaderCell>
              <Table.Cell colSpan="2"><b>Rollup (BabyJubJub) Address:</b></Table.Cell>
              <Table.Cell colSpan="5">
                {this.importedWalletBabyJub()}
              </Table.Cell>
              <Table.Cell colSpan="2" floated="left">
                <Button
                  icon="copy outline"
                  circular
                  size="large"
                  onClick={this.copyBabyJub}
                  disabled={this.props.noImported} />
              </Table.Cell>
            </Table.Row>
            <Table.Row>
              <Table.Cell colSpan="2">
                <b>TOKENS:</b>
              </Table.Cell>
              <Table.Cell colSpan="5">
                {this.isLoadingTokensR()}
              </Table.Cell>
              <Table.Cell colSpan="2" floated="left">
                <ModalInfoId txs={this.props.txs} noImported={this.props.noImported} />
              </Table.Cell>
            </Table.Row>
            <Table.Row>
              <Table.Cell colSpan="2">
                <b>PENDING WITHDRAW TOKENS:</b>
              </Table.Cell>
              <Table.Cell colSpan="5">
                {this.isLoadingTokensE()}
              </Table.Cell>
              <Table.Cell colSpan="2" floated="left">
                <ModalInfoIdExits txsExits={this.props.txsExits} noImported={this.props.noImported} />
              </Table.Cell>
            </Table.Row>
          </Table.Header>
        </Table>
        <Table attached fixed>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell textAlign="center" colSpan="1">Total</Table.HeaderCell>
              <Table.Cell colSpan="2"><b>TOKENS:</b></Table.Cell>
              <Table.Cell colSpan="7">
                {this.isLoadingTokensTotal()}
              </Table.Cell>
            </Table.Row>
          </Table.Header>
        </Table>
        <br />
      </Container>
    );
  }
}

export default InfoWallet;
