pragma solidity ^0.5.1;
import './RollupInterface.sol';
import './lib/RollupPoSHelpers.sol';

contract RollupPoS is RollupPoSHelpers{

    // Rollup smart contract address
    RollupInterface rollupInterface;

    // Maximum rollup transactions: either off-chain or on-chain transactions
    uint public MAX_TX;

    // Defines slot/era block duration
    uint constant public DELAY_GENESIS = 0;
    uint32 constant public BLOCKS_PER_SLOT = 20;
    uint32 constant public SLOTS_PER_ERA = 5;
    uint constant public SLOT_DEADLINE = 4;

    // Minimum stake to enter the raffle
    uint public constant MIN_STAKE = 0.1 ether;

    // First block where the first era begins
    uint public genesisBlock;
    // Last raffle that has been initialized
    uint32 lastInitializedRaffle;

    // Defines operator structure
    struct Operator {
        uint128 amountStaked;
        uint32 unlockEra; // era from the operator can withdraw its stake
        address controllerAddress;
        address payable beneficiaryAddress;
        bytes32 rndHash;
    }

    // This structure should feed in a single 256 bit word
    // Defines node for the staker tree
    struct IntermediateNode {
        uint32 era;             // Updates on the same era, are not keeped
        uint64 threashold;
        uint64 increment;
        bool isOpLeft;          // true if left is an index of an op. false if it's a node
        uint32 left;
        bool isOpRight;         // true if left is an index of an op. false if it's a node
        uint32 right;
    }

    // Defines raffle structure
    // each era will have a raffle
    // at the begining of each era, all slots winners are determined by:
    // seedRnd --> which will select an operator that will be able to forge at each slot
    // root --> pointer of the initial stake root leaf
    struct Raffle {
        uint32 era;
        uint32 root;
        uint64 historicStake;
        uint64 activeStake;
        bytes8 seedRnd;
    }

    // Array of operators
    Operator[] public operators;
    // Store all staker tree nodes
    IntermediateNode[] nodes;

    // List of raffles depending on era index
    mapping (uint32 => Raffle) raffles;
    // Indicates if at least one batch has been forged on an slot
    // used for slashing operators
    mapping (uint32 =>  bool) fullFilled;

    /**
     * @dev Event called when an operator is added to the staker tree
     */
    event createOperatorLog(address controllerAddress, uint operatorId, string url);

    /**
     * @dev Event called when an operator is removed from the staker tree
     */
    event removeOperatorLog(address controllerAddress, uint operatorId);

    /**
     * @dev Event called when an operator commits data before forging it
     */
    event dataCommitted(uint256 hashOffChain);

    /**
     * @dev RollupPoS constructor
     * Set first block where the era will begin
     * Initializes raffle for first era
     * @param _rollup rollup main smart contract address
     */
    constructor(address _rollup, uint256 _maxTx) public {
        require(_rollup != address(0),'Address 0 inserted');
        rollupInterface = RollupInterface(_rollup);
        genesisBlock = getBlockNumber() + DELAY_GENESIS;
        MAX_TX = _maxTx;
        // Initialize first raffle
        raffles[0] = Raffle(
            0,
            0,
            0,
            0,
            bytes8(keccak256(abi.encodePacked(blockhash(getBlockNumber()))))
        );
    }

    /**
     * @dev Retrieve block number
     * @return current block number
     */
    function getBlockNumber() public view returns (uint) {
        return block.number;
    }

    /**
     * @dev Calculate necessary bits to code a number in binary
     * @param num number to code
     * @return number of bits
     */
    function _log2(uint32 num) private pure returns (uint32) {
        uint32 level = 0;
        uint32 rem = num;
        while (rem > 1) {
            rem = rem >> 1;
            level++;
        }
        return level;
    }

    /**
     * @dev Calculate era from block number
     * @param numBlock block number
     * @return era number
     */
    function block2era(uint numBlock) public view returns (uint32) {
        if (numBlock < genesisBlock) return 0;
        return uint32((numBlock - genesisBlock) / (BLOCKS_PER_SLOT*SLOTS_PER_ERA));
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
     * @dev Retrieve current era
     * @return era number
     */
    function currentEra() public view returns (uint32) {
        return block2era(getBlockNumber());
    }

    /**
     * @dev Retrieve current slot
     * @return slot number
     */
    function currentSlot() public view returns (uint32) {
        return block2slot(getBlockNumber());
    }

    /**
     * @dev update raffles mapping
     * initialize raffle according its era
     */
    function _updateRaffles() private {
        uint32 ce = currentEra();
        if (lastInitializedRaffle >= ce+2) return;
        for (uint32 i = ce; i <= ce+2; i++) {
            if ((i>0) && (raffles[i].era == 0)) {
                Raffle storage lastRaffle = raffles[lastInitializedRaffle];
                raffles[i] = Raffle(
                    i,
                    lastRaffle.root,
                    lastRaffle.historicStake,
                    lastRaffle.activeStake,
                    lastRaffle.seedRnd
                );
                lastInitializedRaffle = i;
            }
        }
    }

    /**
     * @dev Add operator to staker tree
     * @param raffle raffle structure depending on era where the operator has to be added
     * @param n index node
     * @param idOp index operator
     * @param level level where the operator has to be added
     * @return new root of the staker tree once the operator has been added
     */
    function _addToNode(Raffle storage raffle, uint32 n, uint32 idOp, uint32 level) private returns(uint32 newRoot) {
        IntermediateNode storage N = nodes[n];
        if (0 == ( uint32(1) << (level) ) - 1 & idOp ) {  // Left side is full
            nodes.push(IntermediateNode(
                raffle.era,
                raffle.activeStake,
                0,
                false,
                n,
                true,
                idOp
            ));
            return uint32(nodes.length-1);
        } else {
            if (N.isOpRight) {
                nodes.push(IntermediateNode(
                    raffle.era,
                    raffle.activeStake,
                    0,
                    true,
                    N.right,
                    true,
                    idOp
                ));
                newRoot = uint32(nodes.length-1);
            } else {
                uint32 tmpLevel = level;
                while (idOp & (uint32(1) << (tmpLevel - 1)) == 0) tmpLevel--;
                newRoot = _addToNode(raffle, N.right, idOp, tmpLevel-1);
            }
            if (N.era == raffle.era) {
                N.isOpRight = false;
                N.right = newRoot;
                return n;
            } else {
                nodes.push(IntermediateNode(
                    raffle.era,
                    N.threashold,
                    N.increment,
                    N.isOpLeft,
                    N.left,
                    false,
                    newRoot
                ));
                return uint32(nodes.length-1);
            }
        }
    }

    /**
     * @dev create operator, update raffles and add it to the staker tree
     * @param controllerAddress operator controller address
     * @param beneficiaryAddress address which will get the operator earnings
     * @param rndHash hash committed by the operator. Must be revealed its predecessor hash to forge a batch
     * @param value amount staked
     * @return index operator
     */
    function doAddOperator(
        address controllerAddress,
        address payable beneficiaryAddress,
        bytes32 rndHash,
        uint128 value,
        string memory url
    ) private returns(uint) {
        operators.push(Operator(value, 0, controllerAddress, beneficiaryAddress, rndHash));
        uint32 idOp = uint32(operators.length)-1;
        uint32 updateEra = currentEra() + 2;
        uint32 newRoot = 0xFFFFFFFF;
        uint64 eStake = effectiveStake(value);
        require(eStake > 0, 'Stake should be greater than 0');
        _updateRaffles();
        Raffle storage raffle = raffles[updateEra];
        if (idOp > 0) {
            uint32 level = _log2(idOp);
            if (idOp == 1) {
                nodes.push(IntermediateNode(
                    raffle.era,
                    raffle.activeStake,
                    0,
                    true,
                    0,
                    true,
                    idOp
                ));
                newRoot = uint32(nodes.length-1);
            } else {
                newRoot = _addToNode(raffle, raffle.root, idOp, level);
            }
        }
        raffle.root = newRoot;
        raffle.activeStake += eStake;
        raffle.historicStake += eStake;
        emit createOperatorLog(controllerAddress, idOp, url);
        return idOp;
    }

    /**
     * @dev Add operator to the staker tree where:
     * Controller address, beneficiary address and staker address are the same address ( msg.sender )
     * @param rndHash hash committed by the operator
     * @return index operator
     */
    function addOperator(bytes32 rndHash, string calldata url) external payable returns(uint) {
        require(msg.value >= MIN_STAKE, 'Ether send not enough to enter raffle');
        return doAddOperator(msg.sender, msg.sender, rndHash, uint128(msg.value), url);
    }

    /**
     * @dev Add operator to the staker tree where:
     * Controller address and staker address are the same address ( msg.sender )
     * Specify address ( beneficiary address ) to receive operator earnings
     * @param beneficiaryAddress beneficiary address
     * @param rndHash hash committed by the operator
     * @return index operator
     */
    function addOperatorWithDifferentBeneficiary(
        address payable beneficiaryAddress,
        bytes32 rndHash,
        string calldata url
    ) external payable returns(uint) {
        require(msg.value >= MIN_STAKE, 'Ether send not enough to enter raffle');
        return doAddOperator(msg.sender, beneficiaryAddress, rndHash, uint128(msg.value), url);
    }

    /**
     * @dev Add operator to the staker tree where:
     * msg.sender is the staker address
     * controller address and beneficiary address are submitted as parameters
     * @param controllerAddress controller address
     * @param beneficiaryAddress beneficiary address
     * @param rndHash hash committed by the operator
     * @return index operator
     */
    function addOperatorRelay(
        address controllerAddress,
        address payable beneficiaryAddress,
        bytes32 rndHash,
        string calldata url
    ) external payable returns(uint) {
        // Add a third party staker, do not need signature
        require(msg.value >= MIN_STAKE, 'Ether send not enough to enter raffle');
        return doAddOperator(controllerAddress, beneficiaryAddress, rndHash, uint128(msg.value), url);
    }

    /**
     * @dev Remove operator from staker tree
     * @param raffle raffle structure depending on era where the operator has to be removed
     * @param n index node
     * @param opId index operator
     * @param level level where the operator has to be added
     * @param skip flag to skip levels
     * @param eStake effective stake
     */
    function _removeFromNode(
      Raffle storage raffle,
      uint32 n,
      uint32 opId,
      uint32 level,
      bool skip,
      uint64 eStake
    ) private returns(uint32 newRoot){
        IntermediateNode storage N = nodes[n];
        if (opId & (uint32(1) << level) == 0) {
            if (!N.isOpLeft) {
              newRoot = _removeFromNode(raffle, N.left, opId, level-1, true, eStake);
            }
            if (N.era == raffle.era) {
                N.left = newRoot;
                N.threashold -= eStake;
                N.increment += eStake;
                newRoot = n;
            } else {
              if (N.isOpLeft) newRoot = N.left;
                nodes.push(IntermediateNode(
                    raffle.era,
                    N.threashold - eStake,
                    N.increment + eStake,
                    N.isOpLeft,
                    newRoot,
                    N.isOpRight,
                    N.right
                ));
                newRoot = uint32(nodes.length-1);
            }
        } else {
            uint32 tmpLevel = level;
            while ( (skip == false) && (tmpLevel != 0) && ((opId & (uint32(1) << (tmpLevel - 1))) == 0) && ((operators.length - 1) & (uint32(1) << (tmpLevel - 1)) == 0)) tmpLevel--;
            if (!N.isOpRight) {
              if (skip == false) newRoot = _removeFromNode(raffle, N.right, opId, tmpLevel-1, false, eStake);
                else newRoot = _removeFromNode(raffle, N.right, opId, tmpLevel-1, true, eStake);
            }
            if ((N.era != raffle.era)) {
              if (N.isOpRight) newRoot = N.right;
              nodes.push(IntermediateNode(
                  raffle.era,
                  N.threashold,
                  N.increment,
                  N.isOpLeft,
                  N.left,
                  N.isOpRight,
                  newRoot
              ));
              newRoot = uint32(nodes.length-1);
            } else {
              N.right = newRoot;
              newRoot = n;
            }
        }
    }

    /**
     * @dev Remove operator from staker tree and update raffles
     * @param opId index operator
     */
    function doRemoveOperator(uint32 opId) private {
        Operator storage op = operators[opId];
        uint32 updateEra = currentEra() + 2;
        uint64 eStake = effectiveStake(op.amountStaked);
        require(op.unlockEra == 0, 'Operator has been already removed');
        op.unlockEra = updateEra;

        _updateRaffles();
        Raffle storage raffle = raffles[updateEra];

        uint32 level = _log2(uint32(operators.length - 1));
        uint32 newRoot = 0xFFFFFFFF;
        if (operators.length > 1) {
            newRoot = _removeFromNode(raffle, raffle.root, opId, level, false, eStake);
        }
        raffle.root = newRoot;
        raffle.activeStake -= eStake;
        emit removeOperatorLog(op.controllerAddress, opId);
    }

    /**
     * @dev Remove operator where:
     * msg.sender is considered the controller address
     * @param opId index operator
     */
    function removeOperator(uint32 opId) external {
        require(opId < operators.length, 'Operator does not exist');
        Operator storage op = operators[opId];
        require(msg.sender == op.controllerAddress, 'Sender does not match with operator controller');
        doRemoveOperator(opId);
    }

    /**
     * @dev Remove operator where:
     * the sender must prove ownership of controller address
     * @param opId index operator
     * @param r parameter signature
     * @param s parameter signature
     * @param v parameter signature
     */
    function removeOperatorRelay(uint32 opId, bytes32 r, bytes32 s, uint8 v) external {
        require(opId < operators.length, 'Operator does not exist');
        Operator storage op = operators[opId];
        bytes32 h = keccak256(abi.encodePacked("RollupPoS", "remove", opId));
        bytes memory prefix = "\x19Ethereum Signed Message:\n32";
        bytes32 prefixedHash = keccak256(abi.encodePacked(prefix, h));
        require(ecrecover(prefixedHash, v, r, s) == op.controllerAddress, 'Signature does not match with operator controller');
        doRemoveOperator(opId);
    }

    /**
     * @dev function to withdraw stake
     * @param opId index operator
     */
    function withdraw(uint32 opId) external {
        Operator storage op = operators[opId];
        require(op.unlockEra > 0, 'Era to withdraw has not been set yet');
        require(op.unlockEra <= currentEra(), 'Era to withdraw after current era');
        uint amount = op.amountStaked;
        require(amount > 0, 'Amount to return must be greater than 0');
        op.amountStaked = 0;
        op.beneficiaryAddress.transfer(amount);
    }

    /**
     * @dev find operator on the staker tree given an input number
     * @param nodeId index node
     * @param inputNum input number
     * @return operator id
     */
    function nodeRaffle(uint32 nodeId, uint64 inputNum) public view returns(uint32 winner) {
        IntermediateNode storage N = nodes[nodeId];

        if ( inputNum < N.threashold ) {
            if (N.isOpLeft) {
                winner = N.left;
            } else {
                winner = nodeRaffle(N.left, inputNum);
            }
        } else {
            if (N.isOpRight) {
                winner = N.right;
            } else {
                winner = nodeRaffle(N.right, inputNum + N.increment);
            }
        }
    }

    /**
     * @dev Retrieve index operator winner given a slot
     * @param slot slot number
     * @return index operator winner
     */
    function getRaffleWinner(uint32 slot) public view returns (uint32 winner) {
        // No negative era
        uint32 era = slot / SLOTS_PER_ERA;

        // Only accept raffle for present and past eras
        require (era <= currentEra()+1, "No access to not done raffles");

        uint32 ri;
        if (raffles[era].era == era) {
            ri = era;
        } else if (era > lastInitializedRaffle) {
            ri = lastInitializedRaffle;
        } else {
            require(false, "Raffle not initialized for that era");
        }

        Raffle storage raffle = raffles[ri];

        // Must be stakers
        require(raffle.activeStake > 0, "Must be stakers");

        // If only one staker, just return it
        if (operators.length == 1) return 0;

        // Do the raffle
        uint64 rnd = uint64(uint(keccak256(abi.encodePacked(raffle.seedRnd, slot))) % raffle.activeStake);
        winner = nodeRaffle(raffle.root, rnd);
    }

    /**
     * @dev function to report an operator which has not committed a batch
     * in that case, staked amount is burned and the slasher gets a 10% of the staked amount
     * An operator can be slashed if:
     * - no block has been forged during a slot
     * - it has committed data but it has not been forged
     * @param slot slot index
     */
    function slash(uint32 slot) external {
        require(slot < currentSlot(), 'Slot requested still does not exist');
        require(fullFilled[slot] == false || commitSlot[slot].committed == true,
            'Batch has been committed and forged during this slot');

        uint32 opId = getRaffleWinner(slot);
        Operator storage op = operators[opId];

        uint reward = op.amountStaked / 10;
        uint burned = op.amountStaked - reward;

        doRemoveOperator(opId);
        op.amountStaked = 0;

        (address)(0).transfer(burned);
        msg.sender.transfer(reward);
    }

    // mapping to control data committed by slot
    mapping (uint => commitData) commitSlot;

    // Information regarding data committed
    struct commitData {
        bytes32 previousHash;
        bool committed;
        uint256 offChainHash;
    }

    /**
     * @dev operator commits data that must be forged afterwards
     * @param previousRndHash previous hash to match current hash
     * @param compressedTx data committed by the operator. Represents off-chain transactions
     */
    function commitBatch(
        bytes32 previousRndHash,
        bytes memory compressedTx
    ) public {
        uint32 slot = currentSlot();
        uint opId = getRaffleWinner(slot);
        Operator storage op = operators[opId];
        // message sender must be the controller address
        require(msg.sender == op.controllerAddress, 'message sender must be controllerAddress');
        // operator must know data to generate current hash
        require(keccak256(abi.encodePacked(previousRndHash)) == op.rndHash,
            'hash revealed not match current committed hash');
        // Check if deadline has been achieved to not commit any more data
        uint blockDeadline = getBlockBySlot(slot + 1) - SLOT_DEADLINE;
        require(getBlockNumber() < blockDeadline, 'not possible to commit data after deadline');
        // Check there is no data to be forged
        require(commitSlot[slot].committed == false, 'there is data which is not forged');
        // Store data committed
        commitSlot[slot].committed = true;
        commitSlot[slot].offChainHash = hashOffChainTx(compressedTx, MAX_TX);
        commitSlot[slot].previousHash = previousRndHash;
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
     ) public {
        uint32 slot = currentSlot();
        uint opId = getRaffleWinner(slot);
        Operator storage op = operators[opId];
        // message sender must be the controller address
        require(msg.sender == op.controllerAddress, 'message sender must be controllerAddress');
        uint32 updateEra = currentEra() + 2;
        _updateRaffles();
        Raffle storage raffle = raffles[updateEra];
        // Check input off-chain hash matches hash commited
        require(commitSlot[slot].offChainHash == input[4],
            'hash off chain input does not match hash commited');
        // Check that operator has committed data
        require(commitSlot[slot].committed == true, 'There is no committed data');
        rollupInterface.forgeBatch(op.beneficiaryAddress, proofA, proofB, proofC, input);
        // update previous hash committed by the operator
        op.rndHash = commitSlot[slot].previousHash;
        // clear committed data
        commitSlot[slot].committed = false;
        // one block has been forged in this slot
        fullFilled[slot] = true;
        raffle.seedRnd = bytes8(keccak256(abi.encodePacked(raffle.seedRnd, op.rndHash)));
    }

    function commitAndForge(
        bytes32 previousRndHash,
        bytes calldata compressedTx,
        uint[2] calldata proofA,
        uint[2][2] calldata proofB,
        uint[2] calldata proofC,
        uint[8] calldata input
    ) external {
        commitBatch(previousRndHash, compressedTx);
        forgeCommittedBatch(proofA, proofB, proofC, input);
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