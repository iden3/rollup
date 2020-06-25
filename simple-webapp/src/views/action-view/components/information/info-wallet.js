import React, { Component } from 'react';
import PropTypes from 'prop-types';
import {
  Table, Button, Container, Icon,
} from 'semantic-ui-react';
import InfoEtherum from './info-ethereum';
import InfoBabyjub from './info-babyjub';

import { pointToCompress } from '../../../../utils/utils';

const web3 = require('web3');

class InfoWallet extends Component {
  static propTypes = {
    desWallet: PropTypes.object.isRequired,
    isLoadingInfoAccount: PropTypes.bool.isRequired,
    tokens: PropTypes.string,
    tokensR: PropTypes.string,
    tokensE: PropTypes.string,
    tokensA: PropTypes.string,
    tokensArray: PropTypes.array,
    tokensAArray: PropTypes.array,
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
    tokensArray: [],
    tokensAArray: [],
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

  reload = () => {
    this.setState({ firstLoading: true });
    this.props.getInfoAccount();
  }

  isLoadingTokensTotal = () => {
    if (this.state.loading === false) {
      return web3.utils.fromWei(this.props.tokensTotal, 'ether');
    }
    return <Icon name="circle notched" loading />;
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
        <InfoEtherum
          address={this.state.address}
          tokens={this.props.tokens}
          tokensA={this.props.tokensA}
          tokensArray={this.props.tokensArray}
          tokensAArray={this.props.tokensAArray}
          balance={this.props.balance}
          noImported={this.props.noImported}
          loading={this.state.loading} />
        <InfoBabyjub
          babyjub={this.state.babyjub}
          tokensR={this.props.tokensR}
          tokensE={this.props.tokensE}
          txs={this.props.txs}
          txsExits={this.props.txsExits}
          noImported={this.props.noImported}
          loading={this.state.loading} />
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
