pragma solidity ^0.5.0;

contract PoseidonUnit {
  function poseidon(uint256[] memory) public pure returns(uint256) {}
}

contract Poseidon {
  PoseidonUnit poseidonUnit;

  constructor( address _poseidonContractAddr) public {
    poseidonUnit = PoseidonUnit(_poseidonContractAddr);
  }

  function hash(uint256[] memory inputs) public view returns(uint256) {
    return poseidonUnit.poseidon(inputs);
  }
}