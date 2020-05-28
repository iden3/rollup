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
    uint constant public DELAY_GENESIS = 20;
    uint32 constant public BLOCKS_PER_SLOT = 20;
    uint constant public SLOT_DEADLINE = 4;

    // Burn Address
    address payable burn;
    // Operator by Default
    Operator public opDefault;

    // Minimum bid to enter the auction
    uint public constant MIN_BID = 0.001 ether;

    // Minimum next Bid
    uint constant minNumSlots = 2;

    // % of bid
    uint constant percentBonus = 10;
    uint constant percentNextBid = 30;

    uint32 a;

    // Defines operator structure
    struct Operator {
        address payable beneficiaryAddress;
        address forgerAddress;
        address withdrawAddress;
        address bonusAddress;
        string url;
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
    event newBestBid(uint32 slot, uint256 amount, uint256 price, address operator, string url);

    /**
     * @dev RollupPoB constructor
     * Set first block where the first slot begin
     * @param _rollup rollup main smart contract address
     * @param _maxTx maximum transactions
     */
    constructor(address _rollup, uint256 _maxTx, address payable burnAddress, address payable opDefaultAddr, string memory urlDefault) public {
        require(_rollup != address(0), 'Address 0 inserted');
        rollupInterface = RollupInterface(_rollup);
        genesisBlock = getBlockNumber() + DELAY_GENESIS;
        MAX_TX = _maxTx;
        burn = burnAddress;
        opDefault = Operator(opDefaultAddr, opDefaultAddr, opDefaultAddr, opDefaultAddr, urlDefault);
    }

    /**
     * @dev save the winning operator and return the amount to the previous winner
     * @param slot block number
     * @param op operator address and url
     * @param useBonus to use the saved bonus
     * @param value bid value
     */
    function doBid(
        uint32 slot,
        Operator memory op,
        bool useBonus,
        uint256 value
    ) internal returns (uint) {
        uint256 amount = value;
        uint burnAmount = 0;
        if (useBonus) {
            require(msg.sender == op.bonusAddress, "To use bonus it is necessary that sender is the bonusAddress");
            amount += bonusBalance[op.bonusAddress];
            bonusBalance[op.bonusAddress] = 0;
        }
        if(slotBid[slot].initialized) {
            uint minNextBid = slotBid[slot].amount + (slotBid[slot].amount * percentNextBid)/100;
            require(amount >= minNextBid, 'Ether send not enough to outbid current bid');
            uint bonus = (slotBid[slot].amount * percentBonus)/100;
            _returnBid(slotBid[slot].amount, bonus, slotWinner[slot]);
            infoSlot[slot].accumulatedBonus += bonus;
            burnAmount = amount - slotBid[slot].amount - bonus;
        } else {
            require(amount >= MIN_BID, 'Ether send not enough to enter auction');
            opDefault.beneficiaryAddress.transfer(amount);
            slotBid[slot].initialized = true;
        }
        slotWinner[slot] = op;
        slotBid[slot].amount = amount;
        infoSlot[slot].slotPrice = amount - infoSlot[slot].accumulatedBonus;
        emit newBestBid(slot, slotBid[slot].amount, infoSlot[slot].slotPrice, op.forgerAddress, op.url);
        return burnAmount;
    }

    /**
     * @dev Receive a bid from an operator
     * Beneficiary address, forger address, withdraw address and bonus address are the same address ( msg.sender )
     * @param url orperator url
     * @param slot slot for which the operator is offering
     */
    function bid(uint32 slot, string calldata url) external payable {
        require(slot >= currentSlot() + minNumSlots, 'This auction is already closed');
        Operator memory op = Operator(msg.sender, msg.sender, msg.sender, msg.sender, url);
        uint burnAmount = doBid(slot, op, true, msg.value);
        burn.transfer(burnAmount);
    }

    /**
     * @dev Receive a bid from an operator
     * Beneficiary address, forger address, withdraw address and bonus address are the same address ( msg.sender )
     * @param rangeBid range bids value
     * @param rangeSlot range slots for which the operator is offering
     * @param url orperator url
     */
    function multiBid(uint256[] calldata rangeBid, uint32[2][] calldata rangeSlot, string calldata url) external payable {
        require(rangeBid.length == rangeSlot.length, "Range length error");
        uint256 totalAmount = 0;
        for (uint i = 0; i < rangeBid.length; i++) {
            require(rangeSlot[i][0] >= currentSlot() + minNumSlots, "One auction is already closed");
            require(rangeSlot[i][1] >= rangeSlot[i][0], "Slot range error");
            totalAmount += rangeBid[i]*(rangeSlot[i][1] - rangeSlot[i][0] + 1);
        }
        require(msg.value >= totalAmount, "Not enought value");
        Operator memory op = Operator(msg.sender, msg.sender, msg.sender, msg.sender, url);
        uint256 burnAmount = 0;
        uint256 returnAmount = 0;
        uint256 minNextBid;
        for(uint j = 0; j < rangeBid.length; j++) {
            for (uint32 z = rangeSlot[j][0]; z <= rangeSlot[j][1]; z++) {
                uint32 actualSlot = z;
                uint256 amountBid = rangeBid[j];
                Bid memory actualBid = slotBid[actualSlot];
                if(!actualBid.initialized) {
                    minNextBid = MIN_BID;
                } else {
                    minNextBid = actualBid.amount + (actualBid.amount * percentNextBid)/100;
                }
                if(amountBid >= minNextBid) {
                    burnAmount += doBid(actualSlot, op, false, amountBid);
                } else {
                    returnAmount += amountBid;
                }
            }
        }
        burn.transfer(burnAmount);
        (msg.sender).transfer(returnAmount);
    }

    /**
     * @dev Receive a bid from an operator
     * Forger address, withdraw address and bonus address are the same address ( msg.sender )
     * Specify address ( beneficiary address ) to receive operator earnings
     * @param slot slot for which the operator is offering
     * @param url orperator url
     * @param beneficiaryAddress beneficiary address
     */
    function bidWithDifferentBeneficiary(uint32 slot, string calldata url, address payable beneficiaryAddress) external payable {
        require(slot >= currentSlot() + minNumSlots, 'This auction is already closed');
        Operator memory op = Operator(beneficiaryAddress, msg.sender, msg.sender, msg.sender, url);
        uint burnAmount = doBid(slot, op, true, msg.value);
        burn.transfer(burnAmount);
    }

    /**
     * @dev Receive a bid from an operator
     * Withdraw address and bonus address are the same address ( msg.sender )
     * Forger address and beneficiary address are submitted as parameters
     * @param slot slot for which the operator is offering
     * @param url orperator url
     * @param forgerAddress controller address
     * @param beneficiaryAddress beneficiary address
     */
    function bidRelay(uint32 slot, string calldata url, address payable beneficiaryAddress, address forgerAddress) external payable {
        require(slot >= currentSlot() + minNumSlots, 'This auction is already closed');
        Operator memory op = Operator(beneficiaryAddress, forgerAddress, msg.sender, msg.sender, url);
        uint burnAmount = doBid(slot, op, true, msg.value);
        burn.transfer(burnAmount);
    }

    /**
     * @dev Receive a bid from an operator
     * msg.sender is the bonus address
     * Forger address, beneficiary address and withdraw address are submitted as parameters
     * @param slot slot for which the operator is offering
     * @param url orperator url
     * @param forgerAddress controller address
     * @param beneficiaryAddress beneficiary address
     * @param withdrawAddress withdraw address
     */
    function bidRelayAndWithdrawAddress(
        uint32 slot,
        string calldata url,
        address payable beneficiaryAddress,
        address forgerAddress,
        address withdrawAddress
    ) external payable {
        require(slot >= currentSlot() + minNumSlots, 'This auction is already closed');
        Operator memory op = Operator(beneficiaryAddress, forgerAddress, withdrawAddress, msg.sender, url);
        uint burnAmount = doBid(slot, op, true, msg.value);
        burn.transfer(burnAmount);
    }

    /**
     * @dev Receive a bid from an operator
     * Forger address, beneficiary address, withdraw address and bonus address are submitted as parameters
     * @param slot slot for which the operator is offering
     * @param url orperator url
     * @param forgerAddress controller address
     * @param beneficiaryAddress beneficiary address
     * @param withdrawAddress withdraw address
     * @param bonusAddress withdraw address
     * @param useBonus decide whether to use the bonus saved in the smart contract
     */
    function bidWithDifferentAddresses(
        uint32 slot,
        string calldata url,
        address payable beneficiaryAddress,
        address forgerAddress,
        address withdrawAddress,
        address bonusAddress,
        bool useBonus
    ) external payable {
        require(slot >= currentSlot() + minNumSlots, 'This auction is already closed');
        Operator memory op = Operator(beneficiaryAddress, forgerAddress, withdrawAddress, bonusAddress, url);
        uint burnAmount = doBid(slot, op, useBonus, msg.value);
        burn.transfer(burnAmount);
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

        if(op.forgerAddress != address(0x00)){
            // message sender must be the controller address
            require(msg.sender == op.forgerAddress, 'message sender must be forgerAddress');
            // beneficiary address input must be operator benefiacry address
            require(op.beneficiaryAddress == address(input[beneficiaryAddressInput]),
                'beneficiary address must be operator beneficiary address');
        } else {
            require(msg.sender == opDefault.forgerAddress, 'message sender must be default operator');
            require(opDefault.beneficiaryAddress == address(input[beneficiaryAddressInput]),
                    'beneficiary address must be default operator beneficiary address');
        }

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
     * @dev Retrieve slot winner
     * @return slot, forger, url, amount
     */
    function getWinner(uint slot) public view returns (uint, address, address, string memory, uint) {
        uint256 amount = slotBid[slot].amount;
        address forger = slotWinner[slot].forgerAddress;
        address beneficiary = slotWinner[slot].beneficiaryAddress;
        string memory url = slotWinner[slot].url;
        return (slot, forger, beneficiary, url, amount);
    }

     /**
     * @dev Retrieve slot winner url
     * @return url
     */
    function getWinnerUrl(uint slot) public view returns (string memory) {
        return slotWinner[slot].url;
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

    function fullFilledSlot(uint32 slot) public view returns (bool) {
        return infoSlot[slot].fullFilled;
    }
}
