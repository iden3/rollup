pragma solidity ^0.5.1;

contract RollupPoS {

    uint32 constant BLOCKS_PER_SLOT = 100;
    uint32 constant SLOTS_PER_ERA = 20;
    uint constant MIN_STAKE = 10 ether; // Minimum stake to enter the raffle

    uint public genesisBlock;
    uint32 lastInitializedRaffle;

    struct Operator {
        uint128 amountStaked;
        uint32 unlockEra;
        address controllerAddress;
        address payable beneficiaryAddress;
        bytes32 rndHash;
    }

    // This structure should feed im a songle 256bit word
    struct IntermediateNode {
        uint32 era;             // Updates on the same era, are not keeped
        uint64 threashold;
        uint64 increment;
        bool isOpLeft;          // true if left is an index of an op. false if it's a node
        uint32 left;
        bool isOpRight;         // true if left is an index of an op. false if it's a node
        uint32 right;
    }

    struct Raffle {
        uint32 era;
        uint32 root;
        uint64 historicStake;
        uint64 activeStake;
        bytes8 seedRnd;
    }

    Operator[] operators;
    IntermediateNode[] nodes;

    mapping (uint32 => Raffle) raffles;
    mapping (uint32 =>  bool) fullFilled;

    constructor() public {
        genesisBlock = getBlockNumber() + 1000;

        // Initialize first raffle
        raffles[0] = Raffle(
            0,
            0,
            0,
            0,
            bytes8(keccak256(abi.encodePacked(blockhash(getBlockNumber()))))
        );

    }

    function getBlockNumber() public view returns (uint) {
        return block.number;
    }

    // log2
    function _log2(uint32 n) private pure returns (uint32) {
        uint32 level = 0;
        uint32 rem = n;
        while (rem > 1) {
            rem = rem >> 1;
            level++;
        }
        return level;
    }

    function effectiveStake(uint stake) public pure returns (uint64) {
        return uint64((stake*stake*0x10000000000000000) / (200000000 ether * 200000000 ether));
    }

    function block2era(uint bn) public view returns (uint32) {
        if (bn<genesisBlock) return 0;
        return uint32((bn - genesisBlock) / (BLOCKS_PER_SLOT*SLOTS_PER_ERA));
    }

    function block2slot(uint bn) public view returns (uint32) {
        if (bn<genesisBlock) return 0;
        return uint32((bn - genesisBlock) / (BLOCKS_PER_SLOT));
    }

    function currentEra() public view returns (uint32) {
        return block2era(getBlockNumber());
    }

    function currentSlot() public view returns (uint32) {
        return block2slot(getBlockNumber());
    }

    function _updateRaffles() private {
        uint32 ce = currentEra();
        // Shorcut
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

    function doAddStaker(address controllerAddress, address payable beneficiaryAddress, bytes32 rndHash, uint128 value) private returns(uint) {
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
        raffle.seedRnd = bytes8(keccak256(abi.encodePacked(raffle.seedRnd, rndHash)));
        return idOp;
    }

    function addStaker(bytes32 rndHash) external payable returns(uint) {
        require(msg.value >= MIN_STAKE, 'Ether send not enough to enter raffle');
        return doAddStaker(msg.sender, msg.sender, rndHash, uint128(msg.value));
    }

    function addStakerWithDifferentBeneficiary(address payable beneficiaryAddress, bytes32 rndHash) external payable returns(uint) {
        require(msg.value >= MIN_STAKE, 'Ether send not enough to enter raffle');
        return doAddStaker(msg.sender, beneficiaryAddress, rndHash, uint128(msg.value));
    }

    function addStakerRly(address controllerAddress, address payable beneficiaryAddress, bytes32 rndHash) external payable returns(uint) {

        /* Add a third party staker, do not need signature */
        require(msg.value >= MIN_STAKE, 'Ether send not enough to enter raffle');
        return doAddStaker(controllerAddress, beneficiaryAddress, rndHash, uint128(msg.value));
    }

    function _removeFromNode(Raffle storage raffle, uint32 n, uint32 opId, uint32 level, uint64 eStake) private {
        IntermediateNode storage N = nodes[n];
        if (opId & (uint32(1) << level) == 0) {
            if (!N.isOpLeft) _removeFromNode(raffle, N.left, opId, level-1, eStake);
            if (N.era == raffle.era) {
                N.threashold -= eStake;
                N.increment += eStake;
            } else {
                nodes.push(IntermediateNode(
                    raffle.era,
                    N.threashold - eStake,
                    N.increment + eStake,
                    N.isOpLeft,
                    N.left,
                    N.isOpRight,
                    N.right
                ));
            }
        } else {
            uint32 tmpLevel = level;
            while (operators.length & (uint32(1) << (tmpLevel - 1)) == 0) tmpLevel--;
            if (!N.isOpRight) _removeFromNode(raffle, N.right, opId, tmpLevel-1, eStake);
        }
    }

    function doRemove(uint32 opId) private {
        require(opId < operators.length, 'Operator does not exist');

        Operator storage op = operators[opId];
        uint32 updateEra = currentEra() + 2;
        uint64 eStake = effectiveStake(op.amountStaked);
        require(op.unlockEra == 0, 'Operator has been already removed');
        op.unlockEra = updateEra;

        _updateRaffles();
        Raffle storage raffle = raffles[updateEra];

        uint32 level = _log2(uint32(operators.length));
        if (operators.length>1) {
            _removeFromNode(raffle, raffle.root, opId, level, eStake);
        }
        raffle.activeStake -= eStake;
    }

    function remove(uint32 opId) external {
        Operator storage op = operators[opId];
        require(msg.sender == op.controllerAddress, 'Sender does not match with operator controller');
        doRemove(opId);
    }

    function removeRly(uint32 opId, bytes32 r, bytes32 s, uint8 v) external {
        Operator storage op = operators[opId];
        bytes32 h = keccak256(abi.encodePacked("RollupPoS", "remove", opId));
        assert(ecrecover(h, v, r, s) == op.controllerAddress);
        doRemove(opId);
    }

    function withdraw(uint32 opId) external {
        Operator storage op = operators[opId];
        require(op.unlockEra > 0, 'Era to withdraw has not been set yet');
        require(op.unlockEra <= currentEra(), 'Era to withdraw after current era');
        uint amount = op.amountStaked;
        require(amount > 0, 'Amount to return must be greater than 0');
        op.amountStaked = 0;
        op.beneficiaryAddress.transfer(amount);
    }


    function nodeRaffle(uint32 n, uint64 rnd) public view returns(uint32 winner) {
        IntermediateNode storage N = nodes[n];

        if ( rnd < N.threashold ) {
            if (N.isOpLeft) {
                winner = N.left;
            } else {
                winner = nodeRaffle(N.left, rnd);
            }
        } else {
            if (N.isOpRight) {
                winner = N.right;
            } else {
                winner = nodeRaffle(N.right, rnd+N.increment);
            }
        }
    }

    function getRaffleWinner(uint32 slot) public view returns (uint32 winner) {

        // No negative era
        uint32 era = slot / SLOTS_PER_ERA;

        // Only accepr raffle for present and past eras
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
        require(raffle.activeStake>0, "Must be stakers");

        // If only one staker, just return it
        if (operators.length == 1) return 0;

        // Do the raffle.
        uint64 rnd = uint64(uint(keccak256(abi.encodePacked(raffle.seedRnd, slot))) % raffle.activeStake);
        winner = nodeRaffle(raffle.root, rnd);
    }

    function slash(uint32 slot) external {
        require(slot < currentSlot(), 'Slot requested still does not exist');
        require(fullFilled[slot] == false, 'Batch has been forged during this slot');

        uint32 opId = getRaffleWinner(slot);
        Operator storage op = operators[opId];

        uint reward = op.amountStaked / 10;
        uint burned = op.amountStaked - reward;

        doRemove(opId);
        op.amountStaked = 0;

        (address)(0).transfer(burned);
        msg.sender.transfer(reward);
    }

    function forgeBlock(
        bytes32 previousRndHash,
        uint oldStateRoot,
        uint newStateRoot,
        uint exitRoot,
        uint[2] calldata feePlan,
        uint nTxPerToken,
        uint[2] calldata proofA,
        uint[2][2] calldata proofB,
        uint[2] calldata proofC,
        bytes calldata compressedOffchainData
    ) external {
        uint32 slot = currentSlot();
        uint opId = getRaffleWinner(slot);
        Operator storage op = operators[opId];
        require(keccak256(abi.encodePacked(previousRndHash)) == op.rndHash, 'hash revelead not match current commited hash');
        op.rndHash = previousRndHash;
        // TODO:
        // Call Rollup `forge batch` with beneficiary address --> op.beneficiaryAddress
        fullFilled[slot] = true;
    }
}
