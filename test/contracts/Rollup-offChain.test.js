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
    let exitTree;
    let tokenId;

    let insPoseidonUnit;
    let insTokenRollup;
    let insStakerManager;
    let insRollupTest;
    let insVerifier;

    // BabyJub public key
    const Ax = BigInt(30890499764467592830739030727222305800976141688008169211302);
    const Ay = BigInt(19826930437678088398923647454327426275321075228766562806246);

    // tokenRollup initial amount
    const tokenInitialAmount = 50;

    const {
        0: owner,
        1: id1,
        2: id2,
        3: id3,
        4: id4,
        5: id5,
        6: withdraw1,
        7: withdraw2,
        8: withdraw3,
        9: withdraw4,
        10: withdraw5,
        11: tokenList,
        12: beneficiary,
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

        // Init balance tree
        balanceTree = await RollupTree.newMemRollupTree();

        // Init exitTree
        exitTree = await RollupTree.newMemRollupTree();
    });

    it("Check ganache provider", async () => {
        if (accounts.length < 12) {
            throw new Error("launch ganache with more than 12 accounts:\n\n `ganache-cli -a 20`");
        }
    });

    it("Load forge batch mechanism", async () => {
        await insRollupTest.loadForgeBatchMechanism(insStakerManager.address);
        try {
            await insRollupTest.loadForgeBatchMechanism(insStakerManager.address, { from: id1 });
        } catch (error) {
            expect((error.message).includes("caller is not the owner")).to.be.equal(true);
        }
    });

    it("Distribute token rollup & token listing", async () => {
        await insTokenRollup.transfer(id2, 10, { from: id1 });
        await insTokenRollup.transfer(id3, 10, { from: id1 });
        await insTokenRollup.transfer(id4, 10, { from: id1 });
        await insTokenRollup.transfer(id5, 10, { from: id1 });

        const resAddToken = await insRollupTest.addToken(insTokenRollup.address,
            { from: tokenList, value: web3.utils.toWei("1", "ether") });
        tokenId = BigInt(resAddToken.logs[0].args.tokenId);
    });

    it("Deposit on-chain & genesis batch", async () => {
        await insTokenRollup.approve(insRollupTest.address, "10", { from: id1 });
        await insTokenRollup.approve(insRollupTest.address, "10", { from: id2 });
        await insTokenRollup.approve(insRollupTest.address, "10", { from: id3 });
        await insTokenRollup.approve(insRollupTest.address, "10", { from: id4 });
        await insTokenRollup.approve(insRollupTest.address, "10", { from: id5 });

        await insRollupTest.deposit("10", tokenId.toString(), [Ax.toString(), Ay.toString()],
            withdraw1, { from: id1, value: web3.utils.toWei("1", "ether") });
        await insRollupTest.deposit("10", tokenId.toString(), [Ax.toString(), Ay.toString()],
            withdraw2, { from: id2, value: web3.utils.toWei("1", "ether") });
        await insRollupTest.deposit("10", tokenId.toString(), [Ax.toString(), Ay.toString()],
            withdraw3, { from: id3, value: web3.utils.toWei("1", "ether") });
        await insRollupTest.deposit("10", tokenId.toString(), [Ax.toString(), Ay.toString()],
            withdraw4, { from: id4, value: web3.utils.toWei("1", "ether") });
        await insRollupTest.deposit("10", tokenId.toString(), [Ax.toString(), Ay.toString()],
            withdraw5, { from: id5, value: web3.utils.toWei("1", "ether") });

        const oldStateRoot = BigInt(0).toString();
        const newStateRoot = BigInt(0).toString();
        const newExitRoot = BigInt(0).toString();
        const onChainHash = BigInt(0).toString();
        const feePlan = [BigInt(0).toString(), BigInt(0).toString()];
        const offChainTx = rollupUtils.createOffChainTx(1);
        const offChainHash = offChainTx.hashOffChain.toString();
        const compressedTxs = offChainTx.bytesTx;
        const nTxPerToken = BigInt(0).toString();
        await insRollupTest.forgeBatchTest(oldStateRoot, newStateRoot, newExitRoot,
            onChainHash, feePlan, compressedTxs, offChainHash, nTxPerToken, beneficiary);
    });

    it("Add deposits on balance tree & forge batch", async () => {
        let idAdd = BigInt(1);
        const amount = BigInt(10);
        await balanceTree.addId(idAdd, amount, tokenId, Ax, Ay, BigInt(withdraw1), "0",
            { from: id1, value: web3.utils.toWei("1", "ether") });
        idAdd = BigInt(2);
        await balanceTree.addId(idAdd, amount, tokenId, Ax, Ay, BigInt(withdraw2), "0",
            { from: id2, value: web3.utils.toWei("1", "ether") });
        idAdd = BigInt(3);
        await balanceTree.addId(idAdd, amount, tokenId, Ax, Ay, BigInt(withdraw3), "0",
            { from: id3, value: web3.utils.toWei("1", "ether") });
        idAdd = BigInt(4);
        await balanceTree.addId(idAdd, amount, tokenId, Ax, Ay, BigInt(withdraw4), "0",
            { from: id4, value: web3.utils.toWei("1", "ether") });
        idAdd = BigInt(5);
        await balanceTree.addId(idAdd, amount, tokenId, Ax, Ay, BigInt(withdraw5), "0",
            { from: id5, value: web3.utils.toWei("1", "ether") });

        // Calc miningHash
        let minigHash = BigInt(0);
        let tmpHash;
        const idArray = [BigInt(1), BigInt(2), BigInt(3), BigInt(4), BigInt(5)];
        const withdrawArray = [BigInt(withdraw1), BigInt(withdraw2), BigInt(withdraw3),
            BigInt(withdraw4), BigInt(withdraw5)];
        for (let i = 0; i < 5; i++) {
            tmpHash = rollupUtils.hashDeposit(idArray[i], BigInt(10), tokenId, Ax, Ay, withdrawArray[i], 0);
            minigHash = utils.hash([minigHash, tmpHash]);
        }
        const resMiningTest = await insRollupTest.getMinningOnChainTxsHash();
        expect(minigHash.toString()).to.be.equal(BigInt(resMiningTest).toString());

        // Forge batch
        const oldStateRoot = BigInt(0).toString();
        let newStateRoot = await balanceTree.getRoot();
        newStateRoot = newStateRoot.toString();
        const newExitRoot = BigInt(0).toString();
        const onChainHash = minigHash.toString();
        const feePlan = [BigInt(0).toString(), BigInt(0).toString()];
        const offChainTx = rollupUtils.createOffChainTx(1);
        const offChainHash = offChainTx.hashOffChain.toString();
        const compressedTxs = offChainTx.bytesTx;
        const nTxPerToken = BigInt(0).toString();
        const resForge = await insRollupTest.forgeBatchTest(oldStateRoot, newStateRoot, newExitRoot,
            onChainHash, feePlan, compressedTxs, offChainHash, nTxPerToken, beneficiary);
        expect(resForge.logs[0].event).to.be.equal("ForgeBatch");
    });

    it("Simulate off chain transaction with fee & forge batch", async () => {
    // Operator has inserted an off-chain transaction
    // in order to forge a block, the operator has to submit:
    // - off-chain tx compressed
    // - new root balance tree

        // Once this batch is submitted, other operators must retrieve data from
        // event generated and update its balance tree

        // Simulate one off-chain tx from id1 to id2 of 4 tokens + 1 fee token
        const offTx = "0x0000010000020004";
        const e1 = BigInt(offTx);
        let hashOffTx = utils.hash([e1]);
        hashOffTx = utils.hash([BigInt(0), hashOffTx]);

        // update balance tree
        await balanceTree.updateId(BigInt(1), BigInt(5));
        await balanceTree.updateId(BigInt(2), BigInt(14));

        // forge batch
        let lastIndexStateRoot = await insRollupTest.getStateDepth();
        lastIndexStateRoot = BigInt(lastIndexStateRoot) - BigInt(1);
        const oldStateRoot = await insRollupTest.getStateRoot(lastIndexStateRoot.toString());
        let newStateRoot = await balanceTree.getRoot();
        newStateRoot = newStateRoot.toString();
        const newExitRoot = BigInt(0).toString();
        const onChainHash = BigInt(0).toString();
        const feePlan = ["0x0000000000000000000000000000000000000000000000000000000000000000", "0x0001000000000000000000000000000000000000000000000000000000000000"];
        const offChainHash = hashOffTx.toString();
        const compressedTxs = offTx;
        const nTxPerToken = "0x0001000000000000000000000000000000000000000000000000000000000000";

        const resForge = await insRollupTest.forgeBatchTest(oldStateRoot, newStateRoot, newExitRoot,
            onChainHash, feePlan, compressedTxs, offChainHash, nTxPerToken, beneficiary);
        expect(resForge.logs[0].event).to.be.equal("ForgeBatch");
        expect(resForge.logs[0].args.offChainTx).to.be.equal(offTx);

        // Verify beneficiary has received the fee
        const resBeneficiary = await insTokenRollup.balanceOf(beneficiary);
        expect(BigInt(resBeneficiary).toString()).to.be.equal("1");
    });

    it("Simulate withdraw off chain transaction & forge batch", async () => {
    // Simulate three withdraw off-chain tx:
    // - from id1, id2 and id3
    // - id1 withdraw 5 tokens
    // - id2 withdraw 10 tokens
    // - id3 withdraw 2 tokens

        // Operator must update last tree root
        // publish root exit tree
        const offTx = "0x0000010000000005000002000000000a0000030000000002";
        const hashOffTx = rollupUtils.hashOffChainTx(offTx);

        // update balance tree
        await balanceTree.updateId(BigInt(1), BigInt(0));
        await balanceTree.updateId(BigInt(2), BigInt(4));
        await balanceTree.updateId(BigInt(3), BigInt(8));

        // build exit tree
        await exitTree.addIdExit(BigInt(1), BigInt(5), tokenId, BigInt(withdraw1));
        await exitTree.addIdExit(BigInt(2), BigInt(10), tokenId, BigInt(withdraw2));
        await exitTree.addIdExit(BigInt(3), BigInt(2), tokenId, BigInt(withdraw3));

        // forge batch
        let lastIndexStateRoot = await insRollupTest.getStateDepth();
        lastIndexStateRoot = BigInt(lastIndexStateRoot) - BigInt(1);
        const oldStateRoot = await insRollupTest.getStateRoot(lastIndexStateRoot.toString());
        let newStateRoot = await balanceTree.getRoot();
        newStateRoot = newStateRoot.toString();
        let newExitRoot = await exitTree.getRoot();
        newExitRoot = newExitRoot.toString();
        const onChainHash = BigInt(0).toString();
        const feePlan = [BigInt(0).toString(), BigInt(0).toString()];
        const offChainHash = hashOffTx.toString();
        const compressedTxs = offTx;
        const nTxPerToken = "0x0003000000000000000000000000000000000000000000000000000000000000";

        const resForge = await insRollupTest.forgeBatchTest(oldStateRoot, newStateRoot, newExitRoot,
            onChainHash, feePlan, compressedTxs, offChainHash, nTxPerToken, beneficiary);
        expect(resForge.logs[0].event).to.be.equal("ForgeBatch");
        expect(resForge.logs[0].args.offChainTx).to.be.equal(offTx);
    });

    it("Withdraw on-chain transaction", async () => {
        let lastExitRoot = await insRollupTest.getStateDepth();
        lastExitRoot = BigInt(lastExitRoot) - BigInt(1);

        let id = BigInt(1).toString();
        let amount = BigInt(5).toString();
        let proofId = await exitTree.getIdInfo(id);
        let siblingsId = utils.arrayBigIntToArrayStr(proofId.siblings);

        // send withdraw transaction id1 from withdraw1
        await insRollupTest.withdraw(id, amount, tokenId.toString(),
            lastExitRoot.toString(), siblingsId, { from: withdraw1 });

        // Try to repeat withdraw
        try {
            await insRollupTest.withdraw(id, amount, tokenId.toString(),
                lastExitRoot.toString(), siblingsId, { from: withdraw1 });
        } catch (error) {
            expect((error.message).includes("withdraw has been already done")).to.be.equal(true);
        }

        // send withdraw id2 & id3
        id = BigInt(2).toString();
        amount = BigInt(10).toString();
        proofId = await exitTree.getIdInfo(id);
        siblingsId = utils.arrayBigIntToArrayStr(proofId.siblings);

        await insRollupTest.withdraw(id, amount, tokenId.toString(),
            lastExitRoot.toString(), siblingsId, { from: withdraw2 });

        id = BigInt(3).toString();
        amount = BigInt(2).toString();
        proofId = await exitTree.getIdInfo(id);
        siblingsId = utils.arrayBigIntToArrayStr(proofId.siblings);

        await insRollupTest.withdraw(id, amount, tokenId.toString(),
            lastExitRoot.toString(), siblingsId, { from: withdraw3 });

        // Check balances
        const resId1 = await insTokenRollup.balanceOf(withdraw1);
        const resId2 = await insTokenRollup.balanceOf(withdraw2);
        const resId3 = await insTokenRollup.balanceOf(withdraw3);
        const resRollup = await insTokenRollup.balanceOf(insRollupTest.address);

        expect(BigInt(resId1).toString()).to.be.equal("5");
        expect(BigInt(resId2).toString()).to.be.equal("10");
        expect(BigInt(resId3).toString()).to.be.equal("2");
        // 50 initial minus withdraws and fees => 50 - 1 - 5 - 10 - 2 = 32
        expect(BigInt(resRollup).toString()).to.be.equal("32");
    });
});
