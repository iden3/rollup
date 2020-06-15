/* eslint-disable no-underscore-dangle */
/* eslint-disable no-await-in-loop */
/* global artifacts */
/* global contract */
/* global web3 */

// REQUIREMENTS

const { expect } = require("chai");
const abiDecoder = require("abi-decoder");
const { stringifyBigInts } = require("ffjavascript").utils;

const RollupBurnAuction = artifacts.require("../contracts/test/RollupBurnAuctionTest");

abiDecoder.addABI(RollupBurnAuction.abi);


contract("RollupBurnAuction", (accounts) => {

    // CONSTANTS

    const defaultAddress = "0x0000000000000000000000000000000000000000";
    const addressRollupTest = "0x0000000000000000000000000000000000000001";
    const BLOCKS_PER_SLOT = 100;
    const DELTA_BLOCKS_INITIAL_SLOT = 1000;
    const badBidMessage = "Your bid doesn't beat the current best";
    const badForgeMessage = "Sender is not current winner";
    const uninitializedAuctionMessage = "Auction has not been initialized";
    const bidEvent = "newBestBid";
    const fakeProof = {
        A: ["0", "0"],
        B: [["0", "0"], ["0", "0"]],
        C: ["0", "0"],
        input: ["0", "0", "0", "0", "0", "0", "0", "0", "0", "0"]
    };
    
    // INITIAL SETUP

    let insRollupBurnAuction;
    let gasPrice;
    before(async () => {
        // init smart contract
        insRollupBurnAuction = await RollupBurnAuction.new(addressRollupTest);
        // get gas price
        gasPrice = await web3.eth.getGasPrice();
        // mine blocks till the first slot begins
        await mineBlocksTillInitialSlot();
    });

    // TEST SUITS

    describe("Rollup Burn Auction: functional test - One entire auction process step by step, then multiple auctions with lots of bids", () => {

        it("slot 0 - Fails bidding on empty auction (slot 2, no account, no amount)", async () => {
            try {
                await insRollupBurnAuction.bid();
                expect("Unexpected success").to.be.equal("This shouldnt have been executed");
            } catch (error) {
                expect(error.reason.includes(badBidMessage)).to.be.equal(true);
            }
        });

        it("slot 0 - Fails forging an uninitialized auction",
            async () => await failForge(
                accounts[0],                                // Beneficiary address
                fakeProof,                                  // Proof
                uninitializedAuctionMessage,                // Fail message
                "reason"                                    // Message type
            )
        );

        it("slot 0 - Fails bidding on empty auction (slot 2, account 0, amount ==  0)",
            async () => await failBid(accounts[0], "0")
        );

        it("slot 0 - Successfully bids on empty auction (slot 2, account 0, amount > 0)",
            async () => await successBid(accounts[0], "2")
        );

        it("slot 0 - Fails bidding on initialized auction (slot 2, account 1, amount <  best bid amount)",
            async () => await failBid(accounts[1], "1.999999999")
        );

        it("slot 0 - Fails bidding on initialized auction (slot 2, account 1, amount ==  best bid amount)",
            async () => await failBid(accounts[1], "2")
        );

        it("slot 0 - Successfully bids on initialized auction (slot 2, account 1, amount >  best bid amount). This action causes a refund",
            async () => await successBid(accounts[1], "2.0000001")
        );

        it("slot 0 => 1 - Moves to the next slot when BLOCKS_PER_SLOT blocks are mined",async () => {
            await mineBlocksTillNextSlot();
            // check winner of first auction (@ slot 2)
            slot = await getAuction(2);
            expect(slot).to.eql({
                operator: accounts[1],
                amount: "2000000100000000000",
                initialized: true
            });
            expect(await getSmartContractBalance()).to.be.equal(2.0000001);
        });

        it("slot 1 - Fails bidding on next auction (slot 3, account 0, amount ==  0)",
            async () => await failBid(accounts[0], "0")
        );

        it("slot 1 - Successfully bids on next auction (slot 3, account 0, amount > 0).",
            async () => await successBid(accounts[0], "1")
        );

        it("slot 1 => 2 - Moves to the next slot when BLOCKS_PER_SLOT blocks are mined", async () => {
            await mineBlocksTillNextSlot();
            // Check first forger and second winner
            slots = await Promise.all([getAuction(2), getAuction(3)]);
            expect(slots).to.eql([
                {
                    operator: accounts[1],
                    amount: "2000000100000000000",
                    initialized: true
                },
                {
                    operator: accounts[0],
                    amount: "1000000000000000000",
                    initialized: true
                }
            ]);
            expect(await getSmartContractBalance()).to.be.equal(3.0000001);
        });

        it("slot 2 - Fails Forging batch (unauthorized operator)",
            async () => await failForge(
                accounts[0],                                // Beneficiary address
                fakeProof,                                  // Proof
                badForgeMessage,                            // Fail message
                "reason"                                    // Message type
            )
        );

        it("slot 2 - Successfully forges batch",
            async () => await successForge(accounts[1], fakeProof)
        );

        it("slot 2 - Bids nBids times on the current auction (slot 4), forward 2 slots and check status. Note that there will be a slot that wont receive bids", async () => {
            // Do nBids
            const nBids = 20;
            let bestBid = {
                amount: 0,
                addr: ""
            }
            // small number of participants to increase probability of same bidder beating his own bid
            const nParticipants = accounts.length < 3 ? accounts.length : 3;
            for (let i = 0; i < nBids; i++) {
                // choose a random bidder
                const addr = accounts[Math.floor((Math.random() * nParticipants))];
                // alternate between succesfull and unsuccesfull bid
                const amount = i%2? Math.floor((bestBid.amount + 0.000001)*100000000)/100000000 : bestBid.amount;
                if (amount > bestBid.amount) {
                    await successBid(addr, `${amount}`);
                    bestBid = {amount, addr};
                }
                else await failBid(addr, `${amount}`);
            }

            // Forward two slots
            await mineBlocksTillNextSlot();
            await mineBlocksTillNextSlot();
            // Extra bid just for fun
            await successBid(accounts[0], "0.0000001");

            // Get auction status
            const slots = await Promise.all([
                await getAuction(4),
                await getAuction(5),
                await getAuction(6)
            ]);

            // Check results
            expect(slots).to.eql([
                {
                    operator: bestBid.addr,
                    amount: web3.utils.toWei(`${bestBid.amount}`, "ether"),
                    initialized: true
                },
                {
                    operator: defaultAddress,
                    amount: "0",
                    initialized: false
                },
                {
                    operator: accounts[0],
                    amount: "100000000000",
                    initialized: true
                },
            ]);
            expect((await getSmartContractBalance()).toFixed(5)).to.be.equal((3.0000002 + bestBid.amount).toFixed(5));
        });
    });

    // TEST FUNCTIONS

    async function mineBlocksTillInitialSlot() {
        // Get current slot and block
        const genesisSlot = await getSlot();
        const currentBlock = parseInt(stringifyBigInts(await insRollupBurnAuction.getBlockNumber()));
        // Forward enought blocks to get to the inital slot
        await insRollupBurnAuction.setBlockNumber(currentBlock + DELTA_BLOCKS_INITIAL_SLOT);
        // Check results
        const currentSlot = await getSlot();
        expect(genesisSlot + currentSlot).to.equal(0);
    };

    async function mineBlocksTillNextSlot() {
        // Get current slot and block
        const currentSlot = await getSlot();
        const currentBlock = parseInt(stringifyBigInts(await insRollupBurnAuction.getBlockNumber()));
        // Forward enought blocks to get to next slot
        await insRollupBurnAuction.setBlockNumber(currentBlock + BLOCKS_PER_SLOT);
        // Check results
        const nextSlot = await getSlot();
        expect(nextSlot - currentSlot). to.equal(1);
    };

    async function successBid(addr, bid) {
        // Get status before new bid
        const bidWei = web3.utils.toWei(bid, "ether");
        const newBidderPrevBalance = await getEtherBalance(addr);
        const prevBestBid = await getCurrentAuction();
        const oldBidderPrevBalnce = await getEtherBalance(prevBestBid.operator);
        
        // Bid and get updated balance
        const event = await insRollupBurnAuction.bid({
            from: addr,
            value: bidWei
        });
        
        // Get updated status after bidding
        const eventName = event.logs[0].event;
        const bidRes = stringifyBigInts(event.logs[0].args);
        const paidInGas = parseFloat(web3.utils.fromWei(`${event.receipt.gasUsed * gasPrice}`, 'ether'));
        const newBidderNxtBalance = await getEtherBalance(addr);
        const oldBidderNxtBalance = await getEtherBalance(prevBestBid.operator);

        // Check results
        expect(eventName).to.be.equal(bidEvent);
        expect(bidRes.amount).to.be.equal(bidWei);
        
        // If the previous bidder and the current bidder are the same
        if (addr === prevBestBid.operator) {
            // Ignore address 0
            if (prevBestBid.operator !== defaultAddress) {
                let prevBid = 0;
                // if the previous auction and the current auction are the same (same slot) (refund situation)
                if (prevBestBid.slot == bidRes.slot) 
                    prevBid = parseFloat(web3.utils.fromWei(prevBestBid.amount, 'ether'));
                const diff = Math.abs(newBidderNxtBalance - (newBidderPrevBalance - parseFloat(bid) - paidInGas + prevBid));
                expect(diff.toFixed(2)).to.be.equal("0.00");
            }
        }
        // If the previous bidder and the current bidder are NOT the same
        else {
            const diff = Math.abs(newBidderNxtBalance - (newBidderPrevBalance - parseFloat(bid) - paidInGas));
            expect(diff.toFixed(2)).to.be.equal("0.00");
            // if the previous auction and the current auction are the same (same slot ==> refund) + Ignore address 0
            if (prevBestBid.slot == bidRes.slot && prevBestBid.operator !== defaultAddress) {
                const prevBid = parseFloat(web3.utils.fromWei(`${prevBestBid.amount}`, 'ether'))
                expect(Math.abs(oldBidderPrevBalnce + prevBid - oldBidderNxtBalance).toFixed(2)).to.be.equal("0.00");
            }
        }
    };

    async function failBid(addr, bid) {
        const oldBalance = await getEtherBalance(addr);
        try {
            // Bid
            await insRollupBurnAuction.bid({
                from: addr,
                value: web3.utils.toWei(bid, "ether")
            });
            // If this line gets executed, the bid has been succesful, force error
            expect("Unexpected success").to.be.equal("This shouldnt have been executed");
        } catch (error) {
            expect(error.reason.includes(badBidMessage)).to.be.equal(true);
            const newBalance = await getEtherBalance(addr);
            expect((Math.abs(oldBalance - newBalance)).toFixed(2)).to.be.equal("0.00");
        }
    };

    async function successForge(addr, proof) {
        // Forge
        await insRollupBurnAuction.forgeBatch(addr, proof.A, proof.B, proof.C, proof.input, [], {
            from: addr,
            value: "0"
        });
    };
    
    async function failForge(addr, proof, failMessage, messageType) {
        try {
            // Forge
            await insRollupBurnAuction.forgeBatch(addr, proof.A, proof.B, proof.C, proof.input, [], {
                from: addr,
                value: "0"
            });
            // If this line gets executed, the forge has been succesful, force error
            expect("Unexpected success").to.be.equal("This shouldnt have been executed");
        } catch (error) {
            // Check results
            expect(error[messageType].includes(failMessage)).to.be.equal(true);
        }
    };

    // HELPER FUNCTIONS

    async function getEtherBalance(address) {
        let balance = await web3.eth.getBalance(address);
        balance = web3.utils.fromWei(balance, "ether");
        return Number(balance);
    };

    async function getSlot() {
        return parseInt( stringifyBigInts( await insRollupBurnAuction.currentSlot() ) );
    };

    async function getAuction(slot) {
        const auction = stringifyBigInts(await insRollupBurnAuction.auction.call(slot));
        return {
            amount:      auction.amount,
            initialized: auction.initialized,
            operator:    auction.operator
        }
    };

    async function getCurrentAuction() {
        const currentSlot = await insRollupBurnAuction.currentSlot();
        const currentAuctionSlot = parseInt(stringifyBigInts(currentSlot)) + 2;
        const currentAucttion = await getAuction(currentAuctionSlot); 
        return stringifyBigInts({
            slot: currentAuctionSlot, 
            ...currentAucttion,
        })
    }

    async function getSmartContractBalance() {
        return await getEtherBalance(insRollupBurnAuction.address);
    }
});