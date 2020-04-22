/* eslint-disable no-underscore-dangle */
/* eslint-disable no-await-in-loop */
/* global artifacts */
/* global contract */
/* global web3 */

const chai = require("chai");
const Scalar = require("ffjavascript").Scalar;

const { expect } = chai;
const RollupPoS = artifacts.require("../contracts/test/RollupPoSTest");
const { getEtherBalance} = require("./helpers/helpers");

contract("RollupPoS", (accounts) => {
    const {
        0: owner,
    } = accounts;

    let insRollupPoS;
    const maxTx = 10;
    const url = "localhost";

    const addressRollupTest = "0x0000000000000000000000000000000000000001";
    const operators = [];
    const eraBlock = [];
    const eraSlot = [];
    const hashChain = [];
    let raffleWinner = [];
    const blockPerEra = 2000;
    const slotPerEra = 20;

    const initialMsg = "rollup";
    hashChain.push(web3.utils.keccak256(initialMsg));
    for (let i = 1; i < 10; i++) {
        hashChain.push(web3.utils.keccak256(hashChain[i - 1]));
    }

    before(async () => {
    // Deploy token test
        insRollupPoS = await RollupPoS.new(addressRollupTest, maxTx);
        // Check ganache provider
        let balance = await getEtherBalance(owner);
        if ((accounts.length < 100) || (balance < 1000)) {
            throw new Error("launch ganache with more than 100 accounts and enough ether on each account:\n\n`ganache-cli -a 100 --defaultBalanceEther 1000000`");
        }
    });

    describe("staker tree", () => {
        it("get genesis block", async () => {
            // fill 99 addresses for operators
            for (let i = 1; i < 99; i++) {
                operators.push({ address: accounts[i], idOp: (i - 1).toString() });
            }
            // get genesis block
            const genesisBlockNum = await insRollupPoS.genesisBlock();
            expect(genesisBlockNum.toString()).to.be.equal(Scalar.e(1000).toString());
            // fill with first block of each era
            for (let i = 0; i < 20; i++) {
                eraBlock.push(i * blockPerEra + Number(genesisBlockNum) + 1);
                eraSlot.push(i * slotPerEra + 1);
            }
            // set first era block
            await insRollupPoS.setBlockNumber(eraBlock[0]);
            // check block has been settled
            const currentBlock = await insRollupPoS.getBlockNumber();
            expect(currentBlock.toString()).to.be.equal(Scalar.e(1001).toString());
        });

        it("add 2 operators", async () => {
            // add operator 0 with eStake = 4
            await insRollupPoS.addOperator(hashChain[9], url,
                { from: operators[0].address, value: web3.utils.toWei("4", "ether") });
            // add operator 1 with eStake = 4
            await insRollupPoS.addOperator(hashChain[9], url,
                { from: operators[1].address, value: web3.utils.toWei("2", "ether") });
            // move to era 2, where there are two operators
            await insRollupPoS.setBlockNumber(eraBlock[2]);

            //4 ether means 4000 finneys, 4000^1.25 = 31810 --> 31812 ( cause error from square root aproximation )
            //2 ether means 2000 finneys, 2000^1.25 = 13374 --> 13375 ( cause error from square root aproximation )
            //Total: 31812 + 13375 = 45187
            // get raffle winner for era 2 for different lucky numbers
            let winner = await insRollupPoS.getRaffleWinnerTest(eraSlot[2], 31811); 
            expect(winner.toString()).to.be.equal(operators[0].idOp);

            winner = await insRollupPoS.getRaffleWinnerTest(eraSlot[2], 31812);
            expect(winner.toString()).to.be.equal(operators[1].idOp);

            winner = await insRollupPoS.getRaffleWinnerTest(eraSlot[2], 31811 + 45187);
            expect(winner.toString()).to.be.equal(operators[0].idOp);

            winner = await insRollupPoS.getRaffleWinnerTest(eraSlot[2], 31812 + 45187);
            expect(winner.toString()).to.be.equal(operators[1].idOp);
        });

        it("add/remove operators (same era)", async () => {
            const numOp2Add = 12;
            const numOp2Remove = 8;
            // restart smart contract
            insRollupPoS = await RollupPoS.new(addressRollupTest, maxTx);
            // set first era block
            await insRollupPoS.setBlockNumber(eraBlock[0]);
            // Add operators
            for (let i = 0; i < numOp2Add; i++) {
                await insRollupPoS.addOperator(hashChain[9], url,
                    { from: operators[i].address, value: web3.utils.toWei("2", "ether") });
                raffleWinner.push(13375 * i);
            }
            // remove operators
            for (let i = 0; i < numOp2Remove; i++) {
                await insRollupPoS.removeOperator(operators[i].idOp, { from: operators[i].address });
            }
            // move to era 2
            await insRollupPoS.setBlockNumber(eraBlock[2]);
            // store all winners
            const winners = [];
            for (let i = 0; i < numOp2Add; i++) {
                const winner = await insRollupPoS.getRaffleWinnerTest(eraSlot[2], raffleWinner[i]);
                winners.push(Number(winner));
            }
            // Check operator removed is not on the list
            // Check other operators are on the list
            for (let i = 0; i < numOp2Add; i++) {
                const isOnList = winners.includes(i);
                if (i < numOp2Remove) {
                    expect(isOnList).to.be.equal(false);
                } else expect(isOnList).to.be.equal(true);
            }
        });

        it("add/remove multiple operators (diff era)", async () => {
            const numOp2Add = 12;
            for (let i = 0; i < numOp2Add; i++) {
                raffleWinner = [];
                // restart smart contract
                insRollupPoS = await RollupPoS.new(addressRollupTest, maxTx);
                // set first era block
                await insRollupPoS.setBlockNumber(eraBlock[0]);
                // add numOp2Add operators with eStake = 13375
                for (let n = 0; n < numOp2Add; n++) {
                    await insRollupPoS.addOperator(hashChain[9], url,
                        { from: operators[n].address, value: web3.utils.toWei("2", "ether") });
                    raffleWinner.push(13375 * n);
                }
                // move to era 1
                await insRollupPoS.setBlockNumber(eraBlock[1]);
                // remove operator
                await insRollupPoS.removeOperator(operators[i].idOp, { from: operators[i].address });
                // move to era 3, where there are the operators
                await insRollupPoS.setBlockNumber(eraBlock[3]);
                // store all winners
                const winners = [];
                for (let p = 0; p < numOp2Add; p++) {
                    const winner = await insRollupPoS.getRaffleWinnerTest(eraSlot[3], raffleWinner[p]);
                    winners.push(Number(winner));
                }
                // Check operator removed is not on the list
                // Check other operators are on the list
                for (let t = 0; t < numOp2Add; t++) {
                    const isOnList = winners.includes(t);
                    if (t === i) {
                        expect(isOnList).to.be.equal(false);
                    } else expect(isOnList).to.be.equal(true);
                }
            }
        });

        it("remove all operators", async () => {
            raffleWinner = [];
            const numOp2Add = 18;
            const op2Remove = [4, 9, 11, 16];
            insRollupPoS = await RollupPoS.new(addressRollupTest, maxTx);
            await insRollupPoS.setBlockNumber(eraBlock[0]);
            for (let i = 0; i < numOp2Add; i++) {
                await insRollupPoS.addOperator(hashChain[9], url,
                    { from: operators[i].address, value: web3.utils.toWei("2", "ether") });
                raffleWinner.push(13375 * i);
            }
            await insRollupPoS.setBlockNumber(eraBlock[1]);
            // remove operators
            op2Remove.forEach(async (opId) => {
                await insRollupPoS.removeOperator(operators[opId].idOp, { from: operators[opId].address });
            });
            await insRollupPoS.setBlockNumber(eraBlock[3]);
            // store all winners
            let winners = [];
            for (let i = 0; i < numOp2Add; i++) {
                const winner = await insRollupPoS.getRaffleWinnerTest(eraSlot[3], raffleWinner[i]);
                winners.push(Number(winner));
            }
            // check winners list
            for (let i = 0; i < numOp2Add; i++) {
                const isOnList = winners.includes(i);
                if (op2Remove.includes(i)) {
                    expect(isOnList).to.be.equal(false);
                } else expect(isOnList).to.be.equal(true);
            }
            // check era 2 remains equal after removing operators
            winners = [];
            for (let i = 0; i < numOp2Add; i++) {
                const winner = await insRollupPoS.getRaffleWinnerTest(eraSlot[2], raffleWinner[i]);
                expect(winner.toString()).to.be.equal(operators[i].idOp);
            }

            await insRollupPoS.setBlockNumber(eraBlock[1]);
            // remove the rest of operators
            winners.forEach(async (opId) => {
                await insRollupPoS.removeOperator(operators[opId].idOp, { from: operators[opId].address });
            });
            // move to era 3, where there are the operators
            await insRollupPoS.setBlockNumber(eraBlock[3]);
            // test raffle winner --> should trigger error that there are no stakers
            try {
                await insRollupPoS.getRaffleWinnerTest(eraSlot[3], raffleWinner[0]);
            } catch (error) {
                expect((error.message).includes("Must be stakers")).to.be.equal(true);
            }
        });

        it("remove operator twice", async () => {
            // removed previously
            try {
                await insRollupPoS.removeOperator(operators[4].idOp, { from: operators[4].address });
            } catch (error) {
                expect((error.message).includes("Operator has been already removed")).to.be.equal(true);
            }
            await insRollupPoS.setBlockNumber(eraBlock[4]);
            // try to remove operator in the next era
            try {
                await insRollupPoS.removeOperator(operators[4].idOp, { from: operators[4].address });
            } catch (error) {
                expect((error.message).includes("Operator has been already removed")).to.be.equal(true);
            }
        });

        it("remove unexistent operator", async () => {
            try {
                await insRollupPoS.removeOperator(operators[22].idOp, { from: operators[22].address });
            } catch (error) {
                expect((error.message).includes("Operator does not exist")).to.be.equal(true);
            }
        });
    });
});
