import React, { Component } from 'react';
import PropTypes from 'prop-types';
import {
  Table, Button, Icon,
} from 'semantic-ui-react';
import ModalInfoId from '../modals-info/modal-info-id';

const web3 = require('web3');

class InfoEthereum extends Component {
  static propTypes = {
    tokens: PropTypes.string,
    tokensArray: PropTypes.array,
    tokensAArray: PropTypes.array,
    tokensA: PropTypes.string,
    balance: PropTypes.string,
    noImported: PropTypes.bool.isRequired,
    address: PropTypes.string.isRequired,
    loading: PropTypes.bool.isRequired,
  }

  static defaultProps = {
    tokens: '0',
    balance: '0',
    tokensArray: [],
    tokensAArray: [],
  }

  importedWallet = () => {
    if (this.props.address === '0x0000000000000000000000000000000000000000') {
      return (
        <div>
          <Icon name="close" color="red" />
          You must import a wallet!
        </div>
      );
    }
    return this.props.address;
  }

  isLoadingTokens = () => {
    if (this.props.loading === false) {
      return web3.utils.fromWei(this.props.tokens, 'ether');
    }
    return <Icon name="circle notched" loading />;
  }

  isLoadingTokensA = () => {
    if (this.props.loading === false) {
      return web3.utils.fromWei(this.props.tokensA, 'ether');
    }
    return <Icon name="circle notched" loading />;
  }

  isLoadingEthers = () => {
    if (this.props.loading === false) {
      return this.props.balance;
    }
    return <Icon name="circle notched" loading />;
  }

  copyAddress = () => {
    const aux = document.createElement('input');
    aux.setAttribute('value', this.props.address);
    document.body.appendChild(aux);
    aux.select();
    document.execCommand('copy');
    document.body.removeChild(aux);
  }

  render() {
    return (
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
            <Table.Cell colSpan="5">
              {this.isLoadingTokens()}
            </Table.Cell>
            <Table.Cell colSpan="2" floated="left">
              <ModalInfoId txs={this.props.tokensArray} noImported={this.props.noImported} />
            </Table.Cell>
          </Table.Row>
          <Table.Row>
            <Table.Cell colSpan="2">
              <b>APPROVED TOKENS:</b>
            </Table.Cell>
            <Table.Cell colSpan="5">
              {this.isLoadingTokensA()}
            </Table.Cell>
            <Table.Cell colSpan="2" floated="left">
              <ModalInfoId txs={this.props.tokensAArray} noImported={this.props.noImported} />
            </Table.Cell>
          </Table.Row>
        </Table.Header>
      </Table>
    );
  }
}

export default InfoEthereum;
