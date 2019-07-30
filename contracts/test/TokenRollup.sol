pragma solidity ^0.5.0;

import '../../node_modules/openzeppelin-solidity/contracts/token/ERC20/ERC20.sol';

contract TokenRollup is ERC20{

  constructor(address initialAccount, uint256 initialBalance) public {
    require(initialBalance > 0, "initial balance has to be greater than 0");
    _mint(initialAccount, initialBalance);
  }
}