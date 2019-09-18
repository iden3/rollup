/* global artifacts */
/* global contract */

const chai = require("chai");

const { expect } = chai;
const TokenRollup = artifacts.require("../contracts/test/TokenRollup");

contract("Token Rollup", (accounts) => {
    const {
        0: owner,
        1: id1,
        2: id2,
    } = accounts;

    const initialAmount = 100;
    let insTokenRollup;

    before(async () => {
    // Deploy token test
        insTokenRollup = await TokenRollup.new(owner, initialAmount);
    });

    it("check balance", async () => {
        const resOwner = await insTokenRollup.balanceOf(owner);
        expect(resOwner.toString()).to.be.equal(initialAmount.toString());

        const resId1 = await insTokenRollup.balanceOf(id1);
        expect(resId1.toString()).to.be.equal("0");
    });

    it("transfer", async () => {
        const res = await insTokenRollup.transfer(id1, 25, { from: owner });
        expect(res.logs[0].event).to.be.equal("Transfer");
        expect(res.logs[0].args.from).to.be.equal(owner);
        expect(res.logs[0].args.to).to.be.equal(id1);
        expect(res.logs[0].args.value.toString()).to.be.equal("25");

        const resOwner = await insTokenRollup.balanceOf(owner);
        const resId1 = await insTokenRollup.balanceOf(id1);
        expect(resOwner.toString()).to.be.equal("75");
        expect(resId1.toString()).to.be.equal("25");
    });

    it("delegate", async () => {
    // id1 approve id2 to make a transfer for him for 10 units
        const resApprove = await insTokenRollup.approve(id2, 10, { from: id1 });
        expect(resApprove.logs[0].event).to.be.equal("Approval");
        expect(resApprove.logs[0].args.owner).to.be.equal(id1);
        expect(resApprove.logs[0].args.spender).to.be.equal(id2);
        expect(resApprove.logs[0].args.value.toString()).to.be.equal("10");

        // id2 spends 10 units of id1 to owner account
        const resTransferFrom = await insTokenRollup.transferFrom(id1, owner, 10, { from: id2 });
        expect(resTransferFrom.logs[0].event).to.be.equal("Transfer");
        expect(resTransferFrom.logs[0].args.from).to.be.equal(id1);
        expect(resTransferFrom.logs[0].args.to).to.be.equal(owner);
        expect(resTransferFrom.logs[0].args.value.toString()).to.be.equal("10");

        expect(resTransferFrom.logs[1].event).to.be.equal("Approval");
        expect(resTransferFrom.logs[1].args.owner).to.be.equal(id1);
        expect(resTransferFrom.logs[1].args.spender).to.be.equal(id2);
        expect(resTransferFrom.logs[1].args.value.toString()).to.be.equal("0");

        // Check balances
        const resOwner = await insTokenRollup.balanceOf(owner);
        const resId1 = await insTokenRollup.balanceOf(id1);
        const resId2 = await insTokenRollup.balanceOf(id2);

        expect(resOwner.toString()).to.be.equal("85");
        expect(resId1.toString()).to.be.equal("15");
        expect(resId2.toString()).to.be.equal("0");
    });
});
