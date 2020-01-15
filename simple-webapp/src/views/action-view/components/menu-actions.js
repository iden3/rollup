import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Table, Button, Icon } from 'semantic-ui-react';

class MenuActions extends Component {
  static propTypes = {
    handleItemClick: PropTypes.func.isRequired,
  }

  render() {
    return (
      <Table padded textAlign="center" celled fixed>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>
                    ONCHAIN
            </Table.HeaderCell>
            <Table.HeaderCell>
                    OFFCHAIN
            </Table.HeaderCell>
          </Table.Row>
        </Table.Header>

        <Table.Body>
          <Table.Row>
            <Table.Cell>
              <Button.Group widths="2">
                <Button name="deposit" onClick={this.props.handleItemClick}>
                  <Icon name="sign-in" />
                        Deposit
                </Button>
                <Button name="withdraw" onClick={this.props.handleItemClick}>
                  <Icon name="sign-out" />
                        Withdraw
                </Button>
              </Button.Group>
            </Table.Cell>
            <Table.Cell>
              <Button.Group widths="2">
                <Button name="send" onClick={this.props.handleItemClick}>
                  <Icon name="share" />
                        Send
                </Button>
                <Button name="send0" onClick={this.props.handleItemClick}>
                  <Icon name="reply" />
                        Send 0
                </Button>
              </Button.Group>
            </Table.Cell>
          </Table.Row>
        </Table.Body>
      </Table>
    );
  }
}
export default MenuActions;
