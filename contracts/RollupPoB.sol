pragma solidity ^0.6.1;
import './RollupInterface.sol';
import './lib/RollupPoBHelpers.sol';

contract RollupPoB is RollupPoBHelpers{

    // Rollup smart contract address
    RollupInterface rollupInterface;

    // First block where the first era begins
    uint public genesisBlock;

    // Maximum rollup transactions: either off-chain or on-chain transactions
    uint public MAX_TX;

    // Input snark definition
    uint256 constant offChainHashInput = 3;

    // Defines slot/era block duration
    uint constant public DELAY_GENESIS = 1000;
    uint32 constant public BLOCKS_PER_SLOT = 100;
    uint32 constant public SLOTS_PER_ERA = 20;
    uint constant public SLOT_DEADLINE = 20;

    // Minimum bid to enter the auction
    uint public constant MIN_BID = 1 ether;

    // Defines operator structure
    struct Operator {
        address payable beneficiaryAddress;
        address forgerAddress;
        address withdrawAddress;
        address bonusAddress;
    }

    // Defines bid structure
    struct Bid {
        uint amount;
        bool initialized;
    }

    // Information regarding data committed
    struct commitData {
        bytes32 previousHash;
        bool committed;
        uint256 offChainHash;
    }

    // Mappings
    // mapping to control bonus amount by address
    mapping(address => uint) public bidBalance;
    // mapping to control withdraw bid by address
    mapping(address => uint) public withdrawBid;
    // mapping to control winner by slot
    mapping(uint => Operator) public slotWinner;
    // mapping to control bid by slot
    mapping(uint => Bid) slotBid;
    // mapping to control data committed by slot
    mapping (uint => commitData) commitSlot;
    // Indicates if at least one batch has been forged on an slot
    mapping (uint32 =>  bool) fullFilled;

    /**
     * @dev Event called when an operator commits data before forging it
     */
    event dataCommitted(uint256 hashOffChain);

    /**
     * @dev Event called when an operator beat the bestBid of the ongoing auction
     */
    event newBestBid(uint32 slot, uint256 amount, address operator);

    /**
     * @dev RollupPoB constructor
     * Set first block where the era will begin
     * @param _rollup rollup main smart contract address
     * @param _maxTx maximum transactions
     */
    constructor(address _rollup, uint256 _maxTx) public {
        require(_rollup != address(0), 'Address 0 inserted');
        rollupInterface = RollupInterface(_rollup);
        genesisBlock = getBlockNumber() + DELAY_GENESIS;
        MAX_TX = _maxTx;
    }

    /**
     * @dev Retrieve block number
     * @return current block number
     */
    function getBlockNumber() public view virtual returns (uint) {
        return block.number;
    }

    /**
     * @dev Calculate slot from block number
     * @param numBlock block number
     * @return slot number
     */
    function block2slot(uint numBlock) public view returns (uint32) {
        if (numBlock < genesisBlock) return 0;
        return uint32((numBlock - genesisBlock) / (BLOCKS_PER_SLOT));
    }

    /**
     * @dev Retrieve current slot
     * @return slot number
     */
    function currentSlot() public view returns (uint32) {
        return block2slot(getBlockNumber());
    }

    /**
     * @dev Retrieve the first block number for a given slot
     * @param slot slot number
     * @return block number
     */
    function getBlockBySlot(uint32 slot) public view returns (uint) {
        return (genesisBlock + slot*BLOCKS_PER_SLOT);
    }

    /**
     * @dev save the winning operator and return the amount to the previous winner
     * @param slot block number
     * @param forgerAddress address to forge
     * @param beneficiaryAddress address to receive fees
     * @param withdrawAddress address to withdraw amount
     * @param bonusAddress address to receive bonus in SC
     * @param useBonus to use the saved bonus
     * @param value bid amount
     */
    function doBid(
        uint32 slot,
        address payable beneficiaryAddress,
        address forgerAddress,
        address withdrawAddress,
        address bonusAddress,
        bool useBonus,
        uint128 value
    ) public {
        uint256 amount;
        if (useBonus) {
            amount = value + bidBalance[bonusAddress];
            bidBalance[bonusAddress] = 0;
        } else {
            amount = value;
        }
        if(slotBid[slot].initialized) {
            require(amount >= (slotBid[slot].amount * 13)/10, 'Ether send not enough to outbid current bid');
            _returnBid(slotBid[slot].amount, slotWinner[slot]);
        } else {
            require(amount >= MIN_BID, 'Ether send not enough to enter auction');
        }
        Operator memory op = Operator(beneficiaryAddress, forgerAddress, withdrawAddress, bonusAddress);
        slotWinner[slot] = op;
        slotBid[slot].initialized = true;
        slotBid[slot].amount = amount;
        emit newBestBid(slot, slotBid[slot].amount, forgerAddress);
    }

    /**
     * @dev Receive a bid from an operator
     * Beneficiary address, forger address, withdraw address and bonus address are the same address ( msg.sender )
     * @param slot slot for which the operator is offering
     */
    function bid(uint32 slot) external payable {
        require(slot >= currentSlot() + 2, 'This auction is already closed');
        doBid(slot, msg.sender, msg.sender, msg.sender, msg.sender, true, uint128(msg.value));
    }

    /**
     * @dev Receive a bid from an operator
     * Forger address, withdraw address and bonus address are the same address ( msg.sender )
     * Specify address ( beneficiary address ) to receive operator earnings
     * @param slot slot for which the operator is offering
     * @param beneficiaryAddress beneficiary address
     */
    function bidWithDifferentBeneficiary(uint32 slot, address payable beneficiaryAddress) external payable {
        require(slot >= currentSlot() + 2, 'This auction is already closed');
        doBid(slot, beneficiaryAddress, msg.sender, msg.sender, msg.sender, true, uint128(msg.value));
    }

    /**
     * @dev Receive a bid from an operator
     * Withdraw address and bonus address are the same address ( msg.sender )
     * Forger address and beneficiary address are submitted as parameters
     * @param slot slot for which the operator is offering
     * @param forgerAddress controller address
     * @param beneficiaryAddress beneficiary address
     */
    function bidRelay(uint32 slot, address payable beneficiaryAddress, address forgerAddress) external payable {
        require(slot >= currentSlot() + 2, 'This auction is already closed');
        doBid(slot, beneficiaryAddress, forgerAddress, msg.sender, msg.sender, true, uint128(msg.value));
    }

    /**
     * @dev Receive a bid from an operator
     * msg.sender is the bonus address
     * Forger address, beneficiary address and withdraw address are submitted as parameters
     * @param slot slot for which the operator is offering
     * @param forgerAddress controller address
     * @param beneficiaryAddress beneficiary address
     * @param withdrawAddress withdraw address
     */
    function bidRelayAndWithdrawAddress(
        uint32 slot,
        address payable beneficiaryAddress,
        address forgerAddress,
        address withdrawAddress
    ) external payable {
        require(slot >= currentSlot() + 2, 'This auction is already closed');
        doBid(slot, beneficiaryAddress, forgerAddress, withdrawAddress, msg.sender, true, uint128(msg.value));
    }

    /**
     * @dev Receive a bid from an operator
     * Forger address, beneficiary address, withdraw address and bonus address are submitted as parameters
     * @param slot slot for which the operator is offering
     * @param forgerAddress controller address
     * @param beneficiaryAddress beneficiary address
     * @param withdrawAddress withdraw address
     * @param bonusAddress withdraw address
     * @param useBonus decide whether to use the bonus saved in the smart contract
     */
    function bidWithDifferentAddresses(
        uint32 slot,
        address payable beneficiaryAddress,
        address forgerAddress,
        address withdrawAddress,
        address bonusAddress,
        bool useBonus
    ) external payable {
        require(slot >= currentSlot() + 2, 'This auction is already closed');
        doBid(slot, beneficiaryAddress, forgerAddress, withdrawAddress, bonusAddress, useBonus, uint128(msg.value));
    }

    /**
     * @dev distribution of the amount
     * @param amount amount to distribute
     * @param op operator who will receive the amount
     */
    function _returnBid(uint amount, Operator storage op) private {
        if(withdrawBid[op.withdrawAddress] == 0) {
            withdrawBid[op.withdrawAddress] = amount;
        } else {
            withdrawBid[op.withdrawAddress] = withdrawBid[op.withdrawAddress] + amount;
        }
        if(bidBalance[op.bonusAddress] == 0) {
            bidBalance[op.bonusAddress] = (amount * 1)/10;
        } else {
            bidBalance[op.bonusAddress] = bidBalance[op.bonusAddress] + (amount * 1)/10;
        }
    }
    /**
     * @dev function to withdraw bid
     */
    function withdraw() external {
        require(withdrawBid[msg.sender] > 0, 'You cannot withdraw the amount');
        msg.sender.transfer(withdrawBid[msg.sender]);
        withdrawBid[msg.sender] = 0;
    }

    /**
     * @dev operator commits data that must be forged afterwards
     * @param compressedTx data committed by the operator. Represents off-chain transactions
     */
    function commitBatch(
        bytes memory compressedTx
    ) public {
        uint32 slot = currentSlot();
        Operator storage op = slotWinner[slot];
        // message sender must be the controller address
        require(msg.sender == op.forgerAddress, 'message sender must be forgerAddress');
        // Check if deadline has been achieved to not commit any more data
        uint blockDeadline = getBlockBySlot(slot + 1) - SLOT_DEADLINE;
        require(getBlockNumber() < blockDeadline, 'not possible to commit data after deadline');
        // Check there is no data to be forged
        require(commitSlot[slot].committed == false, 'there is data which is not forged');
        // Store data committed
        commitSlot[slot].committed = true;
        commitSlot[slot].offChainHash = hashOffChainTx(compressedTx, MAX_TX);
        emit dataCommitted(commitSlot[slot].offChainHash);
    }

    /**
     * @dev forge a batch given the current committed data
     * it forwards the batch directly to rollup main contract
     * @param proofA zk-snark input
     * @param proofB zk-snark input
     * @param proofC zk-snark input
     * @param input public zk-snark inputs
     */
    function forgeCommittedBatch(
        uint[2] memory proofA,
        uint[2][2] memory proofB,
        uint[2] memory proofC,
        uint[8] memory input
     ) public virtual {
        uint32 slot = currentSlot();
        Operator storage op = slotWinner[slot];
        // message sender must be the controller address
        require(msg.sender == op.forgerAddress, 'message sender must be forgerAddress');
        // Check input off-chain hash matches hash commited
        require(commitSlot[slot].offChainHash == input[offChainHashInput],
            'hash off chain input does not match hash commited');
        // Check that operator has committed data
        require(commitSlot[slot].committed == true, 'There is no committed data');
        rollupInterface.forgeBatch(op.beneficiaryAddress, proofA, proofB, proofC, input);
        // clear committed data
        commitSlot[slot].committed = false;
        // one block has been forged in this slot
        fullFilled[slot] = true;
    }

    function commitAndForge(
        bytes calldata compressedTx,
        uint[2] calldata proofA,
        uint[2][2] calldata proofB,
        uint[2] calldata proofC,
        uint[8] calldata input
    ) external {
        commitBatch(compressedTx);
        forgeCommittedBatch(proofA, proofB, proofC, input);
    }

     /**
     * @dev commitAndForge after deadline
     * @param compressedTx data committed by the operator. Represents off-chain transactions
     * @param proofA zk-snark input
     * @param proofB zk-snark input
     * @param proofC zk-snark input
     * @param input public zk-snark inputs
     */
    function commitAndForgeDeadline(
        bytes calldata compressedTx,
        uint[2] calldata proofA,
        uint[2][2] calldata proofB,
        uint[2] calldata proofC,
        uint[8] calldata input
    ) external virtual {
        uint32 slot = currentSlot();
        // Check if deadline has been achieved to not commit any more data
        uint blockDeadline = getBlockBySlot(slot + 1) - SLOT_DEADLINE;
        require(getBlockNumber() >= blockDeadline, 'not possible to commit data before deadline');
        // Check there is no data to be forged
        require(!fullFilled[slot], 'another operator has already forged data');
        require(!commitSlot[slot].committed, 'another operator has already submitted data');
        uint256 offChainHash = hashOffChainTx(compressedTx, MAX_TX);
        emit dataCommitted(offChainHash);
        // Check input off-chain hash matches hash commited
        require(offChainHash == input[offChainHashInput],
            'hash off chain input does not match hash commited');
        rollupInterface.forgeBatch(msg.sender, proofA, proofB, proofC, input);
        // one block has been forged in this slot
        fullFilled[slot] = true;
    }
}
