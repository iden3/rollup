/* global artifacts */
/* global contract */
/* global web3 */

const chai = require("chai");
const { expect } = chai;
const RollupPoB = artifacts.require("../contracts/test/RollupPoBTest");
const RollupDB = require("../../js/rollupdb");
const SMTMemDB = require("circomlib/src/smt_memdb");

const { getEtherBalance, getPublicPoBVariables} = require("./helpers/helpers");

const abiDecoder = require("abi-decoder");
abiDecoder.addABI(RollupPoB.abi);

contract("RollupPoB", (accounts) => {

    // Definition of some address
    const {
        6: beneficiaryAddress,
        7: forgerAddress,
        8: withdrawAddress,
        9: bonusAddress,
    } = accounts;

    // definition of variables
    let insRollupPoB;
    const maxTx = 10;
    const addressRollupTest = "0x0000000000000000000000000000000000000001";
    const operators = [];
    const slotBlock = [];
    let blocksPerSlot;
    let deadlineBlocks;
    let db;
    let rollupDB;
    let genesisBlock;
    let amountMinBid;
    let amountMinBidEther;

    before(async () => {
        // Deploy token test
        insRollupPoB = await RollupPoB.new(addressRollupTest, maxTx);
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
                fromIdx: 1,
                loadAmount: 1000,
                coin: 0,
                ax: 0,
                ay: 0,
                ethAddress: 0,
                onChain: true
            });
    
            bb.addTx({
                fromIdx: 2,
                loadAmount: 2000,
                coin: 0,
                ax: 0,
                ay: 0,
                ethAddress: 0,
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
            const resBid = await insRollupPoB.bid(slot, {
                from: operators[0].address, value: amountMinBid
            });
            let balOp0 = await getEtherBalance(operators[0].address);
            expect(resBid.logs[0].event).to.be.equal("newBestBid");
            expect(Math.ceil(balOp0)).to.be.equal(Math.ceil(initBalOp0 - amountMinBidEther));

            // operator overbid
            let initBalOp1 = await getEtherBalance(operators[1].address);
            const resBid2 = await insRollupPoB.bid(slot, {
                from: operators[1].address, value: amountWei
            });
            let balOp1 = await getEtherBalance(operators[1].address);
            expect(resBid2.logs[0].event).to.be.equal("newBestBid");
            expect(Math.ceil(balOp1)).to.be.equal(Math.ceil(initBalOp1 - amount));
            
            // first operator withdraws his amount
            let withdrawBid = await insRollupPoB.withdrawBid(operators[0].address);
            await insRollupPoB.withdraw({from: operators[0].address});
            let balOp0_2 = await getEtherBalance(operators[0].address);
            expect(withdrawBid.toString()).to.be.equal(amountMinBid.toString());
            expect(Math.ceil(balOp0_2)).to.be.equal(Math.ceil(balOp0 + amountMinBidEther));

            // check winner
            let winner = await insRollupPoB.slotWinner(slot);
            expect(winner.forgerAddress).to.be.equal(operators[1].address);
        });

        it("Add Winning Operator and use bidBalance", async () => {
            let slot = 4;
            let amount = 5;
            let amountWei = web3.utils.toWei(amount.toString(), "ether");            

            // operator makes a bid
            let initBalOp0 = await getEtherBalance(operators[0].address);
            let bidBalance0 = Number(await insRollupPoB.bidBalance(operators[0].address));
            let bidBalance0Ether = Number(web3.utils.fromWei(bidBalance0.toString(), "ether"));
            const resBid = await insRollupPoB.bid(slot, {
                from: operators[0].address, value: amountMinBid
            });
            let balOp0 = await getEtherBalance(operators[0].address);
            expect(resBid.logs[0].event).to.be.equal("newBestBid");
            expect(Math.ceil(balOp0)).to.be.equal(Math.ceil(initBalOp0 - amountMinBidEther));

            // operator overbid
            let initBalOp1 = await getEtherBalance(operators[1].address);
            const resBid2 = await insRollupPoB.bid(slot, {
                from: operators[1].address, value: amountWei
            });
            let balOp1 = await getEtherBalance(operators[1].address);
            expect(resBid2.logs[0].event).to.be.equal("newBestBid");
            expect(Math.ceil(balOp1)).to.be.equal(Math.ceil(initBalOp1 - amount));
            
            // first operator withdraws his amount
            let withdrawBid = await insRollupPoB.withdrawBid(operators[0].address);
            let amountTotalBid = Number(amountMinBid) + bidBalance0;
            expect(withdrawBid.toString()).to.be.equal(amountTotalBid.toString());
            await insRollupPoB.withdraw({from: operators[0].address});
            let balOp0_2 = await getEtherBalance(operators[0].address);
            expect(Math.ceil(balOp0_2)).to.be.equal(Math.ceil(balOp0 + amountMinBidEther + bidBalance0Ether));

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
            let bidBalance0 = Number(await insRollupPoB.bidBalance(operators[0].address));
            let bidBalance0Ether = Number(web3.utils.fromWei(bidBalance0.toString(), "ether"));
            const resBid = await insRollupPoB.bid(slot, {
                from: operators[0].address, value: amountMinBid
            });
            let balOp = await getEtherBalance(operators[0].address);
            expect(resBid.logs[0].event).to.be.equal("newBestBid");
            expect(Math.ceil(balOp)).to.be.equal(Math.ceil(initBalOp0 - amountMinBidEther));

            // operator overbid
            let initBalOp1 = await getEtherBalance(operators[1].address);
            const resBid2 = await insRollupPoB.bidWithDifferentBeneficiary(slot, beneficiaryAddress, {
                from: operators[1].address, value: amountWei
            });
            let balOp1 = await getEtherBalance(operators[1].address);
            expect(resBid2.logs[0].event).to.be.equal("newBestBid");
            expect(Math.ceil(balOp1)).to.be.equal(Math.ceil(initBalOp1 - amount));

            // first operator withdraws his amount
            let withdrawBid = await insRollupPoB.withdrawBid(operators[0].address);
            let amountTotalBid = Number(amountMinBid) + bidBalance0;
            await insRollupPoB.withdraw({from: operators[0].address});
            let balOp0_2 = await getEtherBalance(operators[0].address);
            expect(withdrawBid.toString()).to.be.equal(amountTotalBid.toString());
            expect(Math.ceil(balOp0_2)).to.be.equal(Math.ceil(balOp + amountMinBidEther + bidBalance0Ether));

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
            let bidBalance0 = Number(await insRollupPoB.bidBalance(operators[0].address));
            let bidBalance0Ether = Number(web3.utils.fromWei(bidBalance0.toString(), "ether"));
            const resBid = await insRollupPoB.bid(slot, {
                from: operators[0].address, value: amountMinBid
            });
            let balOp0 = await getEtherBalance(operators[0].address);
            expect(resBid.logs[0].event).to.be.equal("newBestBid");
            expect(Math.ceil(balOp0)).to.be.equal(Math.ceil(initBalOp0 - amountMinBidEther));

            // operator overbid
            let initBalOp1 = await getEtherBalance(operators[1].address);
            const resBid2 = await insRollupPoB.bidRelay(slot, beneficiaryAddress, forgerAddress, {
                from: operators[1].address, value: amountWei
            });
            let balOp1 = await getEtherBalance(operators[1].address);
            expect(resBid2.logs[0].event).to.be.equal("newBestBid");
            expect(Math.ceil(balOp1)).to.be.equal(Math.ceil(initBalOp1 - amount));

            // first operator withdraws his amount
            let withdrawBid = await insRollupPoB.withdrawBid(operators[0].address);
            let amountTotalBid = Number(amountMinBid) + bidBalance0;
            await insRollupPoB.withdraw({from: operators[0].address});
            let balOp0_2 = await getEtherBalance(operators[0].address);
            expect(withdrawBid.toString()).to.be.equal(amountTotalBid.toString());
            expect(Math.ceil(balOp0_2)).to.be.equal(Math.ceil(balOp0 + amountMinBidEther + bidBalance0Ether));

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
                fromIdx: 1,
                toIdx: 2,
                amount: 50,
            };
            const bb = await rollupDB.buildBatch(maxTx, nLevels);
            await bb.addTx(tx);
            await bb.build();
            const compressedTxTest = await bb.getDataAvailable();
            await insRollupPoB.setBlockNumber(slotBlock[slot]);

            try {
                await insRollupPoB.commitBatch(compressedTxTest, {from: operators[0].address});
            } catch (error) {
                expect((error.message).includes("message sender must be forgerAddress")).to.be.equal(true);
            }
            const resCommit = await insRollupPoB.commitBatch(compressedTxTest, {from: forgerAddress});
            expect(resCommit.logs[0].event).to.be.equal("dataCommitted");

            await insRollupPoB.setBlockNumber(slotBlock[3]);
        });
 
        it("Add Winning Operator with different beneficiary, forger and withdraw address", async () => {
            let slot = 7;
            let amount = 5;
            let amountWei = web3.utils.toWei(amount.toString(), "ether");

            // operator makes a bid
            let initBalOp0 = await getEtherBalance(operators[0].address);
            let bidBalance0 = Number(await insRollupPoB.bidBalance(operators[0].address));
            let bidBalance0Ether = Number(web3.utils.fromWei(bidBalance0.toString(), "ether"));
            const resBid = await insRollupPoB.bidRelayAndWithdrawAddress(slot, beneficiaryAddress, forgerAddress,
                withdrawAddress, { from: operators[0].address, value: amountMinBid });
            let balOp0 = await getEtherBalance(operators[0].address);
            expect(resBid.logs[0].event).to.be.equal("newBestBid");
            expect(Math.ceil(balOp0)).to.be.equal(Math.ceil(initBalOp0 - amountMinBidEther));

            // check winner
            let winner = await insRollupPoB.slotWinner(slot);
            expect(winner.forgerAddress).to.be.equal(forgerAddress);
            expect(winner.beneficiaryAddress).to.be.equal(beneficiaryAddress);
            expect(winner.bonusAddress).to.be.equal(operators[0].address);
            expect(winner.withdrawAddress).to.be.equal(withdrawAddress);

            // operator overbid
            let initBalOp1 = await getEtherBalance(operators[1].address);
            const resBid2 = await insRollupPoB.bid(slot,{
                from: operators[1].address, value: amountWei
            });
            let balOp1 = await getEtherBalance(operators[1].address);
            expect(resBid2.logs[0].event).to.be.equal("newBestBid");
            expect(Math.ceil(balOp1)).to.be.equal(Math.ceil(initBalOp1 - amount));

            // first operator withdraws his amount
            let initBalWithdrawAddress = await getEtherBalance(withdrawAddress);
            let withdrawBid = await insRollupPoB.withdrawBid(withdrawAddress);
            try {
                await insRollupPoB.withdraw({from: operators[0].address});
            } catch (error) {
                expect((error.message).includes("You cannot withdraw the amount")).to.be.equal(true);
            }
            let amountTotalBid = Number(amountMinBid) + bidBalance0;
            await insRollupPoB.withdraw({from: withdrawAddress});
            let balWithdrawAddress = await getEtherBalance(withdrawAddress);
            expect(withdrawBid.toString()).to.be.equal(amountTotalBid.toString());
            expect(Math.ceil(balWithdrawAddress)).to.be.equal(Math.ceil(initBalWithdrawAddress + amountMinBidEther + bidBalance0Ether));
        });

        it("Add Winning Operator with different beneficiary, forger, withdraw address and bonus address", async () => {
            let slot = 8;
            let amount = 5;
            let amountWei = web3.utils.toWei(amount.toString(), "ether");

            // operator makes a bid
            let initBalOp0 = await getEtherBalance(operators[0].address);
            let op0initBidBalance = await insRollupPoB.bidBalance(operators[0].address);
            let bonusInitBidBalance = await insRollupPoB.bidBalance(bonusAddress);
            const resBid = await insRollupPoB.bidWithDifferentAddresses(slot, beneficiaryAddress, forgerAddress,
                withdrawAddress, bonusAddress, false, { from: operators[0].address, value: amountMinBid });
            let balOp0 = await getEtherBalance(operators[0].address);
            expect(resBid.logs[0].event).to.be.equal("newBestBid");
            expect(Math.ceil(balOp0)).to.be.equal(Math.ceil(initBalOp0 - amountMinBidEther));

            // check winner
            let winner = await insRollupPoB.slotWinner(slot);
            expect(winner.forgerAddress).to.be.equal(forgerAddress);
            expect(winner.beneficiaryAddress).to.be.equal(beneficiaryAddress);
            expect(winner.bonusAddress).to.be.equal(bonusAddress);
            expect(winner.withdrawAddress).to.be.equal(withdrawAddress);

            // operator overbid
            let initBalOp1 = await getEtherBalance(operators[1].address);
            const resBid2 = await insRollupPoB.bid(slot, {
                from: operators[1].address, value: amountWei
            });
            let balOp1 = await getEtherBalance(operators[1].address);
            expect(resBid2.logs[0].event).to.be.equal("newBestBid");
            expect(Math.ceil(balOp1)).to.be.equal(Math.ceil(initBalOp1 - amount));

            // check bidBalance of bonusAddress
            let op0BidBalance = await insRollupPoB.bidBalance(operators[0].address);
            let bonusBidBalance = await insRollupPoB.bidBalance(bonusAddress);
            expect(op0initBidBalance.toString()).to.be.equal(op0BidBalance.toString());
            expect(bonusBidBalance.toString()).to.be.equal(Math.ceil(bonusInitBidBalance + amountMinBid * 0.1).toString());

            // operator overbid with bonusAddress without using bidBalance
            let initBonusBidBalance_2 = await insRollupPoB.bidBalance(bonusAddress);
            let amountWei10 = web3.utils.toWei("10", "ether");
            const resBid3 = await insRollupPoB.bidWithDifferentAddresses(slot, beneficiaryAddress, forgerAddress,
                withdrawAddress, bonusAddress, false, { from: operators[0].address, value: amountWei10 });
            expect(resBid3.logs[0].event).to.be.equal("newBestBid");

            let bonusBidBalance_2 = await insRollupPoB.bidBalance(bonusAddress);
            expect(initBonusBidBalance_2.toString()).to.be.equal(bonusBidBalance_2.toString());

            // operator overbid
            let amountWei15 = web3.utils.toWei("15", "ether");
            const resBid4 = await insRollupPoB.bid(slot,{
                from: operators[1].address, value: amountWei15
            });
            expect(resBid4.logs[0].event).to.be.equal("newBestBid");
            
            // acumulate bidBalance operator0
            let bonusBidBalance_3 = await insRollupPoB.bidBalance(bonusAddress);
            expect(Number(initBonusBidBalance_2) + amountWei10 * 0.1).to.be.equal(Number(bonusBidBalance_3));

            // operator overbid with bonusAddress using bidBalance
            let amountWei20 = web3.utils.toWei("20", "ether");
            const resBid5 = await insRollupPoB.bidWithDifferentAddresses(slot, beneficiaryAddress, forgerAddress,
                withdrawAddress, bonusAddress, true, { from: operators[0].address, value: amountWei20 });
            expect(resBid5.logs[0].event).to.be.equal("newBestBid");

            let bonusBidBalance_4 = await insRollupPoB.bidBalance(bonusAddress);
            expect(bonusBidBalance_4.toString()).to.be.equal("0");
        });

        it("commit and forge batch", async () => {
            const slot = 9;
            const nLevels = 24;
            const maxTx = 10;
            // non-empty off-chain tx with 10 maxTx
            const tx = {
                fromIdx: 1,
                toIdx: 2,
                amount: 50,
            };
            const bb = await rollupDB.buildBatch(maxTx, nLevels);
            await bb.addTx(tx);
            await bb.build();
            const compressedTxTest = await bb.getDataAvailable();
            const hashOffChain = await bb.getOffChainHash().toString();

            const proofA = ["0", "0"];
            const proofB = [["0", "0"], ["0", "0"]];
            const proofC = ["0", "0"];
            const input = ["0", "0", "0", hashOffChain , "0", "0", "0", "0"];

            // reset rollup PoB
            insRollupPoB = await RollupPoB.new(addressRollupTest, maxTx);
            await insRollupPoB.setBlockNumber(slotBlock[0]);
            // operator makes a bid
            await insRollupPoB.bid(slot, {
                from: operators[0].address, value: amountMinBid
            });
            // set the slot that the previous operator has won
            await insRollupPoB.setBlockNumber(slotBlock[slot]);

            // check commit hash
            const resCommit = await insRollupPoB.commitBatch(compressedTxTest, {from: operators[0].address});
            expect(resCommit.logs[0].event).to.be.equal("dataCommitted");
            expect(resCommit.logs[0].args.hashOffChain.toString()).to.be.equal(hashOffChain);

            // Get compressedTx from block number
            // Since we are changing the block number for testing purposes
            // we need to get 'block number' from 'receipt' instead of getting it from event
            const transaction = await web3.eth.getTransactionFromBlock(resCommit.receipt.blockNumber);
            const decodedData = abiDecoder.decodeMethod(transaction.input);
            let inputRetrieved;
            decodedData.params.forEach(elem => {
                if (elem.name == "compressedTx") {
                    inputRetrieved = elem.value;
                }
            });
            expect("0x" + compressedTxTest.toString("hex")).to.be.equal(inputRetrieved);

            // Try to commit a batch with another already committed
            try {
                await insRollupPoB.commitBatch(compressedTxTest, {from: operators[0].address});
            } catch(error) {
                expect((error.message).includes("there is data which is not forged")).to.be.equal(true);
            }
            // Forge batch
            await insRollupPoB.forgeCommittedBatch(proofA, proofB, proofC, input, {from: operators[0].address});
            
            // Try to forge a batch without commited data
            try {
                await insRollupPoB.forgeCommittedBatch(proofA, proofB, proofC, input, {from: operators[0].address});
            } catch (error) {
                expect((error.message).includes("There is no committed data")).to.be.equal(true);
            }

        });

        it("Forge other operator after deadline", async () => {
            const nLevels = 24;
            const maxTx = 10;
            const slot = 10;
            // non-empty off-chain tx with 10 maxTx
            const tx = {
                fromIdx: 1,
                toIdx: 2,
                amount: 50,
            };
            const bb = await rollupDB.buildBatch(maxTx, nLevels);
            await bb.addTx(tx);
            await bb.build();
            const compressedTxTest = await bb.getDataAvailable();
            const hashOffChain = await bb.getOffChainHash().toString();

            const proofA = ["0", "0"];
            const proofB = [["0", "0"], ["0", "0"]];
            const proofC = ["0", "0"];
            const input = ["0", "0", "0", hashOffChain , "0", "0", "0", "0"];

            // reset rollup PoB
            insRollupPoB = await RollupPoB.new(addressRollupTest, maxTx);
            await insRollupPoB.setBlockNumber(slotBlock[0]);
            // operator makes a bid
            await insRollupPoB.bid(slot, {
                from: operators[0].address, value: amountMinBid
            });
            // set the slot that the previous operator has won but after the deadline block
            await insRollupPoB.setBlockNumber(slotBlock[slot+1] - deadlineBlocks);
            // commits and forges another operator who has not won the auction
            await insRollupPoB.commitAndForgeDeadline(compressedTxTest, proofA, proofB, proofC, input, {from: operators[1].address});
        });


        it("Try forging but another operator has already committed data", async () => {
            const nLevels = 24;
            const maxTx = 10;
            const slot = 11;
            // non-empty off-chain tx with 10 maxTx
            const tx = {
                fromIdx: 1,
                toIdx: 2,
                amount: 50,
            };
            const bb = await rollupDB.buildBatch(maxTx, nLevels);
            await bb.addTx(tx);
            await bb.build();
            const compressedTxTest = await bb.getDataAvailable();
            const hashOffChain = await bb.getOffChainHash().toString();

            const proofA = ["0", "0"];
            const proofB = [["0", "0"], ["0", "0"]];
            const proofC = ["0", "0"];
            const input = ["0", "0", "0", hashOffChain , "0", "0", "0", "0"];

            // reset rollup PoB
            insRollupPoB = await RollupPoB.new(addressRollupTest, maxTx);
            await insRollupPoB.setBlockNumber(slotBlock[0]);
            await insRollupPoB.bid(slot, {
                from: operators[0].address, value: amountMinBid
            });
            // set the slot that the previous operator has won
            await insRollupPoB.setBlockNumber(slotBlock[slot]);
            // slot winner commits data
            await insRollupPoB.commitBatch(compressedTxTest, {from: operators[0].address});
            // set the block of the same slot but after deadline
            await insRollupPoB.setBlockNumber(slotBlock[slot+1] - deadlineBlocks);
            // try to commit data when the winner has already committed data
            try {
                await insRollupPoB.commitAndForgeDeadline(compressedTxTest, proofA, proofB, proofC, input, {from: operators[1].address});
            } catch (error) {
                expect((error.message).includes("another operator has already submitted data")).to.be.equal(true);
            }
            await insRollupPoB.forgeCommittedBatch(proofA, proofB, proofC, input, {from: operators[0].address});
            // try to forge data when the winner has already forge data
            try {
                await insRollupPoB.commitAndForgeDeadline(compressedTxTest, proofA, proofB, proofC, input, {from: operators[1].address});
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
                fromIdx: 1,
                toIdx: 2,
                amount: 50,
            };
            const bb = await rollupDB.buildBatch(maxTx, nLevels);
            await bb.addTx(tx);
            await bb.build();
            const compressedTxTest = await bb.getDataAvailable();
            const hashOffChain = await bb.getOffChainHash().toString();

            const proofA = ["0", "0"];
            const proofB = [["0", "0"], ["0", "0"]];
            const proofC = ["0", "0"];
            const input = ["0", "0", "0", hashOffChain , "0", "0", "0", "0"];

            // reset rollup PoB
            insRollupPoB = await RollupPoB.new(addressRollupTest, maxTx);
            await insRollupPoB.setBlockNumber(slotBlock[0]);
            await insRollupPoB.bid(slot, {
                from: operators[0].address, value: amountMinBid
            });
            // set the slot that the previous operator has won
            await insRollupPoB.setBlockNumber(slotBlock[slot]);
            // try to forge another operator before the deadline
            try {
                await insRollupPoB.commitAndForgeDeadline(compressedTxTest, proofA, proofB, proofC, input, {from: operators[1].address});
            } catch (error) {
                expect((error.message).includes("not possible to commit data before deadline")).to.be.equal(true);
            }
            // try to commit data another operator
            try {
                await insRollupPoB.commitBatch(compressedTxTest, {from: operators[1].address});
            } catch (error) {
                expect((error.message).includes("forgerAddress")).to.be.equal(true);
            }
            
        });

        it("Commit invalid", async () => {
            const nLevels = 24;
            const maxTx = 10;
            const slot = 13;
            // non-empty off-chain tx with 10 maxTx
            const tx = {
                fromIdx: 1,
                toIdx: 2,
                amount: 50,
            };
            const bb = await rollupDB.buildBatch(maxTx, nLevels);
            await bb.addTx(tx);
            await bb.build();
            const compressedTxTest = await bb.getDataAvailable();

            // reset rollup PoB
            insRollupPoB = await RollupPoB.new(addressRollupTest, maxTx);
            await insRollupPoB.setBlockNumber(slotBlock[0]);
            await insRollupPoB.bid(slot, {
                from: operators[0].address, value: amountMinBid
            });
            // set the slot that the previous operator has NOT won
            await insRollupPoB.setBlockNumber(slotBlock[2]);
            // try to commit data in the wrong slot
            try {
                await insRollupPoB.commitBatch(compressedTxTest, {from: operators[0].address});
            } catch(err) {
                expect((err.message).includes("message sender must be forgerAddress")).to.be.equal(true);
            }
            // set the slot that the previos operator has won
            await insRollupPoB.setBlockNumber(slotBlock[slot]);
            // try to commit data another operator
            try {
                await insRollupPoB.commitBatch(compressedTxTest, {from: operators[1].address});
            } catch(err) {
                expect((err.message).includes("message sender must be forgerAddress")).to.be.equal(true);
            }
        });


        it("More options in the auction", async () => {
            let slot = 14;

            let amount05 = 0.5;
            let amount5 = 5 ;
            let amount10 = 10;

            let amountWei05 = web3.utils.toWei(amount05.toString(), "ether");
            let amountWei5 = web3.utils.toWei(amount5.toString(), "ether");
            let amountWei10 = web3.utils.toWei(amount10.toString(), "ether");

            const nLevels = 24;
            const maxTx = 10;
            const tx = {
                fromIdx: 1,
                toIdx: 2,
                amount: 50,
            };
            const bb = await rollupDB.buildBatch(maxTx, nLevels);
            await bb.addTx(tx);
            await bb.build();
            const compressedTxTest = await bb.getDataAvailable();
            const hashOffChain = await bb.getOffChainHash().toString();

            const proofA = ["0", "0"];
            const proofB = [["0", "0"], ["0", "0"]];
            const proofC = ["0", "0"];
            const input = ["0", "0", "0", hashOffChain , "0", "0", "0", "0"];
            
            // try to bid for a slot too close
            await insRollupPoB.setBlockNumber(slotBlock[slot-2]);
            try {
                await insRollupPoB.bid(slot-2, {
                    from: operators[0].address, value: amountWei05
                });
            } catch (error) {
                expect((error.message).includes("This auction is already closed")).to.be.equal(true);
            }
            // try to bid for a slot with too small amount
            try {
                await insRollupPoB.bid(slot, {
                    from: operators[0].address, value: amountWei05
                });
            } catch (error) {
                expect((error.message).includes("Ether send not enough to enter auction")).to.be.equal(true);
            }
            // operator makes a valid bid
            const resBid = await insRollupPoB.bid(slot, {
                from: operators[0].address, value: amountMinBid
            });
            expect(resBid.logs[0].event).to.be.equal("newBestBid");
            // try to bid that without exceeding 30% of the previous
            try {
                await insRollupPoB.bid(slot, {
                    from: operators[1].address, value: amountMinBid
                });
            } catch (error) {
                expect((error.message).includes("Ether send not enough to outbid current bid")).to.be.equal(true);
            }

            const resBid2 = await insRollupPoB.bid(slot, {
                from: operators[1].address, value: amountWei5 });
            expect(resBid2.logs[0].event).to.be.equal("newBestBid");

            try {
                await insRollupPoB.bid(slot, {
                    from: operators[2].address, value: amountWei5
                });
            } catch (error) {
                expect((error.message).includes("Ether send not enough to outbid current bid")).to.be.equal(true);
            }

            const resBid3 = await insRollupPoB.bid(slot, {
                from: operators[2].address, value: amountWei10 });
            expect(resBid3.logs[0].event).to.be.equal("newBestBid");

            await insRollupPoB.setBlockNumber(slotBlock[slot]);
            // try to commit data an operator that is not the winner
            try {
                await insRollupPoB.commitBatch(compressedTxTest, {from: operators[0].address});
            } catch(err) {
                expect((err.message).includes("message sender must be forgerAddress")).to.be.equal(true);
            }
            // try to commit data an operator that is not the winner
            try {
                await insRollupPoB.commitBatch(compressedTxTest, {from: operators[1].address});
            } catch(err) {
                expect((err.message).includes("message sender must be forgerAddress")).to.be.equal(true);
            }
            // commit data the correct operator
            const resCommit = await insRollupPoB.commitBatch(compressedTxTest, {from: operators[2].address});
            expect(resCommit.logs[0].event).to.be.equal("dataCommitted");

            // try to forge an operator that is not the winner
            try {
                await insRollupPoB.forgeCommittedBatch(proofA, proofB, proofC, input, {from: operators[0].address});
            } catch (error) {
                expect((error.message).includes("message sender must be forgerAddress")).to.be.equal(true);
            }
            // try to forge an operator that is not the winner
            try {
                await insRollupPoB.forgeCommittedBatch(proofA, proofB, proofC, input, {from: operators[1].address});
            } catch (error) {
                expect((error.message).includes("message sender must be forgerAddress")).to.be.equal(true);
            }
            // forge the winner
            await insRollupPoB.forgeCommittedBatch(proofA, proofB, proofC, input, {from: operators[2].address});
            // try to forge again
            try {
                await insRollupPoB.forgeCommittedBatch(proofA, proofB, proofC, input, {from: operators[2].address});
            } catch (error) {
                expect((error.message).includes("There is no committed data")).to.be.equal(true);
            }
        });

        it("Using bidBalance", async () => {
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

            const resBid = await insRollupPoB.bid(slot, {
                from: operators[4].address, value: amountWei10
            });
            expect(resBid.logs[0].event).to.be.equal("newBestBid");
            const resBid2 = await insRollupPoB.bid(slot, {
                from: operators[5].address, value: amountWei13
            });
            expect(resBid2.logs[0].event).to.be.equal("newBestBid");

            // bidBalance[op4] = 1
            // 1.3 * 13 = 16.9 --> minBid = 16.9 - bidBalance[op4] = 15.9
            // try to bid with bid < 15.9
            try {
                await insRollupPoB.bid(slot, {
                    from: operators[4].address, value: amountWeiX
                });
            } catch (error) {
                expect((error.message).includes("Ether send not enough to outbid current bid")).to.be.equal(true);
            }
            // operator makes a bid with bid = 15.9
            const resBid3 = await insRollupPoB.bid(slot, {
                from: operators[4].address, value: amountWeiXX
            });
            expect(resBid3.logs[0].event).to.be.equal("newBestBid");

            // bidBalance[op4] = 0
            // 1.3 * 16.9 = 22 --> minBid = 22 - bidBalance[op4] = 22
            // try to bid with bid < 22
            try {
                await insRollupPoB.bid(slot, {
                    from: operators[4].address, value: amountWeiY
                });
            } catch (error) {
                expect((error.message).includes("Ether send not enough to outbid current bid")).to.be.equal(true);
            }
            // operator makes a bid with bid = 22
            const resBid4 = await insRollupPoB.bid(slot, {
                from: operators[4].address, value: amountWeiYY
            });
            expect(resBid4.logs[0].event).to.be.equal("newBestBid");
            
        });
    });
});