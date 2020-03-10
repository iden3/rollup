pragma solidity ^0.6.1;

import '../../node_modules/@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '../../node_modules/@openzeppelin/contracts/token/ERC20/ERC20Detailed.sol';

contract TokenTest is ERC20, ERC20Detailed {

  constructor(
      address initialAccount,
      uint256 initialBalance,
      string memory name,
      string memory symbol,
      uint8 decimals)
      public ERC20Detailed(name, symbol, decimals) {
          require(initialBalance > 0, "initial balance has to be greater than 0");
          _mint(initialAccount, initialBalance);
    }
}