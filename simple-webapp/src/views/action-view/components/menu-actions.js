import React, { Component } from 'react';
import PropTypes from 'prop-types';
import {
  Table, Button, Icon, Container,
} from 'semantic-ui-react';

class MenuActions extends Component {
  static propTypes = {
    handleItemClick: PropTypes.func.isRequired,
    noImported: PropTypes.bool.isRequired,
  }

  render() {
    return (
      <Container>
        <Table textAlign="center" celled attached fixed color="violet" inverted>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>
                <p>
                  ETHEREUM
                  <Icon name="ethereum" />
                </p>
              </Table.HeaderCell>
              <Table.HeaderCell>
                ROLLUP
              </Table.HeaderCell>
            </Table.Row>
          </Table.Header>
        </Table>
        <Table attached fixed>
          <Table.Body>
            <Table.Row>
              <Table.Cell>
                <Button.Group widths="2">
                  <Button name="deposit" onClick={this.props.handleItemClick} disabled={this.props.noImported}>
                    <Icon name="sign-in" />
                          Deposit
                  </Button>
                  <Button name="withdraw" onClick={this.props.handleItemClick} disabled={this.props.noImported}>
                    <Icon name="sign-out" />
                          Exit
                  </Button>
                </Button.Group>
              </Table.Cell>
              <Table.Cell>
                <Button.Group widths="2">
                  <Button name="send" onClick={this.props.handleItemClick} disabled={this.props.noImported}>
                    <Icon name="share" />
                          Send
                  </Button>
                  <Button name="send0" onClick={this.props.handleItemClick} disabled={this.props.noImported}>
                    <Icon name="reply" />
                          Withdraw
                  </Button>
                </Button.Group>
              </Table.Cell>
            </Table.Row>
          </Table.Body>
        </Table>
      </Container>
    );
  }
}
export default MenuActions;
