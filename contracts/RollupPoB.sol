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
    uint256 constant offChainHashInput = 4;
    uint256 constant beneficiaryAddressInput = 9;

    // Defines slot/era block duration
    uint constant public DELAY_GENESIS = 1000;
    uint32 constant public BLOCKS_PER_SLOT = 100;
    uint constant public SLOT_DEADLINE = 20;

    // Burn Address
    address payable burn;

    // Minimum bid to enter the auction
    uint public constant MIN_BID = 1 ether;

    // Minimum next Bid
    uint constant minNumSlots = 2;

    // % of bid
    uint constant percentBonus = 10;
    uint constant percentNextBid = 30;

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

    // Defines information of slot
    struct InfoSlot {
        // Indicates if at least one batch has been forged on an slot
        bool fullFilled;
        // current price of slot
        uint slotPrice;
        // accumulated bonus
        uint accumulatedBonus;
    }

    // Mappings
    // mapping to control bonus amount by address
    mapping(address => uint) public bonusBalance;
    // mapping to control withdraw bid by address
    mapping(address => uint) public withdrawBid;
    // mapping to control winner by slot
    mapping(uint => Operator) public slotWinner;
    // mapping to control bid by slot
    mapping(uint => Bid) public slotBid;
    // mapping to control information of slot
    mapping(uint => InfoSlot) public infoSlot;

    /**
     * @dev Event called when an operator commits data before forging it
     */
    event dataCommitted(uint256 hashOffChain);

    /**
     * @dev Event called when an operator beat the bestBid of the ongoing auction
     */
    event newBestBid(uint32 slot, uint256 amount, uint256 price, address operator);

    /**
     * @dev RollupPoB constructor
     * Set first block where the first slot begin
     * @param _rollup rollup main smart contract address
     * @param _maxTx maximum transactions
     */
    constructor(address _rollup, uint256 _maxTx, address payable burnAddress) public {
        require(_rollup != address(0), 'Address 0 inserted');
        rollupInterface = RollupInterface(_rollup);
        genesisBlock = getBlockNumber() + DELAY_GENESIS;
        MAX_TX = _maxTx;
        burn = burnAddress;
    }

    /**
     * @dev save the winning operator and return the amount to the previous winner
     * @param slot block number
     * @param forgerAddress address to forge
     * @param beneficiaryAddress address to receive fees
     * @param withdrawAddress address to withdraw amount
     * @param bonusAddress address to receive bonus in SC
     * @param useBonus to use the saved bonus
     */
    function doBid(
        uint32 slot,
        address payable beneficiaryAddress,
        address forgerAddress,
        address withdrawAddress,
        address bonusAddress,
        bool useBonus
    ) internal {
        uint256 amount = msg.value;
        if (useBonus) {
            require(msg.sender == bonusAddress, "To use bonus it is necessary that sender is the bonusAddress");
            amount += bonusBalance[bonusAddress];
            bonusBalance[bonusAddress] = 0;
        }
        if(slotBid[slot].initialized) {
            uint minNextBid = slotBid[slot].amount + (slotBid[slot].amount * percentNextBid)/100;
            require(amount >= minNextBid, 'Ether send not enough to outbid current bid');
            uint bonus = (slotBid[slot].amount * percentBonus)/100;
            _returnBid(slotBid[slot].amount, bonus, slotWinner[slot]);
            infoSlot[slot].accumulatedBonus += bonus;
            burn.transfer(amount - slotBid[slot].amount - bonus);
        } else {
            require(amount >= MIN_BID, 'Ether send not enough to enter auction');
            burn.transfer(amount);
            slotBid[slot].initialized = true;
        }
        Operator memory op = Operator(beneficiaryAddress, forgerAddress, withdrawAddress, bonusAddress);
        slotWinner[slot] = op;
        slotBid[slot].amount = amount;
        infoSlot[slot].slotPrice = amount - infoSlot[slot].accumulatedBonus;
        emit newBestBid(slot, slotBid[slot].amount, infoSlot[slot].slotPrice, forgerAddress);
    }

    /**
     * @dev Receive a bid from an operator
     * Beneficiary address, forger address, withdraw address and bonus address are the same address ( msg.sender )
     * @param slot slot for which the operator is offering
     */
    function bid(uint32 slot) external payable {
        require(slot >= currentSlot() + minNumSlots, 'This auction is already closed');
        doBid(slot, msg.sender, msg.sender, msg.sender, msg.sender, true);
    }

    /**
     * @dev Receive a bid from an operator
     * Forger address, withdraw address and bonus address are the same address ( msg.sender )
     * Specify address ( beneficiary address ) to receive operator earnings
     * @param slot slot for which the operator is offering
     * @param beneficiaryAddress beneficiary address
     */
    function bidWithDifferentBeneficiary(uint32 slot, address payable beneficiaryAddress) external payable {
        require(slot >= currentSlot() + minNumSlots, 'This auction is already closed');
        doBid(slot, beneficiaryAddress, msg.sender, msg.sender, msg.sender, true);
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
        require(slot >= currentSlot() + minNumSlots, 'This auction is already closed');
        doBid(slot, beneficiaryAddress, forgerAddress, msg.sender, msg.sender, true);
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
        require(slot >= currentSlot() + minNumSlots, 'This auction is already closed');
        doBid(slot, beneficiaryAddress, forgerAddress, withdrawAddress, msg.sender, true);
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
        require(slot >= currentSlot() + minNumSlots, 'This auction is already closed');
        doBid(slot, beneficiaryAddress, forgerAddress, withdrawAddress, bonusAddress, useBonus);
    }

    /**
     * @dev distribution of the amount
     * @param amount amount to distribute
     * @param op operator who will receive the amount
     */
    function _returnBid(uint amount, uint bonus, Operator storage op) private {
        withdrawBid[op.withdrawAddress] += amount;
        bonusBalance[op.bonusAddress] += bonus;
    }
    /**
     * @dev function to withdraw bid
     */
    function withdraw() external {
        require(withdrawBid[msg.sender] > 0, 'You cannot withdraw the amount');
        uint auxAmount = withdrawBid[msg.sender];
        withdrawBid[msg.sender] = 0;
        msg.sender.transfer(auxAmount);
    }

    /**
     * @dev operator commits data and forge a batch
     * @param compressedTx data committed by the operator. Represents off-chain transactions
     * @param proofA zk-snark input
     * @param proofB zk-snark input
     * @param proofC zk-snark input
     * @param input public zk-snark inputs
     */
    function commitAndForge(
        bytes calldata compressedTx,
        uint[2] calldata proofA,
        uint[2][2] calldata proofB,
        uint[2] calldata proofC,
        uint[10] calldata input,
        bytes calldata compressedOnChainTx
    ) external payable virtual {
        uint32 slot = currentSlot();
        Operator storage op = slotWinner[slot];

        // message sender must be the controller address
        require(msg.sender == op.forgerAddress, 'message sender must be forgerAddress');

        // beneficiary address input must be operator benefiacry address
        require(op.beneficiaryAddress == address(input[beneficiaryAddressInput]),
            'beneficiary address must be operator beneficiary address');

        uint256 offChainHash = hashOffChainTx(compressedTx, MAX_TX);

        // Check input off-chain hash matches hash commited
        require(offChainHash == input[offChainHashInput],
            'hash off chain input does not match hash commited');

        rollupInterface.forgeBatch.value(msg.value)(proofA, proofB, proofC, input, compressedOnChainTx);

        // one block has been forged in this slot
        infoSlot[slot].fullFilled = true;
        emit dataCommitted(offChainHash);
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
        uint[10] calldata input,
        bytes calldata compressedOnChainTx
    ) external payable virtual {
        uint32 slot = currentSlot();

        // Check if deadline has been achieved to forge data
        uint blockDeadline = getBlockBySlot(slot + 1) - SLOT_DEADLINE;
        require(getBlockNumber() >= blockDeadline, 'not possible to forge data before deadline');

        // Check there is no data to be forged
        require(!infoSlot[slot].fullFilled, 'another operator has already forged data');
        uint256 offChainHash = hashOffChainTx(compressedTx, MAX_TX);

        // Check input off-chain hash matches hash commited
        require(offChainHash == input[offChainHashInput],
            'hash off chain input does not match hash commited');

        rollupInterface.forgeBatch.value(msg.value)(proofA, proofB, proofC, input, compressedOnChainTx);
        emit dataCommitted(offChainHash);
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
}
