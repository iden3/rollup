/* global artifacts */
/* global contract */
/* global web3 */

const chai = require("chai");
const { expect } = chai;
const RollupPoB = artifacts.require("../contracts/test/RollupPoBTest");
const RollupDB = require("../../js/rollupdb");
const SMTMemDB = require("circomlib/src/smt_memdb");

const { exitAx, exitAy, exitEthAddr} = require("../../js/constants");
const { BabyJubWallet } = require("../../rollup-utils/babyjub-wallet");
const { getEtherBalance, getPublicPoBVariables } = require("./helpers/helpers");

const abiDecoder = require("abi-decoder");
abiDecoder.addABI(RollupPoB.abi);

contract("RollupPoB", (accounts) => {

    // Definition of some address
    const {
        1: id1,
        6: beneficiaryAddress,
        7: forgerAddress,
        8: withdrawAddress,
        9: bonusAddress,
    } = accounts;

    // definition of variables
    let insRollupPoB;
    let rollupPoBAddress;
    const maxTx = 10;
    const addressRollupTest = "0x0000000000000000000000000000000000000001";
    const burnAddress = "0x0000000000000000000000000000000000000000";
    const url = "localhost";
    const operators = [];
    const slotBlock = [];
    let blocksPerSlot;
    let deadlineBlocks;
    let db;
    let rollupDB;
    let genesisBlock;
    let amountMinBid;
    let amountMinBidEther;

    const wallets = [];
    for (let i = 0; i<10; i++) {
        wallets.push(BabyJubWallet.createRandom());
    }

    before(async () => {
        // Deploy token test
        insRollupPoB = await RollupPoB.new(addressRollupTest, maxTx, burnAddress, accounts[3], url);
        rollupPoBAddress = insRollupPoB.address;
        [blocksPerSlot, amountMinBid, genesisBlock, deadlineBlocks] = await getPublicPoBVariables(insRollupPoB);
        amountMinBidEther = Number(web3.utils.fromWei(amountMinBid, "ether"));
        // definition slots
        for (let i = 0; i < 20; i++) {
            slotBlock.push(i * blocksPerSlot + Number(genesisBlock) + 1);
        }
        // fill 6 addresses for operators
        for (let i = 0; i <= 5; i++) {
            operators.push({ address: accounts[i], idOp: (i).toString() });
        }
        // set first era block
        await insRollupPoB.setBlockNumber(slotBlock[0]);
        // Init rollup Db
        db = new SMTMemDB();
        rollupDB = await RollupDB(db);
    });

    describe("functionalities", () => {
        it("Should init rollup Db with two deposits", async () => {
            const maxTx = 10;
            const nLevels = 24;
            const bb = await rollupDB.buildBatch(maxTx, nLevels);

            bb.addTx({
                fromAx: wallets[1].publicKey[0].toString(16),
                fromAy:  wallets[1].publicKey[1].toString(16),
                fromEthAddr: id1,
                toAx: exitAx,
                toAy: exitAy,
                toEthAddr: exitEthAddr,
                loadAmount: 1000,
                coin: 0,
                onChain: true
            });
    
            bb.addTx({
                fromAx: wallets[2].publicKey[0].toString(16),
                fromAy:  wallets[2].publicKey[1].toString(16),
                fromEthAddr: id1,
                toAx: exitAx,
                toAy: exitAy,
                toEthAddr: exitEthAddr,
                loadAmount: 2000,
                coin: 0,
                onChain: true
            });
            await bb.build();
            await rollupDB.consolidate(bb);
        });

        it("Add Winning Operator", async () => {
            let slot = 3;
            let amount = 5;
            let amountWei = web3.utils.toWei(amount.toString(), "ether");

            // operator makes a bid
            let initBalOp0 = await getEtherBalance(operators[0].address);
            const resBid = await insRollupPoB.bid(slot, url, {
                from: operators[0].address, value: amountMinBid
            });
            let balOp0 = await getEtherBalance(operators[0].address);
            expect(resBid.logs[0].event).to.be.equal("newBestBid");
            expect((initBalOp0 - balOp0).toFixed(1)).to.be.equal(amountMinBidEther.toString());

            // operator overbid
            let initBalOp1 = await getEtherBalance(operators[1].address);
            const resBid2 = await insRollupPoB.bid(slot, url, {
                from: operators[1].address, value: amountWei
            });
            let balOp1 = await getEtherBalance(operators[1].address);
            expect(resBid2.logs[0].event).to.be.equal("newBestBid");
            expect((initBalOp1 - balOp1).toFixed()).to.be.equal(amount.toString());

            // first operator withdraws his amount
            let withdrawBid = await insRollupPoB.withdrawBid(operators[0].address);
            await insRollupPoB.withdraw({from: operators[0].address});
            let balOp0_2 = await getEtherBalance(operators[0].address);
            expect(withdrawBid.toString()).to.be.equal(amountMinBid.toString());
            expect((balOp0_2 - balOp0).toFixed(1)).to.be.equal(amountMinBidEther.toString());

            //check SC balance
            let balContract = await getEtherBalance(rollupPoBAddress);
            expect(balContract).to.be.equal(amountMinBidEther/10);

            // check winner
            let winner = await insRollupPoB.slotWinner(slot);
            expect(winner.forgerAddress).to.be.equal(operators[1].address);
        });

        it("Add Winning Operator and use bonusBalance", async () => {
            let slot = 4;
            let amount = 5;
            let amountWei = web3.utils.toWei(amount.toString(), "ether");            

            // operator makes a bid
            let initBalOp0 = await getEtherBalance(operators[0].address);
            let bonusBalance0 = Number(await insRollupPoB.bonusBalance(operators[0].address));
            let bonusBalance0Ether = Number(web3.utils.fromWei(bonusBalance0.toString(), "ether"));
            const resBid = await insRollupPoB.bid(slot, url, {
                from: operators[0].address, value: amountMinBid
            });
            let balOp0 = await getEtherBalance(operators[0].address);
            expect(resBid.logs[0].event).to.be.equal("newBestBid");
            expect((initBalOp0 - balOp0).toFixed(1)).to.be.equal(amountMinBidEther.toString());

            // operator overbid
            let initBalOp1 = await getEtherBalance(operators[1].address);
            const resBid2 = await insRollupPoB.bid(slot, url, {
                from: operators[1].address, value: amountWei
            });
            let balOp1 = await getEtherBalance(operators[1].address);
            expect(resBid2.logs[0].event).to.be.equal("newBestBid");
            expect((initBalOp1 - balOp1).toFixed()).to.be.equal(amount.toString());

            // first operator withdraws his amount
            let withdrawBid = await insRollupPoB.withdrawBid(operators[0].address);
            let amountTotalBid = Number(amountMinBid) + bonusBalance0;
            expect(withdrawBid.toString()).to.be.equal(amountTotalBid.toString());
            await insRollupPoB.withdraw({from: operators[0].address});
            let balOp0_2 = await getEtherBalance(operators[0].address);
            expect((balOp0_2 - balOp0).toFixed(1)).to.be.equal((amountMinBidEther+ bonusBalance0Ether).toFixed(1));

            // check winner
            let winner = await insRollupPoB.slotWinner(slot);
            expect(winner.forgerAddress).to.be.equal(operators[1].address);
            expect(winner.beneficiaryAddress).to.be.equal(operators[1].address);
            expect(winner.bonusAddress).to.be.equal(operators[1].address);
            expect(winner.withdrawAddress).to.be.equal(operators[1].address);
        });

        it("Add Winning Operator with different Beneficiary", async () => {
            let slot = 5;
            let amount = 5;
            let amountWei = web3.utils.toWei(amount.toString(), "ether");

            // operator makes a bid
            let initBalOp0 = await getEtherBalance(operators[0].address);
            let bonusBalance0 = Number(await insRollupPoB.bonusBalance(operators[0].address));
            let bonusBalance0Ether = Number(web3.utils.fromWei(bonusBalance0.toString(), "ether"));
            const resBid = await insRollupPoB.bid(slot, url, {
                from: operators[0].address, value: amountMinBid
            });
            let balOp = await getEtherBalance(operators[0].address);
            expect(resBid.logs[0].event).to.be.equal("newBestBid");
            expect((initBalOp0 - balOp).toFixed(1)).to.be.equal(amountMinBidEther.toString());

            // operator overbid
            let initBalOp1 = await getEtherBalance(operators[1].address);
            const resBid2 = await insRollupPoB.bidWithDifferentBeneficiary(slot, url, beneficiaryAddress, {
                from: operators[1].address, value: amountWei
            });
            let balOp1 = await getEtherBalance(operators[1].address);
            expect(resBid2.logs[0].event).to.be.equal("newBestBid");
            expect((initBalOp1 - balOp1).toFixed()).to.be.equal(amount.toString());

            // first operator withdraws his amount
            let withdrawBid = await insRollupPoB.withdrawBid(operators[0].address);
            let amountTotalBid = Number(amountMinBid) + bonusBalance0;
            await insRollupPoB.withdraw({from: operators[0].address});
            let balOp0_2 = await getEtherBalance(operators[0].address);
            expect(withdrawBid.toString()).to.be.equal(amountTotalBid.toString());
            expect((balOp0_2 - balOp).toFixed(1)).to.be.equal((amountMinBidEther + bonusBalance0Ether).toFixed(1));

            // check winner
            let winner = await insRollupPoB.slotWinner(slot);
            expect(winner.forgerAddress).to.be.equal(operators[1].address);
            expect(winner.beneficiaryAddress).to.be.equal(beneficiaryAddress);
            expect(winner.bonusAddress).to.be.equal(operators[1].address);
            expect(winner.withdrawAddress).to.be.equal(operators[1].address);
        });

        it("Add Winning Operator with different beneficiary and forger", async () => {
            let slot = 6;
            let amount = 5;
            let amountWei = web3.utils.toWei(amount.toString(), "ether");

            // operator makes a bid
            let initBalOp0 = await getEtherBalance(operators[0].address);
            let bonusBalance0 = Number(await insRollupPoB.bonusBalance(operators[0].address));
            let bonusBalance0Ether = Number(web3.utils.fromWei(bonusBalance0.toString(), "ether"));
            const resBid = await insRollupPoB.bid(slot, url, {
                from: operators[0].address, value: amountMinBid
            });
            let balOp0 = await getEtherBalance(operators[0].address);
            expect(resBid.logs[0].event).to.be.equal("newBestBid");
            expect((initBalOp0 - balOp0).toFixed(1)).to.be.equal(amountMinBidEther.toString());

            // operator overbid
            let initBalOp1 = await getEtherBalance(operators[1].address);
            const resBid2 = await insRollupPoB.bidRelay(slot, url, beneficiaryAddress, forgerAddress, {
                from: operators[1].address, value: amountWei
            });
            let balOp1 = await getEtherBalance(operators[1].address);
            expect(resBid2.logs[0].event).to.be.equal("newBestBid");
            expect((initBalOp1 - balOp1).toFixed()).to.be.equal(amount.toString());

            // first operator withdraws his amount
            let withdrawBid = await insRollupPoB.withdrawBid(operators[0].address);
            let amountTotalBid = Number(amountMinBid) + bonusBalance0;
            await insRollupPoB.withdraw({from: operators[0].address});
            let balOp0_2 = await getEtherBalance(operators[0].address);
            expect(withdrawBid.toString()).to.be.equal(amountTotalBid.toString());
            expect((balOp0_2 - balOp0).toFixed(1)).to.be.equal((amountMinBidEther + bonusBalance0Ether).toFixed(1));

            // check winner
            let winner = await insRollupPoB.slotWinner(slot);
            expect(winner.forgerAddress).to.be.equal(forgerAddress);
            expect(winner.beneficiaryAddress).to.be.equal(beneficiaryAddress);
            expect(winner.bonusAddress).to.be.equal(operators[1].address);
            expect(winner.withdrawAddress).to.be.equal(operators[1].address);

            // check forger address
            const nLevels = 24;
            const maxTx = 10;
            // non-empty off-chain tx with 10 maxTx
            const tx = {
                fromAx: wallets[1].publicKey[0].toString(16),
                fromAy:  wallets[1].publicKey[1].toString(16),
                fromEthAddr: id1,
                toAx: wallets[2].publicKey[0].toString(16),
                toAy: wallets[2].publicKey[1].toString(16),
                toEthAddr: id1,
                amount: 50,
                coin: 0,
                fee: 0
            };
            const bb = await rollupDB.buildBatch(maxTx, nLevels);
            await bb.addTx(tx);
            await bb.build();
            const compressedTxTest = await bb.getDataAvailableSM();
            const hashOffChain = await bb.getOffChainHash().toString();

            const proofA = ["0", "0"];
            const proofB = [["0", "0"], ["0", "0"]];
            const proofC = ["0", "0"];
            const input = ["0", "0", "0", "0", hashOffChain, "0", "0", "0","0", beneficiaryAddress];

            await insRollupPoB.setBlockNumber(slotBlock[slot]);

            try {
                await insRollupPoB.commitAndForge(compressedTxTest, proofA, proofB, proofC, input, [], {from: operators[0].address});
            } catch (error) {
                expect((error.message).includes("message sender must be forgerAddress")).to.be.equal(true);
            }
            const resCommit = await insRollupPoB.commitAndForge(compressedTxTest, proofA, proofB, proofC, input, [], {from: forgerAddress});
            expect(resCommit.logs[0].event).to.be.equal("dataCommitted");

            await insRollupPoB.setBlockNumber(slotBlock[3]);
        });
 
        it("Add Winning Operator with different beneficiary, forger and withdraw address", async () => {
            let slot = 7;
            let amount = 5;
            let amountWei = web3.utils.toWei(amount.toString(), "ether");

            // operator makes a bid
            let initBalOp0 = await getEtherBalance(operators[0].address);
            let bonusBalance0 = Number(await insRollupPoB.bonusBalance(operators[0].address));
            let bonusBalance0Ether = Number(web3.utils.fromWei(bonusBalance0.toString(), "ether"));
            const resBid = await insRollupPoB.bidRelayAndWithdrawAddress(slot, url, beneficiaryAddress, forgerAddress,
                withdrawAddress, { from: operators[0].address, value: amountMinBid });
            let balOp0 = await getEtherBalance(operators[0].address);
            expect(resBid.logs[0].event).to.be.equal("newBestBid");
            expect((initBalOp0 - balOp0).toFixed(1)).to.be.equal(amountMinBidEther.toString());

            // check winner
            let winner = await insRollupPoB.slotWinner(slot);
            expect(winner.forgerAddress).to.be.equal(forgerAddress);
            expect(winner.beneficiaryAddress).to.be.equal(beneficiaryAddress);
            expect(winner.bonusAddress).to.be.equal(operators[0].address);
            expect(winner.withdrawAddress).to.be.equal(withdrawAddress);

            // operator overbid
            let initBalOp1 = await getEtherBalance(operators[1].address);
            const resBid2 = await insRollupPoB.bid(slot, url, {
                from: operators[1].address, value: amountWei
            });
            let balOp1 = await getEtherBalance(operators[1].address);
            expect(resBid2.logs[0].event).to.be.equal("newBestBid");
            expect((initBalOp1 - balOp1).toFixed()).to.be.equal(amount.toString());

            // first operator withdraws his amount
            let initBalWithdrawAddress = await getEtherBalance(withdrawAddress);
            let withdrawBid = await insRollupPoB.withdrawBid(withdrawAddress);
            try {
                await insRollupPoB.withdraw({from: operators[0].address});
            } catch (error) {
                expect((error.message).includes("You cannot withdraw the amount")).to.be.equal(true);
            }
            let amountTotalBid = Number(amountMinBid) + bonusBalance0;
            await insRollupPoB.withdraw({from: withdrawAddress});
            let balWithdrawAddress = await getEtherBalance(withdrawAddress);
            expect(withdrawBid.toString()).to.be.equal(amountTotalBid.toString());
            expect((balWithdrawAddress - initBalWithdrawAddress).toFixed(1)).to.be.equal((amountMinBidEther + bonusBalance0Ether).toFixed(1));
        });

        it("Add Winning Operator with different beneficiary, forger, withdraw address and bonus address", async () => {
            let slot = 8;
            let amount = 5;
            let amountWei = web3.utils.toWei(amount.toString(), "ether");

            // operator makes a bid
            let initBalOp0 = await getEtherBalance(operators[0].address);
            let op0initBonusBalance = await insRollupPoB.bonusBalance(operators[0].address);
            let bonusInitBonusBalance = await insRollupPoB.bonusBalance(bonusAddress);
            const resBid = await insRollupPoB.bidWithDifferentAddresses(slot, url, beneficiaryAddress, forgerAddress,
                withdrawAddress, bonusAddress, false, { from: operators[0].address, value: amountMinBid });
            let balOp0 = await getEtherBalance(operators[0].address);
            expect(resBid.logs[0].event).to.be.equal("newBestBid");
            expect((initBalOp0 - balOp0).toFixed(1)).to.be.equal(amountMinBidEther.toString());

            // check winner
            let winner = await insRollupPoB.slotWinner(slot);
            expect(winner.forgerAddress).to.be.equal(forgerAddress);
            expect(winner.beneficiaryAddress).to.be.equal(beneficiaryAddress);
            expect(winner.bonusAddress).to.be.equal(bonusAddress);
            expect(winner.withdrawAddress).to.be.equal(withdrawAddress);

            // operator overbid
            let initBalOp1 = await getEtherBalance(operators[1].address);
            const resBid2 = await insRollupPoB.bid(slot, url, {
                from: operators[1].address, value: amountWei
            });
            let balOp1 = await getEtherBalance(operators[1].address);
            expect(resBid2.logs[0].event).to.be.equal("newBestBid");
            expect((initBalOp1 - balOp1).toFixed()).to.be.equal(amount.toString());

            // check bonusBalance of bonusAddress
            let op0BonusBalance = await insRollupPoB.bonusBalance(operators[0].address);
            let bonusBalance = await insRollupPoB.bonusBalance(bonusAddress);
            expect(op0initBonusBalance.toString()).to.be.equal(op0BonusBalance.toString());
            expect(bonusBalance.toString()).to.be.equal(Math.round(bonusInitBonusBalance + amountMinBid * 0.1, -2).toString());

            // operator overbid with bonusAddress without using bonusBalance
            let initBonusBalance_2 = await insRollupPoB.bonusBalance(bonusAddress);
            let amountWei10 = web3.utils.toWei("10", "ether");
            const resBid3 = await insRollupPoB.bidWithDifferentAddresses(slot, url, beneficiaryAddress, forgerAddress,
                withdrawAddress, bonusAddress, false, { from: operators[0].address, value: amountWei10 });
            expect(resBid3.logs[0].event).to.be.equal("newBestBid");

            let bonusBalance_2 = await insRollupPoB.bonusBalance(bonusAddress);
            expect(initBonusBalance_2.toString()).to.be.equal(bonusBalance_2.toString());

            // operator overbid
            let amountWei15 = web3.utils.toWei("15", "ether");
            const resBid4 = await insRollupPoB.bid(slot, url, {
                from: operators[1].address, value: amountWei15
            });
            expect(resBid4.logs[0].event).to.be.equal("newBestBid");
            
            // acumulate bonusBalance operator0
            let bonusBalance_3 = await insRollupPoB.bonusBalance(bonusAddress);
            expect(Number(initBonusBalance_2) + amountWei10 * 0.1).to.be.equal(Number(bonusBalance_3));

            // operator overbid with bonusAddress using bonusBalance
            let amountWei20 = web3.utils.toWei("20", "ether");
            try {
                await insRollupPoB.bidWithDifferentAddresses(slot, url, beneficiaryAddress, forgerAddress, 
                    withdrawAddress, bonusAddress, true, { from: operators[0].address, value: amountWei20 });
            } catch (error) {
                expect((error.message).includes("To use bonus it is necessary that sender is the bonusAddress")).to.be.equal(true);
            }
            const resBid5 = await insRollupPoB.bidWithDifferentAddresses(slot, url, beneficiaryAddress, forgerAddress,
                withdrawAddress, bonusAddress, true, { from: bonusAddress, value: amountWei20 });
            expect(resBid5.logs[0].event).to.be.equal("newBestBid");

            let bonusBalance_4 = await insRollupPoB.bonusBalance(bonusAddress);
            expect(bonusBalance_4.toString()).to.be.equal("0");
        });

        it("commit and forge batch", async () => {
            const slot = 9;
            const nLevels = 24;
            const maxTx = 10;
            // non-empty off-chain tx with 10 maxTx
            const tx = {
                fromAx: wallets[1].publicKey[0].toString(16),
                fromAy:  wallets[1].publicKey[1].toString(16),
                fromEthAddr: id1,
                toAx: wallets[2].publicKey[0].toString(16),
                toAy: wallets[2].publicKey[1].toString(16),
                toEthAddr: id1,
                amount: 50,
                coin: 0,
                fee: 0
            };
            const bb = await rollupDB.buildBatch(maxTx, nLevels);
            await bb.addTx(tx);
            await bb.build();
            const compressedTxTest = await bb.getDataAvailableSM();
            const hashOffChain = await bb.getOffChainHash().toString();

            const proofA = ["0", "0"];
            const proofB = [["0", "0"], ["0", "0"]];
            const proofC = ["0", "0"];
            const input = ["0", "0", "0", "0", hashOffChain, "0", "0", "0","0", operators[0].address];

            // reset rollup PoB
            insRollupPoB = await RollupPoB.new(addressRollupTest, maxTx, burnAddress, accounts[3], url);
            await insRollupPoB.setBlockNumber(slotBlock[0]);
            // operator makes a bid
            await insRollupPoB.bid(slot, url, {
                from: operators[0].address, value: amountMinBid
            });
            // set the slot that the previous operator has won
            await insRollupPoB.setBlockNumber(slotBlock[slot]);

            // Forge batch
            await insRollupPoB.commitAndForge(compressedTxTest, proofA, proofB, proofC, input, [], {from: operators[0].address});

        });

        it("Forge other operator after deadline", async () => {
            const slot = 10;
            const nLevels = 24;
            const maxTx = 10;
            // non-empty off-chain tx with 10 maxTx
            const tx = {
                fromAx: wallets[1].publicKey[0].toString(16),
                fromAy:  wallets[1].publicKey[1].toString(16),
                fromEthAddr: id1,
                toAx: wallets[2].publicKey[0].toString(16),
                toAy: wallets[2].publicKey[1].toString(16),
                toEthAddr: id1,
                amount: 50,
                coin: 0,
                fee: 0,
            };
            const bb = await rollupDB.buildBatch(maxTx, nLevels);
            await bb.addTx(tx);
            await bb.build();
            const compressedTxTest = await bb.getDataAvailableSM();
            const hashOffChain = await bb.getOffChainHash().toString();

            const proofA = ["0", "0"];
            const proofB = [["0", "0"], ["0", "0"]];
            const proofC = ["0", "0"];
            const input = ["0", "0", "0", "0", hashOffChain, "0", "0", "0","0", operators[0].address];

            // reset rollup PoB
            insRollupPoB = await RollupPoB.new(addressRollupTest, maxTx, burnAddress, accounts[3], url);
            await insRollupPoB.setBlockNumber(slotBlock[0]);
            // operator makes a bid
            await insRollupPoB.bid(slot, url, {
                from: operators[0].address, value: amountMinBid
            });
            // set the slot that the previous operator has won but after the deadline block
            await insRollupPoB.setBlockNumber(slotBlock[slot+1] - deadlineBlocks);
            // commits and forges another operator who has not won the auction
            await insRollupPoB.commitAndForgeDeadline(compressedTxTest, proofA, proofB, proofC, input, [], {from: operators[1].address});
        });


        it("Try forging but another operator has already forged data", async () => {
            const nLevels = 24;
            const maxTx = 10;
            const slot = 11;
            // non-empty off-chain tx with 10 maxTx
            const tx = {
                fromAx: wallets[1].publicKey[0].toString(16),
                fromAy:  wallets[1].publicKey[1].toString(16),
                fromEthAddr: id1,
                toAx: wallets[2].publicKey[0].toString(16),
                toAy: wallets[2].publicKey[1].toString(16),
                toEthAddr: id1,
                amount: 50,
                coin: 0,
                fee: 0
            };
            const bb = await rollupDB.buildBatch(maxTx, nLevels);
            await bb.addTx(tx);
            await bb.build();
            const compressedTxTest = await bb.getDataAvailableSM();
            const hashOffChain = await bb.getOffChainHash().toString();

            const proofA = ["0", "0"];
            const proofB = [["0", "0"], ["0", "0"]];
            const proofC = ["0", "0"];
            const input = ["0", "0", "0", "0", hashOffChain, "0", "0", "0","0", operators[0].address];

            // reset rollup PoB
            insRollupPoB = await RollupPoB.new(addressRollupTest, maxTx, burnAddress, accounts[3], url);
            await insRollupPoB.setBlockNumber(slotBlock[0]);
            await insRollupPoB.bid(slot, url, {
                from: operators[0].address, value: amountMinBid
            });
            // set the slot that the previous operator has won
            await insRollupPoB.setBlockNumber(slotBlock[slot]);
            // slot winner forged data
            await insRollupPoB.commitAndForge(compressedTxTest, proofA, proofB, proofC, input, [], {from: operators[0].address});
            // set the block of the same slot but after deadline
            await insRollupPoB.setBlockNumber(slotBlock[slot+1] - deadlineBlocks);
            // try to commit data when the winner has already committed data
            try {
                await insRollupPoB.commitAndForgeDeadline(compressedTxTest, proofA, proofB, proofC, input, [], {from: operators[1].address});
            } catch (error) {
                expect((error.message).includes("another operator has already forged data")).to.be.equal(true);
            }
        });

        it("Invalid forge", async () => {
            const slot = 12;
            const nLevels = 24;
            const maxTx = 10;
            // non-empty off-chain tx with 10 maxTx
            const tx = {
                fromAx: wallets[1].publicKey[0].toString(16),
                fromAy:  wallets[1].publicKey[1].toString(16),
                fromEthAddr: id1,
                toAx: wallets[2].publicKey[0].toString(16),
                toAy: wallets[2].publicKey[1].toString(16),
                toEthAddr: id1,
                amount: 50,
                coin: 0,
                fee: 0
            };
            const bb = await rollupDB.buildBatch(maxTx, nLevels);
            await bb.addTx(tx);
            await bb.build();
            const compressedTxTest = await bb.getDataAvailableSM();
            const hashOffChain = await bb.getOffChainHash().toString();

            const proofA = ["0", "0"];
            const proofB = [["0", "0"], ["0", "0"]];
            const proofC = ["0", "0"];
            const input = ["0", "0", "0", "0", hashOffChain, "0", "0", "0","0", operators[0].address];

            // reset rollup PoB
            insRollupPoB = await RollupPoB.new(addressRollupTest, maxTx, burnAddress, accounts[3], url);
            await insRollupPoB.setBlockNumber(slotBlock[0]);
            await insRollupPoB.bid(slot, url, {
                from: operators[0].address, value: amountMinBid
            });
            // set the slot that the previous operator has won
            await insRollupPoB.setBlockNumber(slotBlock[slot]);
            // try to forge another operator before the deadline
            try {
                await insRollupPoB.commitAndForgeDeadline(compressedTxTest, proofA, proofB, proofC, input, [], {from: operators[1].address});
            } catch (error) {
                expect((error.message).includes("not possible to forge data before deadline")).to.be.equal(true);
            }
            // try to commit data another operator
            try {
                await insRollupPoB.commitAndForge(compressedTxTest, proofA, proofB, proofC, input, [], {from: operators[1].address});
            } catch (error) {
                expect((error.message).includes("forgerAddress")).to.be.equal(true);
            }
            
        });

        it("More options in the auction", async () => {
            let slot = 14;

            let amount05 = 0.05;
            let amount5 = 0.5 ;
            let amount10 = 1;

            let amountWei05 = web3.utils.toWei(amount05.toString(), "ether");
            let amountWei5 = web3.utils.toWei(amount5.toString(), "ether");
            let amountWei10 = web3.utils.toWei(amount10.toString(), "ether");

            const nLevels = 24;
            const maxTx = 10;
            const tx = {
                fromAx: wallets[1].publicKey[0].toString(16),
                fromAy:  wallets[1].publicKey[1].toString(16),
                fromEthAddr: id1,
                toAx: wallets[2].publicKey[0].toString(16),
                toAy: wallets[2].publicKey[1].toString(16),
                toEthAddr: id1,
                amount: 50,
                coin: 0,
                fee: 0
            };
            const bb = await rollupDB.buildBatch(maxTx, nLevels);
            await bb.addTx(tx);
            await bb.build();
            const compressedTxTest = await bb.getDataAvailableSM();
            const hashOffChain = await bb.getOffChainHash().toString();

            const proofA = ["0", "0"];
            const proofB = [["0", "0"], ["0", "0"]];
            const proofC = ["0", "0"];
            const input = ["0", "0", "0", "0", hashOffChain, "0", "0", "0","0", operators[2].address];
            
            // try to bid for a slot too close
            await insRollupPoB.setBlockNumber(slotBlock[slot-2]);
            try {
                await insRollupPoB.bid(slot-2, url, {
                    from: operators[0].address, value: amountWei05
                });
            } catch (error) {
                expect((error.message).includes("This auction is already closed")).to.be.equal(true);
            }
            // try to bid for a slot with too small amount
            try {
                await insRollupPoB.bid(slot, url, {
                    from: operators[0].address, value: amountWei05
                });
            } catch (error) {
                expect((error.message).includes("Ether send not enough to enter auction")).to.be.equal(true);
            }
            // operator makes a valid bid
            const resBid = await insRollupPoB.bid(slot, url, {
                from: operators[0].address, value: amountMinBid
            });
            expect(resBid.logs[0].event).to.be.equal("newBestBid");
            expect(web3.utils.fromWei(resBid.logs[0].args.price, "ether")).to.be.equal(amountMinBidEther.toString());

            // try to bid that without exceeding 30% of the previous
            try {
                await insRollupPoB.bid(slot, url, {
                    from: operators[1].address, value: amountMinBid
                });
            } catch (error) {
                expect((error.message).includes("Ether send not enough to outbid current bid")).to.be.equal(true);
            }
            // operator makes a valid bid
            const resBid2 = await insRollupPoB.bid(slot, url, {
                from: operators[1].address, value: amountWei5 });
            expect(resBid2.logs[0].event).to.be.equal("newBestBid");
            expect(web3.utils.fromWei(resBid2.logs[0].args.price, "ether")).to.be.equal((amount5-amountMinBidEther*0.1).toString());
            
            // try to bid that without exceeding 30% of the previous
            try {
                await insRollupPoB.bid(slot, url, {
                    from: operators[2].address, value: amountWei5
                });
            } catch (error) {
                expect((error.message).includes("Ether send not enough to outbid current bid")).to.be.equal(true);
            }
            // operator makes a valid bid
            const resBid3 = await insRollupPoB.bid(slot, url, {
                from: operators[2].address, value: amountWei10 });
            expect(resBid3.logs[0].event).to.be.equal("newBestBid");
            expect(web3.utils.fromWei(resBid3.logs[0].args.price, "ether")).to.be.equal((amount10-amount5*0.1-amountMinBidEther*0.1).toString());

            await insRollupPoB.setBlockNumber(slotBlock[slot]);
            // try to commit data an operator that is not the winner
            try {
                await insRollupPoB.commitAndForge(compressedTxTest, proofA, proofB, proofC, input, [], {from: operators[0].address});
            } catch(err) {
                expect((err.message).includes("message sender must be forgerAddress")).to.be.equal(true);
            }
            // try to commit data an operator that is not the winner
            try {
                await insRollupPoB.commitAndForge(compressedTxTest, proofA, proofB, proofC, input, [], {from: operators[1].address});
            } catch(err) {
                expect((err.message).includes("message sender must be forgerAddress")).to.be.equal(true);
            }
            // commit and forge data the correct operator
            const resCommit = await insRollupPoB.commitAndForge(compressedTxTest, proofA, proofB, proofC, input, [], {from: operators[2].address});
            expect(resCommit.logs[0].event).to.be.equal("dataCommitted");
        });

        it("Using bonusBalance", async () => {
            let slot = 16;
            let amount10 = 10;
            let amountWei10 = web3.utils.toWei(amount10.toString(), "ether");
            let amount13 = 13;
            let amountWei13 = web3.utils.toWei(amount13.toString(), "ether");
            let amountX = 15.8;
            let amountWeiX = web3.utils.toWei(amountX.toString(), "ether");
            let amountXX = 15.9;
            let amountWeiXX = web3.utils.toWei(amountXX.toString(), "ether");
            let amountY = 21;
            let amountWeiY = web3.utils.toWei(amountY.toString(), "ether");
            let amountYY = 22;
            let amountWeiYY = web3.utils.toWei(amountYY.toString(), "ether");

            const resBid = await insRollupPoB.bid(slot, url, {
                from: operators[4].address, value: amountWei10
            });
            expect(resBid.logs[0].event).to.be.equal("newBestBid");
            const resBid2 = await insRollupPoB.bid(slot, url, {
                from: operators[5].address, value: amountWei13
            });
            expect(resBid2.logs[0].event).to.be.equal("newBestBid");

            // bonusBalance[op4] = 1
            // 1.3 * 13 = 16.9 --> minBid = 16.9 - bonusBalance[op4] = 15.9
            // try to bid with bid < 15.9
            try {
                await insRollupPoB.bid(slot, url, {
                    from: operators[4].address, value: amountWeiX
                });
            } catch (error) {
                expect((error.message).includes("Ether send not enough to outbid current bid")).to.be.equal(true);
            }
            // operator makes a bid with bid = 15.9
            const resBid3 = await insRollupPoB.bid(slot, url, {
                from: operators[4].address, value: amountWeiXX
            });
            expect(resBid3.logs[0].event).to.be.equal("newBestBid");

            // bonusBalance[op4] = 0
            // 1.3 * 16.9 = 22 --> minBid = 22 - bonusBalance[op4] = 22
            // try to bid with bid < 22
            try {
                await insRollupPoB.bid(slot, url, {
                    from: operators[4].address, value: amountWeiY
                });
            } catch (error) {
                expect((error.message).includes("Ether send not enough to outbid current bid")).to.be.equal(true);
            }
            // operator makes a bid with bid = 22
            const resBid4 = await insRollupPoB.bid(slot, url, {
                from: operators[4].address, value: amountWeiYY
            });
            expect(resBid4.logs[0].event).to.be.equal("newBestBid");
            
        });

        it("Default Operator", async() => {
            let slot = 17;
            const nLevels = 24;
            const maxTx = 10;
            // non-empty off-chain tx with 10 maxTx
            const tx = {
                fromAx: wallets[1].publicKey[0].toString(16),
                fromAy:  wallets[1].publicKey[1].toString(16),
                fromEthAddr: id1,
                toAx: wallets[2].publicKey[0].toString(16),
                toAy: wallets[2].publicKey[1].toString(16),
                toEthAddr: id1,
                amount: 50,
                coin: 0,
                fee: 0
            };
            const bb = await rollupDB.buildBatch(maxTx, nLevels);
            await bb.addTx(tx);
            await bb.build();
            const compressedTxTest = await bb.getDataAvailableSM();
            const hashOffChain = await bb.getOffChainHash().toString();

            const proofA = ["0", "0"];
            const proofB = [["0", "0"], ["0", "0"]];
            const proofC = ["0", "0"];
            const input = ["0", "0", "0", "0", hashOffChain, "0", "0", "0","0", operators[3].address];

            // reset rollup PoB
            insRollupPoB = await RollupPoB.new(addressRollupTest, maxTx, burnAddress, operators[3].address, url);
            await insRollupPoB.setBlockNumber(slotBlock[0]);
            // set the slot without winner
            await insRollupPoB.setBlockNumber(slotBlock[slot]);

            // Forge batch
            await insRollupPoB.commitAndForge(compressedTxTest, proofA, proofB, proofC, input, [], {from: operators[3].address});

        });

        it("Invalidate default Operator", async() => {
            let slot = 18;
            const nLevels = 24;
            const maxTx = 10;
            // non-empty off-chain tx with 10 maxTx
            const tx = {
                fromAx: wallets[1].publicKey[0].toString(16),
                fromAy:  wallets[1].publicKey[1].toString(16),
                fromEthAddr: id1,
                toAx: wallets[2].publicKey[0].toString(16),
                toAy: wallets[2].publicKey[1].toString(16),
                toEthAddr: id1,
                amount: 50,
                coin: 0,
                fee: 0
            };
            const bb = await rollupDB.buildBatch(maxTx, nLevels);
            await bb.addTx(tx);
            await bb.build();
            const compressedTxTest = await bb.getDataAvailableSM();
            const hashOffChain = await bb.getOffChainHash().toString();

            const proofA = ["0", "0"];
            const proofB = [["0", "0"], ["0", "0"]];
            const proofC = ["0", "0"];
            const input = ["0", "0", "0", "0", hashOffChain, "0", "0", "0","0", operators[3].address];

            // reset rollup PoB
            insRollupPoB = await RollupPoB.new(addressRollupTest, maxTx, burnAddress, operators[3].address, url);
            await insRollupPoB.setBlockNumber(slotBlock[0]);
            // set the slot without winner
            await insRollupPoB.setBlockNumber(slotBlock[slot]);

            // Forge batch
            try {
                await insRollupPoB.commitAndForge(compressedTxTest, proofA, proofB, proofC, input, [], {from: operators[2].address});
            } catch (error) {
                expect((error.message).includes("message sender must be default operator")).to.be.equal(true);
            }
        });

        it("MultiBid", async () => {
            // reset rollup PoB
            insRollupPoB = await RollupPoB.new(addressRollupTest, maxTx, burnAddress, operators[3].address, url);
            await insRollupPoB.setBlockNumber(slotBlock[0]);

            let rangeBids = [amountMinBid, amountMinBid, amountMinBid];
            let rangeSlot = [[19, 21], [22, 25], [27, 29]];
            let totalAmount = web3.utils.toBN(0);
            for ( let i = 0; i < rangeBids.length; i++) {
                const addBid = amountMinBid.mul(web3.utils.toBN(rangeSlot[i][1]-rangeSlot[i][0] + 1));
                totalAmount = totalAmount.add(addBid);
            }
            let initBalOp0 = await getEtherBalance(operators[0].address);
            await insRollupPoB.multiBid(rangeBids, rangeSlot, url, {
                from: operators[0].address,
                value: totalAmount,
            });
            let balOp0 = await getEtherBalance(operators[0].address);
            let totalAmountEther = web3.utils.fromWei(totalAmount, "ether");
            expect((initBalOp0 - balOp0).toFixed()).to.be.equal(totalAmountEther.toString());
            
            // check winner
            for ( let i = 0; i < rangeBids.length; i++) {
                for (let j = rangeSlot[i][0]; j <= rangeSlot[i][1]; j++ ){
                    let winner = await insRollupPoB.slotWinner(j);
                    expect(winner.forgerAddress).to.be.equal(operators[0].address);
                }
            }

            let winner = await insRollupPoB.slotWinner(26);
            expect(winner.forgerAddress).to.be.equal("0x0000000000000000000000000000000000000000");

        });

        it("MultiBid with errors", async () => {
            // reset rollup PoB
            insRollupPoB = await RollupPoB.new(addressRollupTest, maxTx, burnAddress, operators[3].address, url);
            await insRollupPoB.setBlockNumber(slotBlock[0]);
            await insRollupPoB.setBlockNumber(slotBlock[19]);
            let rangeBids = [amountMinBid, amountMinBid, amountMinBid];
            let rangeSlot = [[19, 21], [22, 25], [27, 29]];
            let totalAmount = web3.utils.toBN(0);
            for ( let i = 0; i < rangeBids.length; i++) {
                const addBid = amountMinBid.mul(web3.utils.toBN(rangeSlot[i][1]-rangeSlot[i][0] + 1));
                totalAmount = totalAmount.add(addBid);
            }
            let initBalOp0 = await getEtherBalance(operators[0].address);
            try {
                await insRollupPoB.multiBid(rangeBids, rangeSlot, url, {
                    from: operators[0].address,
                    value: totalAmount,
                });
            } catch (err) {
                expect(err.message.includes("One auction is already closed")).to.be.equal(true);
            }
            let balOp0 = await getEtherBalance(operators[0].address);
            expect((initBalOp0 - balOp0).toFixed()).to.be.equal("0");

            rangeSlot = [[22, 25], [27, 29], [30, 34]];
            try {
                await insRollupPoB.multiBid(rangeBids, rangeSlot, url, {
                    from: operators[0].address,
                    value: amountMinBid,
                });
            } catch (err) {
                expect(err.message.includes("Not enought value")).to.be.equal(true);
            }
            const lessAmountMinBid = web3.utils.toBN(web3.utils.toWei("0.09", "ether"));
            rangeBids = [lessAmountMinBid, amountMinBid, amountMinBid];
            totalAmount = web3.utils.toBN(0);

            for ( let i = 0; i < rangeBids.length; i++) {
                const addBid = rangeBids[i].mul(web3.utils.toBN(rangeSlot[i][1]-rangeSlot[i][0] + 1));
                totalAmount = totalAmount.add(addBid);
            }

            let realTotalAmount = web3.utils.toBN(0);
            for ( let i = 1; i < rangeBids.length; i++) {
                const addBid = amountMinBid.mul(web3.utils.toBN(rangeSlot[i][1]-rangeSlot[i][0] + 1));
                realTotalAmount = realTotalAmount.add(addBid);
            }

            let initBalOp1 = await getEtherBalance(operators[0].address);
            await insRollupPoB.multiBid(rangeBids, rangeSlot, url, {
                from: operators[0].address,
                value: totalAmount,
            });
            let balOp1 = await getEtherBalance(operators[0].address);
            let realTotalAmountEther = web3.utils.fromWei(realTotalAmount, "ether");
            expect((initBalOp1 - balOp1).toFixed(1)).to.be.equal(realTotalAmountEther.toString(1));

            // check winner
            for ( let i = 0; i < rangeBids.length; i++) {
                for (let j = rangeSlot[i][0]; j <= rangeSlot[i][1]; j++ ){
                    if(i === 0) {
                        let winner = await insRollupPoB.slotWinner(j);
                        expect(winner.forgerAddress).to.be.equal("0x0000000000000000000000000000000000000000");
                    } else {
                        let winner = await insRollupPoB.slotWinner(j);
                        expect(winner.forgerAddress).to.be.equal(operators[0].address);
                    }
                }
            }

        });

    });
});