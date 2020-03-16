import React, { Component } from 'react';
import {
  Container, Icon, Card, Label, Menu, Header,
} from 'semantic-ui-react';

import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import ModalInfoOffchain from './modal-info-offchain';
import ModalInfoOnchain from './modal-info-onchain';
import ModalInfoTx from './modal-info-txs';

class InfoOp extends Component {
  static propTypes = {
    pendingOffchain: PropTypes.array.isRequired,
    pendingOnchain: PropTypes.array.isRequired,
    txTotal: PropTypes.array.isRequired,
    currentBatch: PropTypes.number.isRequired,
  }

  constructor(props) {
    super(props);
    this.state = {
      modalInfoOnchain: false,
      modalInfoOffchain: false,
      modalInfoTx: false,
      keyItem: {},
    };
  }

  toggleModalInfoOnchain = () => { this.setState((prev) => ({ modalInfoOnchain: !prev.modalInfoOnchain })); }

  toggleModalInfoOffchain = () => { this.setState((prev) => ({ modalInfoOffchain: !prev.modalInfoOffchain })); }

  toggleModalInfoTx = () => { this.setState((prev) => ({ modalInfoTx: !prev.modalInfoTx })); }

  getInfoModalOnchain = (e, keyItem) => {
    e.preventDefault();
    this.setState({ keyItem });
    this.toggleModalInfoOnchain();
  }

  getInfoModalOffchain = (e, keyItem) => {
    e.preventDefault();
    this.setState({ keyItem });
    this.toggleModalInfoOffchain();
  }


  getInfoModalTx = (e) => {
    e.preventDefault();
    this.toggleModalInfoTx();
  }

  getMessagePending = () => {
    const { pendingOnchain, pendingOffchain } = this.props;
    if (pendingOffchain.length > 0 || pendingOnchain.length > 0) {
      return (
        <Container>
          <Header as="h3">Pending Transactions:</Header>
        </Container>
      );
    }
  }

  getPendingOffchain = () => {
    const { pendingOffchain } = this.props;
    return pendingOffchain.map((key) => {
      return (
        <Card color="blue" key={key.id} onClick={(event) => this.getInfoModalOffchain(event, key)}>
          <Card.Content>
            <Card.Header>
              {key.type}
              :
              {' '}
              {key.amount}
              {' '}
              Tokens
            </Card.Header>
            <Card.Meta>Off-chain</Card.Meta>
          </Card.Content>
        </Card>
      );
    });
  }

  getPendingOnchain = () => {
    const { pendingOnchain } = this.props;
    return pendingOnchain.map((key, index) => {
      if (key.type === 'Withdraw') {
        return (
          <Card color="violet" key={index} onClick={(event) => this.getInfoModalOnchain(event, key)}>
            <Card.Content>
              <Card.Header>
                {key.type}
              </Card.Header>
              <Card.Meta>On-chain</Card.Meta>
            </Card.Content>
          </Card>
        );
      }
      return (
        <Card color="violet" key={index} onClick={(event) => this.getInfoModalOnchain(event, key)}>
          <Card.Content>
            <Card.Header>
              {key.type}
                :
              {' '}
              {key.amount}
              {' '}
                Tokens
            </Card.Header>
            <Card.Meta>On-chain</Card.Meta>
          </Card.Content>
        </Card>
      );
    });
  }

  render() {
    return (
      <Container>
        <Container textAlign="left">
          <Card.Group>
            {this.getMessagePending()}
            {this.getPendingOffchain()}
            {this.getPendingOnchain()}
          </Card.Group>
        </Container>
        <Container textAlign="right">
          <Menu compact>
            <Menu.Item as="a" onClick={(event) => this.getInfoModalTx(event)}>
              <Label color="blue" floating>{this.props.txTotal.length}</Label>
              <Icon name="time" color="blue" />
              Historic
            </Menu.Item>
          </Menu>
        </Container>
        <ModalInfoTx
          modalInfoTx={this.state.modalInfoTx}
          txTotal={this.props.txTotal}
          toggleModalInfoTx={this.toggleModalInfoTx}
          getInfoModalOnchain={this.getInfoModalOnchain}
          getInfoModalOffchain={this.getInfoModalOffchain} />
        <ModalInfoOffchain
          modalInfoOffchain={this.state.modalInfoOffchain}
          keyItem={this.state.keyItem}
          toggleModalInfoOffchain={this.toggleModalInfoOffchain}
          currentBatch={this.props.currentBatch} />
        <ModalInfoOnchain
          modalInfoOnchain={this.state.modalInfoOnchain}
          keyItem={this.state.keyItem}
          toggleModalInfoOnchain={this.toggleModalInfoOnchain}
          currentBatch={this.props.currentBatch} />
      </Container>
    );
  }
}

const mapStateToProps = (state) => ({
  pendingOffchain: state.txState.pendingOffchain,
  pendingOnchain: state.txState.pendingOnchain,
  txTotal: state.txState.txTotal,
  currentBatch: state.general.currentBatch,
});

export default connect(mapStateToProps, { })(InfoOp);
