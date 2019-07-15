
pragma solidity ^0.5;


contract Rollup is Owned {

    uint constant MIN_COMMIT_COLLATERAL = 1 ether; // Minim collateral required to commit for a block
    uint constant MAX_COMMIT_BLOCKS = 150; // Blocks that the operator can forge

    byte32[] stateRoots;
    byte32[] exitRoots;

    address[] tokens;               // List of ERC20 tokens

    address commitedOperator;       // Operator that is commited to forge the block
    uint commitBlockExpires;        // Block where the commit is not valid any more

    uint lastAssignedIdx;

    byte32 miningOnChainTxsHash;    // Hash of the OnChain TXs list that will be mined in the next block
    byte32 fillingOnChainTxsHash;   // Hash of the OnChain TXs list that will be mined in two blocks
                                    // New onChain TX goes to this list


    function commitToBlock(
        bytes32 newRoot
    ) public payable {
    }

    function forgeBlock(
        bytes32 newStateRoot,
        bytes32 exitRoot,
        uint32[2] memory feePlan,
        uint32 nTxPerCoin,
        uint[2] memory proofA,
        uint[2][2] memory proofB,
        uint[2] memory proofC,
        bytes memory compressedTxs,
        address beneficiary
    ) public {

        // Public Parameters of the curcuit
        // newStateRoot,
        // ExitRoot
        // feePlan[2]
        // nTxPerCoin
        // Hash(compressedTxs)
        // miningOnChainTxsHash
        // beneficiary


        miningOnChainTxsHash = fillingOnChainTxsHash;
        fillingOnChainTxsHash = 0;
    }

    // TODO: Deposit fees?
    function deposit(
        uint depositAmount,
        uint token,
        uint[2] babyPubKey,
        uint to,                // In the TX deposit, it allows to do a send during deposit
        uint sendAmount
    ) payable public {

        lastAssignedIdx++;
        fillingOnChainTxsHash = hash(fillingOnChainTxsHash, thisTx);
    }

    // TODO: Withdraw fee?
    function withdraw(
        uint exitBlock,
        uint amount,
        uint coin,
        uint[2] babyPubKey,
        bytes merkleProof,
        bytes babySignature,
        address dest
    ) {

    }

    // TODO: Withdraw fee?
    function forceWithdraw(
        uint idx,
        uint amount,
        bytes babySignature,
    ) {

        fillingOnChainTxsHash = hash(fillingOnChainTxsHash, thisTx);
    }

    function addToken(address newToken) onlyOwner public {
        assert(tokens.length<0xFFFF);
        tokens.push(newToken);
    }

//////////////
// Viewers
/////////////

    function getRoot(uint idx) public view returns (bytes32) {
        return roots[idx];
    }


    /// @return Total number of blocks mined
    function getDepth() public view returns (uint) {
        return roots.length;
    }
}
