pragma solidity ^0.5.0;

import './Memory.sol';

/**
 * @dev Interface poseidon hash function
 */
contract PoseidonUnit {
  function poseidon(uint256[] memory) public pure returns(uint256) {}
}

/**
 * @dev Rollup helper functions
 */
contract RollupHelpers { 

  using Memory for *;

  PoseidonUnit insPoseidonUnit;

  struct Entry {
    bytes32 e1;
    bytes32 e2;
    bytes32 e3;
    bytes32 e4;
    bytes32 e5;
  }

  /**
   * @dev Load poseidon smart contract
   * @param _poseidonContractAddr poseidon contract address
   */
  constructor (address _poseidonContractAddr) public {
    insPoseidonUnit = PoseidonUnit(_poseidonContractAddr);
  }

  /**
   * @dev hash poseidon multi-input elements
   * @param inputs input element array
   * @return poseidon hash
   */
  function hashGeneric(uint256[] memory inputs) internal view returns (uint256){
    return insPoseidonUnit.poseidon(inputs);
  }

  /**
   * @dev hash poseidon for sparse merkle tree nodes
   * @param left input element array
   * @param right input element array
   * @return poseidon hash
   */
  function hashNode(uint256 left, uint256 right) internal view returns (uint256){
    uint256[] memory inputs = new uint256[](2);
    inputs[0] = left;
    inputs[1] = right;
    return hashGeneric(inputs);
  }

  /**
   * @dev hash poseidon for sparse merkle tree final nodes
   * @param key input element array
   * @param value input element array
   * @return poseidon hash1
   */
  function hashFinalNode(uint256 key, uint256 value) internal view returns (uint256){
    uint256[] memory inputs = new uint256[](3);
    inputs[0] = key;
    inputs[1] = value;
    inputs[2] = 1;
    return hashGeneric(inputs);
  }

  /**
   * @dev poseidon hash for entry generic structure
   * @param entry entry structure
   * @return poseidon hash
   */
  function hashEntry(Entry memory entry) internal view returns (uint256){
    uint256[] memory inputs = new uint256[](5);
    inputs[0] = uint256(entry.e1);
    inputs[1] = uint256(entry.e2);
    inputs[2] = uint256(entry.e3);
    inputs[3] = uint256(entry.e4);
    inputs[4] = uint256(entry.e5);
    return hashGeneric(inputs);
  }

  /**
   * @dev Verify sparse merkle tree proof
   * @param root root to verify
   * @param siblings all siblings
   * @param key key to verify
   * @param value value to verify
   * @param isNonExistence existence or non-existence verification
   * @param isOld indicates non-existence non-empty verification
   * @param oldKey needed in case of non-existence proof with non-empty node
   * @param oldValue needed in case of non-existence proof with non-empty node
   * @return true if verification is correct, false otherwise
   */
  function smtVerifier(uint256 root, uint256[] memory siblings,
    uint256 key, uint256 value, uint256 oldKey, uint256 oldValue,
    bool isNonExistence, bool isOld, uint256 maxLevels) internal view returns (bool){

    // Step 1: check if proof is non-existence non-empty
    uint256 newHash;
    if (isNonExistence && isOld) {
      // Check old key is final node
      uint exist = 0;
      uint levCounter = 0;
      while((exist == 0) && (levCounter < maxLevels)) {
        exist = (uint8(oldKey >> levCounter) & 0x01) ^ (uint8(key >> levCounter) & 0x01);
        levCounter += 1;
      }

      if(exist == 0) {
        return false;
      }
      newHash = hashFinalNode(oldKey, oldValue);
    }

    // Step 2: Calcuate root
    uint256 nextHash = isNonExistence ? newHash : hashFinalNode(key, value);
    uint256 siblingTmp;
    for (int256 i = int256(siblings.length) - 1; i >= 0; i--) {
     siblingTmp = siblings[uint256(i)];
      bool leftRight = (uint8(key >> i) & 0x01) == 1;
      nextHash = leftRight ? hashNode(siblingTmp, nextHash)
                           : hashNode(nextHash, siblingTmp);
    }

    // Step 3: Check root
    return root == nextHash;
  }

  /**
   * @dev Build entry for deposit on-chain transaction
   * @param idBalanceTree ethereum address
   * @param amountDeposit ethereum address
   * @param coin ethereum address
   * @param Ax ethereum address
   * @param Ay ethereum address
   * @param withdrawAddress ethereum address
   * @param sendTo ethereum address
   * @param sendAmount ethereum address
   * @param nonce ethereum address
   * @return entry structure
   */
  function buildEntryDeposit(uint24 idBalanceTree, uint16 amountDeposit, uint32 coin,
    uint256 Ax, uint256 Ay, address withdrawAddress, uint24 sendTo, uint16 sendAmount, uint32 nonce)
    internal pure returns (Entry memory entry) {

    // build element 1
    entry.e1 = bytes32(bytes3(idBalanceTree))>>(256 - 24);
    entry.e1 |= bytes32(bytes2(amountDeposit))>>(256 - 16 - 24);
    entry.e1 |= bytes32(bytes4(coin))>>(256 - 32 - 16 - 24);
    entry.e1 |= bytes32(bytes20(withdrawAddress))>>(256 - 160 - 32 - 16 - 24);
    // build element 2
    entry.e2 = bytes32(bytes3(sendTo))>>(256 - 24);
    entry.e2 |= bytes32(bytes2(sendAmount))>>(256 - 16 - 24);
    entry.e2 |= bytes32(bytes4(nonce))>>(256 - 32 - 16 - 24);
    // build element 3
    entry.e3 = bytes32(Ax);
    // build element 4
    entry.e4 = bytes32(Ay);
  }

  /**
   * @dev build entry for fee plan
   * @param feePlan contains all fee plan data
   * @return entry structure
   */
  function buildEntryFeePlan(bytes32[2] memory feePlan)
    internal pure returns (Entry memory entry) {
    // build element 1
    entry.e1 = bytes32(feePlan[0] << 128) >> (256 - 128);
    // build element 2
    entry.e2 = bytes32(feePlan[0]) >> (256 - 128);
    // build element 3
    entry.e3 = bytes32(feePlan[1] << 128)>>(256 - 128);
    // build element 4
    entry.e4 = bytes32(feePlan[1]) >> (256 - 128);
  }

  /**
   * @dev build entry for the exit tree leaf
   * @param id balnce tree identifier
   * @param amount amunt to withdraw
   * @param token coin type
   * @param withAddress withdraw address
   * @return entry structure
   */
  function buildEntryExitLeaf(uint24 id, uint16 amount, uint16 token, address withAddress)
    internal pure returns (Entry memory entry) {
    // build element 1
    entry.e1 = bytes32(bytes3(id)) >> (256 - 24);
    entry.e1 |= bytes32(bytes2(amount)) >> (256 - 16 - 24);
    entry.e1 |= bytes32(bytes2(token)) >> (256 - 16 - 16 - 24);
    entry.e1 |= bytes32(bytes20(withAddress)) >> (256 - 160 - 16 - 16 - 24);
  }

  /**
   * @dev Calculate total fee amount for the beneficiary
   * @param fees contains all fee plan data
   * @param nTxCoin number of transaction per coin
   * @param coinId identificator coin
   * @return total fee amount
   */
  function calcCoinTotalFee(bytes32 fees, bytes32 nTxCoin, uint coinId)
    internal pure returns (uint) {
    // get number of trasaction depending on coin
    uint nTx = uint16(bytes2(nTxCoin << coinId*16));
    // get fee depending on coin
    uint fee = uint16(bytes2(fees << coinId*16));
    return nTx*fee;
  }

  /**
   * @dev hash all off-chain transactions
   * @param offChainTx off-chain transaction compressed format
   * @return hash of all off-chain transactions
   */
  function hashOffChainTx(bytes memory offChainTx) internal view returns (uint256) {
    Memory.Cursor memory c = Memory.read(offChainTx);
    Entry memory entry;
    uint256[] memory inputs = new uint256[](2);
    uint256 hashTotal = 0;

    while(!c.eof()) {
      bytes3 from = c.readBytes3();
      bytes3 to = c.readBytes3();
      bytes2 amount = c.readBytes2();

      entry.e1 = bytes32(amount)>>(256 - 16);
      entry.e1 |= bytes32(to)>>(256 - 24 - 16);
      entry.e1 |= bytes32(from)>>(256 - 24 - 24 - 16);

      inputs[0] = hashTotal;
      inputs[1] = hashEntry(entry);
      hashTotal = hashGeneric(inputs);
    }
    return hashTotal;
  }

  /**
   * @dev Retrieve ethereum address from a msg plus signature
   * @param msgHash message hash
   * @param rsv signature
   * @return Ethereum address recovered from the signature
   */
  function checkSig(bytes32 msgHash, bytes memory rsv) public pure returns (address) {
    bytes32 r;
    bytes32 s;
    uint8   v;

    assembly {
        r := mload(add(rsv, 32))
        s := mload(add(rsv, 64))
        v := byte(0, mload(add(rsv, 96)))
    }
    return ecrecover(msgHash, v, r, s);
  }
}