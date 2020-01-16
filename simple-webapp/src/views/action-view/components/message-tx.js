import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { Message, Icon } from 'semantic-ui-react';

class MessageTx extends Component {
  static propTypes = {
    isLoadingDeposit: PropTypes.bool.isRequired,
    successDeposit: PropTypes.bool.isRequired,
    isLoadingWithdraw: PropTypes.bool.isRequired,
    successWithdraw: PropTypes.bool.isRequired,
    isLoadingSend: PropTypes.bool.isRequired,
    successSend: PropTypes.bool.isRequired,
    isLoadingApprove: PropTypes.bool.isRequired,
    successApprove: PropTypes.bool.isRequired,
    isLoadingGetTokens: PropTypes.bool.isRequired,
    successGetTokens: PropTypes.bool.isRequired,
    error: PropTypes.string.isRequired,
    tx: PropTypes.object.isRequired,
  }

  getMessage = () => {
    if (this.props.isLoadingDeposit === true || this.props.isLoadingWithdraw === true
      || this.props.isLoadingSend === true || this.props.isLoadingApprove === true
      || this.props.isLoadingGetTokens === true) {
      return (
        <Message icon color="orange">
          <Icon name="circle notched" loading />
          <Message.Content>
            <Message.Header>Waiting for the transaction...</Message.Header>
          </Message.Content>
        </Message>
      );
    // } else if (this.props.errorDeposit !== '' || this.props.errorWithdraw !== '' || this.props.errorSend !== '' || this.props.errorApprove !== '' || this.props.errorGetTokens !== '') {
    } if (this.props.error !== '') {
      return (
        <Message icon color="red">
          <Icon name="exclamation" />
          <Message.Content>
            <Message.Header>Error!</Message.Header>
          </Message.Content>
        </Message>
      );
    } if (this.props.successSend === true) {
      return (
        <Message icon color="green">
          <Icon name="check" />
          <Message.Content>
            <Message.Header>Transaction send!</Message.Header>
            <p>Transaction is being forged... Please click Reload in few seconds!</p>
          </Message.Content>
        </Message>
      );
    } if (this.props.successDeposit === true || this.props.successWithdraw === true
      || this.props.successApprove === true || this.props.successGetTokens === true) {
      return (
        <Message icon color="green">
          <Icon name="check" />
          <Message.Content>
            <Message.Header>Transaction send!</Message.Header>
            <p>Transaction is being forged... Please click Reload in few seconds!</p>
            <a
              href={`https://etherscan.io/tx/${this.props.tx.hash}`}
              target="_blank"
              rel="noopener noreferrer">
            View on Etherscan
            </a>
          </Message.Content>
        </Message>
      );
    }
    return '';
  }

  render() {
    return (
      <div>
        {this.getMessage()}
      </div>
    );
  }
}
const mapStateToProps = (state) => ({
  isLoadingDeposit: state.transactions.isLoadingDeposit,
  successDeposit: state.transactions.successDeposit,
  isLoadingWithdraw: state.transactions.isLoadingWithdraw,
  successWithdraw: state.transactions.successWithdraw,
  isLoadingSend: state.transactions.isLoadingSend,
  successSend: state.transactions.successSend,
  isLoadingApprove: state.transactions.isLoadingApprove,
  successApprove: state.transactions.successApprove,
  isLoadingGetTokens: state.transactions.isLoadingGetTokens,
  successGetTokens: state.transactions.successGetTokens,
  /* errorDeposit: state.transactions.errorDeposit,
  errorWithdraw: state.transactions.errorWithdraw,
  errorSend: state.transactions.errorSend,
  errorApprove: state.transactions.errorApprove,
  errorGetTokens: state.transactions.errorGetTokens, */
  error: state.transactions.error,
  tx: state.transactions.tx,
});

export default connect(mapStateToProps, { })(MessageTx);
