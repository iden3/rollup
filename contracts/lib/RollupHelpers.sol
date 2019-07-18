pragma solidity ^0.5.0;

import './Memory.sol';

contract PoseidonUnit {
  function poseidon(uint256[] memory) public pure returns(uint256) {}
}

/**
 * @dev Rollup helper functions
 */
contract RollupHelpers { 

  using Memory for *;

  PoseidonUnit insPoseidonUnit;

  /**
   * @dev Load poseidon function constructor
   * @param _poseidonContractAddr poseidon contract address
   */
  constructor( address _poseidonContractAddr) public {
    insPoseidonUnit = PoseidonUnit(_poseidonContractAddr);
  }

  /**
   * @dev hash poseidon multi-input elements
   * @param inputs input element array
   * @return poseidon hash
   */
  function hash( uint256[] memory inputs) internal view returns (uint256){
    
  }
}