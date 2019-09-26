/* eslint-disable no-underscore-dangle */
/* global artifacts */
/* global contract */
/* global web3 */
/* global BigInt */

const chai = require("chai");
const RollupTree = require("../../rollup-utils/rollup-tree");
const rollupUtils = require("../../rollup-utils/rollup-utils.js");
const utils = require("../../rollup-utils/utils.js");

const { expect } = chai;
const poseidonUnit = require("../../node_modules/circomlib/src/poseidon_gencontract.js");

const TokenRollup = artifacts.require("../contracts/test/TokenRollup");
const Verifier = artifacts.require("../contracts/test/VerifierHelper");
const StakerManager = artifacts.require("../contracts/RollupPoS");
const RollupTest = artifacts.require("../contracts/test/RollupTest");

contract("Rollup", (accounts) => {
    let balanceTree;
    let fillingOnChainTest;
    let minningOnChainTest;

    let insPoseidonUnit;
    let insTokenRollup;
    let insStakerManager;
    let insRollupTest;
    let insVerifier;

    // BabyJub public key
    const Ax = BigInt(30890499764467592830739030727222305800976141688008169211302);
    const Ay = BigInt(19826930437678088398923647454327426275321075228766562806246);

    // tokenRollup initial amount
    const tokenInitialAmount = 100;

    const {
        0: owner,
        1: id1,
        2: withdrawAddress,
        3: tokenList,
        4: beneficiary,
        5: onAddress,
    } = accounts;

    before(async () => {
        // Deploy poseidon
        const C = new web3.eth.Contract(poseidonUnit.abi);
        insPoseidonUnit = await C.deploy({ data: poseidonUnit.createCode() })
            .send({ gas: 2500000, from: owner });

        // Deploy TokenRollup
        insTokenRollup = await TokenRollup.new(id1, tokenInitialAmount);

        // Deploy Verifier
        insVerifier = await Verifier.new();

        // Deploy Rollup test
        insRollupTest = await RollupTest.new(insVerifier.address, insPoseidonUnit._address);

        // Deploy Staker manager
        insStakerManager = await StakerManager.new(insRollupTest.address);
    });

    it("Load forge batch mechanism", async () => {
        await insRollupTest.loadForgeBatchMechanism(insStakerManager.address);
        try {
            await insRollupTest.loadForgeBatchMechanism(insStakerManager.address, { from: id1 });
        } catch (error) {
            expect((error.message).includes("caller is not the owner")).to.be.equal(true);
        }
    });

    it("Distribute token rollup", async () => {
        await insTokenRollup.transfer(onAddress, 50, { from: id1 });
    });

    it("Rollup token listing", async () => {
    // Check balances token
        const resOwner = await insTokenRollup.balanceOf(owner);
        const resId1 = await insTokenRollup.balanceOf(id1);
        expect(resOwner.toString()).to.be.equal("0");
        expect(resId1.toString()).to.be.equal("50");

        // Add token to rollup token list
        const resAddToken = await insRollupTest.addToken(insTokenRollup.address,
            { from: tokenList, value: web3.utils.toWei("1", "ether") });

        expect(resAddToken.logs[0].event).to.be.equal("AddToken");
        expect(resAddToken.logs[0].args.tokenAddress).to.be.equal(insTokenRollup.address);
        expect(resAddToken.logs[0].args.tokenId.toString()).to.be.equal("0");
    });

    it("Check token address", async () => {
    // Check token address
        const resTokenAddress = await insRollupTest.getTokenAddress(0);
        expect(resTokenAddress).to.be.equal(insTokenRollup.address);
    });

    it("Deposit balance tree", async () => {
    // Steps:
    // - Transaction to deposit 'TokenRollup' from 'id1' to 'rollup smart contract'(owner)
    // - Check 'tokenRollup' balances
    // - Get event data
    // - Add leaf to balance tree
    // - Check 'filling on-chain' hash

        const depositAmount = 10;
        const tokenId = 0;

        const resApprove = await insTokenRollup.approve(insRollupTest.address, depositAmount, { from: id1 });
        expect(resApprove.logs[0].event).to.be.equal("Approval");

        const resDeposit = await insRollupTest.deposit(depositAmount, tokenId, [Ax.toString(), Ay.toString()],
            withdrawAddress, { from: id1, value: web3.utils.toWei("1", "ether") });
        expect(resDeposit.logs[0].event).to.be.equal("Deposit");

        // Check token balances for id1 and rollup smart contract
        const resRollup = await insTokenRollup.balanceOf(insRollupTest.address);
        const resId1 = await insTokenRollup.balanceOf(id1);
        expect(resRollup.toString()).to.be.equal("10");
        expect(resId1.toString()).to.be.equal("40");

        // Get event 'Deposit' data
        const resId = BigInt(resDeposit.logs[0].args.idBalanceTree);
        const resDepositAmount = BigInt(resDeposit.logs[0].args.depositAmount);
        const resTokenId = BigInt(resDeposit.logs[0].args.tokenId);
        const resAx = BigInt(resDeposit.logs[0].args.Ax);
        const resAy = BigInt(resDeposit.logs[0].args.Ay);
        const resWithdrawAddress = BigInt(resDeposit.logs[0].args.withdrawAddress);

        // create balance tree and add leaf
        balanceTree = await RollupTree.newMemRollupTree();
        await balanceTree.addId(resId, resDepositAmount,
            resTokenId, resAx, resAy, resWithdrawAddress, BigInt(0));

        // Calculate Deposit hash given the events triggered
        const calcFilling = rollupUtils.hashDeposit(resId, resDepositAmount, resTokenId, resAx,
            resAy, resWithdrawAddress, BigInt(0));

        // calculate filling on chain hash by the operator
        let fillingOnChainTxsHash = BigInt(0);
        fillingOnChainTxsHash = utils.hash([fillingOnChainTxsHash, calcFilling]);

        const resFillingTest = await insRollupTest.getFillingOnChainTxsHash();
        expect(fillingOnChainTxsHash.toString()).to.be.equal(BigInt(resFillingTest).toString());

        // Update on-chain hashes
        fillingOnChainTest = BigInt(resFillingTest).toString();
        minningOnChainTest = 0;
    });

    it("Forge genesis batch", async () => {
    // Forge first batch implies not balance tree state change at all
    // it forces the next batch to incorporate on-chain transactions
    // i.e. transaction that has been done in previous step
        const oldStateRoot = BigInt(0).toString();
        const newStateRoot = BigInt(0).toString();
        const newExitRoot = BigInt(0).toString();
        const onChainHash = BigInt(0).toString();
        const feePlan = [BigInt(0).toString(), BigInt(0).toString()];

        const offChainTx = rollupUtils.createOffChainTx(1);
        const offChainHash = offChainTx.hashOffChain.toString();
        const compressedTxs = offChainTx.bytesTx;

        const nTxPerToken = BigInt(0).toString();

        const resForge = await insRollupTest.forgeBatchTest(oldStateRoot, newStateRoot, newExitRoot,
            onChainHash, feePlan, compressedTxs, offChainHash, nTxPerToken, beneficiary);

        expect(resForge.logs[0].event).to.be.equal("ForgeBatch");
        expect(resForge.logs[0].args.batchNumber.toString()).to.be.equal("0");
        expect(resForge.logs[0].args.offChainTx).to.be.equal(compressedTxs);

        // Update on-chain hashes
        minningOnChainTest = fillingOnChainTest;
        fillingOnChainTest = BigInt(0).toString();

        // Check minning / filling on-chain hash
        const resMinning = await insRollupTest.getMinningOnChainTxsHash();
        const resFilling = await insRollupTest.getFillingOnChainTxsHash();

        expect(minningOnChainTest).to.be.equal(BigInt(resMinning).toString());
        expect(fillingOnChainTest).to.be.equal(BigInt(resFilling).toString());

        // Check last state root forged
        const resState = await insRollupTest.getStateRoot("0");
        expect(BigInt(resState).toString()).to.be.equal("0");
    });

    it("Forge batch deposit", async () => {
    // Operator must introduce a new leaf into the balance tree which
    // comes from the first deposit on-chain transaction
    // It implies that the balance tree has now one leaf, therefore its
    // root must be updated

        const oldStateRoot = BigInt(0).toString();
        let newStateRoot = await balanceTree.getRoot();
        newStateRoot = newStateRoot.toString();
        const newExitRoot = BigInt(0).toString(); // Assume no off-chain tx
        const onChainHash = minningOnChainTest;
        const feePlan = [BigInt(0).toString(), BigInt(0).toString()];

        const offChainTx = rollupUtils.createOffChainTx(1);
        const offChainHash = offChainTx.hashOffChain.toString();
        const compressedTxs = offChainTx.bytesTx;

        const nTxPerToken = BigInt(0).toString();

        const resForge = await insRollupTest.forgeBatchTest(oldStateRoot, newStateRoot, newExitRoot,
            onChainHash, feePlan, compressedTxs, offChainHash, nTxPerToken, beneficiary);

        expect(resForge.logs[0].event).to.be.equal("ForgeBatch");
        expect(resForge.logs[0].args.batchNumber.toString()).to.be.equal("1");
        expect(resForge.logs[0].args.offChainTx).to.be.equal(compressedTxs);

        // Update on-chain hashes
        // eslint-disable-next-line require-atomic-updates
        minningOnChainTest = BigInt(0).toString();
        fillingOnChainTest = BigInt(0).toString();

        // Check minning / filling on-chain hash
        const resMinning = await insRollupTest.getMinningOnChainTxsHash();
        const resFilling = await insRollupTest.getFillingOnChainTxsHash();

        expect(minningOnChainTest).to.be.equal(BigInt(resMinning).toString());
        expect(fillingOnChainTest).to.be.equal(BigInt(resFilling).toString());

        // Check last state root forged
        const resState = await insRollupTest.getStateRoot("1");
        expect(BigInt(resState).toString()).to.be.equal(newStateRoot);
    });

    it("Deposit on top", async () => {
    // Deposit on top on-chain transaction is submitted
    // It will be forged two blocks forward
    // We will check balances of all address involved
    // Approve rollup smart contract to spend 'onAddress' tokens

        // To make a deposit on top we have to prove:
        // - An id exist on the balance tree with a given tokenId in any batch
        // - in order to do so, we have to submit the merkle tree proof

        // get merkle tree proof from balance tree
        const id = BigInt(1);
        const proofId = await balanceTree.getIdInfo(id);
        const siblingsId = utils.arrayBigIntToArrayStr(proofId.siblings);

        const stateRoot = BigInt("1");
        const amountToDeposit = BigInt("25");

        const resApprove = await insTokenRollup.approve(insRollupTest.address, amountToDeposit.toString(),
            { from: onAddress });
        expect(resApprove.logs[0].event).to.be.equal("Approval");


        const resDepositOnTop = await insRollupTest.depositOnTop(
            id.toString(),
            proofId.foundObject.balance.toString(),
            proofId.foundObject.tokenId.toString(),
            `0x${proofId.foundObject.withdrawAddress.toString("16")}`,
            proofId.foundObject.nonce.toString(),
            [proofId.foundObject.Ax.toString(), proofId.foundObject.Ay.toString()],
            siblingsId,
            stateRoot.toString(),
            amountToDeposit.toString(),
            { from: onAddress, value: web3.utils.toWei("1", "ether") },
        );

        expect(resDepositOnTop.logs[0].event).to.be.equal("DepositOnTop");

        // Check balances tokens
        const resRollup = await insTokenRollup.balanceOf(insRollupTest.address);
        const resId1 = await insTokenRollup.balanceOf(id1);
        const resOnTop = await insTokenRollup.balanceOf(onAddress);

        expect(resRollup.toString()).to.be.equal("35");
        expect(resId1.toString()).to.be.equal("40");
        expect(resOnTop.toString()).to.be.equal("25");
    });

    it("Forge batches deposit on top", async () => {
    // Forge first batch implies not balance tree state change at all
    // it only updates fillingOnChainTx to force insert previous 'depostOnTop' Tx
    // we update second batch including deposit on top on blance tree
        let lastIndexStateRoot = await insRollupTest.getStateDepth();
        lastIndexStateRoot = BigInt(lastIndexStateRoot) - BigInt(1);
        const oldStateRoot = await insRollupTest.getStateRoot(lastIndexStateRoot.toString());
        let newStateRoot = oldStateRoot;
        const newExitRoot = BigInt(0).toString();
        const onChainHash = BigInt(0).toString();
        const feePlan = [BigInt(0).toString(), BigInt(0).toString()];

        const offChainTx = rollupUtils.createOffChainTx(1);
        const offChainHash = offChainTx.hashOffChain.toString();
        const compressedTxs = offChainTx.bytesTx;

        const nTxPerToken = BigInt(0).toString();

        const resForge = await insRollupTest.forgeBatchTest(oldStateRoot, newStateRoot, newExitRoot,
            onChainHash, feePlan, compressedTxs, offChainHash, nTxPerToken, beneficiary);

        expect(resForge.logs[0].event).to.be.equal("ForgeBatch");
        expect(resForge.logs[0].args.batchNumber.toString()).to.be.equal("2");
        expect(resForge.logs[0].args.offChainTx).to.be.equal(compressedTxs);

        // Update on-chain hashes
        minningOnChainTest = await insRollupTest.getMinningOnChainTxsHash();
        fillingOnChainTest = BigInt(0).toString();

        // Calculate fillingOnChainHash
        let resLeafValue = await balanceTree.getIdInfo(BigInt(1));
        resLeafValue = resLeafValue.foundValue.toString();
        // calculate filling on chain hash by the operator
        let onChainHashOp = BigInt(0);
        onChainHashOp = utils.hash([onChainHash, resLeafValue]);

        expect(onChainHashOp.toString()).to.be.equal(BigInt(minningOnChainTest).toString());

        // Update balance tree with 'deposit on top' transaction
        await balanceTree.updateId(BigInt(1), BigInt(35));
        newStateRoot = await balanceTree.getRoot();
        newStateRoot = newStateRoot.toString();
        const resForge2 = await insRollupTest.forgeBatchTest(oldStateRoot, newStateRoot,
            newExitRoot, onChainHashOp.toString(), feePlan, compressedTxs, offChainHash, nTxPerToken, beneficiary);

        expect(resForge2.logs[0].event).to.be.equal("ForgeBatch");
        expect(resForge2.logs[0].args.batchNumber.toString()).to.be.equal("3");
    });

    it("Force full withdraw", async () => {
    // Force full balance withdraw
    // In order to do force withdraw, the user must prove:
    // - a leaf exist on the balance tree given the last root
    // - function must be called from 'withdraw address' which is included in the balance tree leaf

        // get merkle tree proof from balance tree
        const id = BigInt(1);
        const proofId = await balanceTree.getIdInfo(id);
        const siblingsId = utils.arrayBigIntToArrayStr(proofId.siblings);

        const resForceFullWithdraw = await insRollupTest.forceFullWithdraw(
            id.toString(),
            proofId.foundObject.balance.toString(),
            proofId.foundObject.tokenId.toString(),
            proofId.foundObject.nonce.toString(),
            [proofId.foundObject.Ax.toString(), proofId.foundObject.Ay.toString()],
            siblingsId,
            { from: withdrawAddress, value: web3.utils.toWei("1", "ether") },
        );

        expect(resForceFullWithdraw.logs[0].event).to.be.equal("ForceFullWithdraw");

        // Check balances tokens
        const resRollup = await insTokenRollup.balanceOf(insRollupTest.address);
        const resId1 = await insTokenRollup.balanceOf(id1);
        const resOnTop = await insTokenRollup.balanceOf(onAddress);
        const resWithdraw = await insTokenRollup.balanceOf(withdrawAddress);

        expect(resRollup.toString()).to.be.equal("0");
        expect(resId1.toString()).to.be.equal("40");
        expect(resOnTop.toString()).to.be.equal("25");
        expect(resWithdraw.toString()).to.be.equal("35");
    });

    it("Forge batches force full withdraw", async () => {
    // Forge first batch implies not balance tree state change at all
    // it only updates fillingOnChainTx to force insert previous 'forceFullWithdraw' Tx
    // we update second batch including force full withdraw on balance tree
        let lastIndexStateRoot = await insRollupTest.getStateDepth();
        lastIndexStateRoot = BigInt(lastIndexStateRoot) - BigInt(1);
        const oldStateRoot = await insRollupTest.getStateRoot(lastIndexStateRoot.toString());
        let newStateRoot = oldStateRoot;
        const newExitRoot = BigInt(0).toString();
        const onChainHash = BigInt(0).toString();
        const feePlan = [BigInt(0).toString(), BigInt(0).toString()];

        const offChainTx = rollupUtils.createOffChainTx(1);
        const offChainHash = offChainTx.hashOffChain.toString();
        const compressedTxs = offChainTx.bytesTx;

        const nTxPerToken = BigInt(0).toString();

        const resForge = await insRollupTest.forgeBatchTest(oldStateRoot, newStateRoot, newExitRoot,
            onChainHash, feePlan, compressedTxs, offChainHash, nTxPerToken, beneficiary);

        expect(resForge.logs[0].event).to.be.equal("ForgeBatch");
        expect(resForge.logs[0].args.batchNumber.toString()).to.be.equal("4");
        expect(resForge.logs[0].args.offChainTx).to.be.equal(compressedTxs);

        // Update on-chain hashes
        minningOnChainTest = await insRollupTest.getMinningOnChainTxsHash();
        fillingOnChainTest = BigInt(0).toString();

        // Calculate fillingOnChainHash
        let resLeafValue = await balanceTree.getIdInfo(BigInt(1));
        resLeafValue = resLeafValue.foundValue.toString();
        // calculate filling on chain hash by the operator
        let onChainHashOp = BigInt(0);
        onChainHashOp = utils.hash([onChainHash, resLeafValue]);

        expect(onChainHashOp.toString()).to.be.equal(BigInt(minningOnChainTest).toString());

        // Update balance tree with 'deposit on top' transaction
        await balanceTree.updateId(BigInt(1), BigInt(35));
        newStateRoot = await balanceTree.getRoot();
        newStateRoot = newStateRoot.toString();
        const resForge2 = await insRollupTest.forgeBatchTest(oldStateRoot, newStateRoot,
            newExitRoot, onChainHashOp.toString(), feePlan, compressedTxs, offChainHash, nTxPerToken, beneficiary);

        expect(resForge2.logs[0].event).to.be.equal("ForgeBatch");
        expect(resForge2.logs[0].args.batchNumber.toString()).to.be.equal("5");
    });
});
