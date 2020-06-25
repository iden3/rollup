import React, { Component } from 'react';
import PropTypes from 'prop-types';
import {
  Table, Button, Icon,
} from 'semantic-ui-react';
import ModalInfoId from '../modals-info/modal-info-id';
import ModalInfoIdExits from '../modals-info/modal-info-id-exits';

const web3 = require('web3');

class InfoBabyjub extends Component {
  static propTypes = {
    tokensR: PropTypes.string,
    tokensE: PropTypes.string,
    txs: PropTypes.array,
    txsExits: PropTypes.array,
    noImported: PropTypes.bool.isRequired,
    babyjub: PropTypes.string.isRequired,
    loading: PropTypes.bool.isRequired,
  }

  static defaultProps = {
    tokensR: '0',
    tokensE: '0',
    txs: [],
  }

  importedWalletBabyJub = () => {
    if (this.props.babyjub === '0x0000000000000000000000000000000000000000') {
      return (
        <div>
          <Icon name="close" color="red" />
          You must import a wallet!
        </div>
      );
    }
    return this.props.babyjub;
  }

  isLoadingTokensR = () => {
    if (this.props.loading === false) {
      return web3.utils.fromWei(this.props.tokensR, 'ether');
    }
    return <Icon name="circle notched" loading />;
  }

  isLoadingTokensE = () => {
    if (this.props.loading === false) {
      return web3.utils.fromWei(this.props.tokensE, 'ether');
    }
    return <Icon name="circle notched" loading />;
  }

  copyBabyJub = () => {
    const auxBaby = document.createElement('input');
    auxBaby.setAttribute('value', this.props.babyjub);
    document.body.appendChild(auxBaby);
    auxBaby.select();
    document.execCommand('copy');
    document.body.removeChild(auxBaby);
  }

  render() {
    return (
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
    );
  }
}

export default InfoBabyjub;
