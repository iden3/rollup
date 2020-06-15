/* eslint-disable no-underscore-dangle */
/* eslint-disable no-await-in-loop */
/* global artifacts */
/* global contract */
/* global web3 */

const { expect } = require("chai");
const SMTMemDB = require("circomlib/src/smt_memdb");
const abiDecoder = require("abi-decoder");


const RollupPoS = artifacts.require("../contracts/test/RollupPoSTest");
const RollupDB = require("../../js/rollupdb");
const { exitAx, exitAy, exitEthAddr} = require("../../js/constants");
const { getEtherBalance, getPublicPoSVariables} = require("./helpers/helpers");
const { BabyJubWallet } = require("../../rollup-utils/babyjub-wallet");

abiDecoder.addABI(RollupPoS.abi);

// async function getTxGasSpent(resTx) {
//   const infoTx = await web3.eth.getTransaction(resTx.tx);
//   const { gasPrice } = infoTx;
//   const gasSpent = gasPrice * resTx.receipt.gasUsed;
//   return Number(web3.utils.fromWei(gasSpent.toString(), 'ether'));
// }

contract("RollupPoS", (accounts) => {
    const {
        1: id1,
        6: relayStaker,
        7: beneficiaryAddress,
        9: slashAddress,
    } = accounts;

    let insRollupPoS;
    const url = "localhost";
    const maxTx = 10;

    const addressRollupTest = "0x0000000000000000000000000000000000000001";
    const operators = [];
    const eraBlock = [];
    const eraSlot = [];
    const hashChain = [];
    let blockPerEra;
    let slotPerEra;
    let blocksPerSlot;
    let deadlineBlocks;
    let db;
    let rollupDB;
    let genesisBlock;
    let amountToStake;
    let amountToStakeNumber;

    const wallets = [];
    for (let i = 0; i<10; i++) {
        wallets.push(BabyJubWallet.createRandom());
    }

    const initialMsg = "rollup";
    hashChain.push(web3.utils.keccak256(initialMsg));
    for (let i = 1; i < 10; i++) {
        hashChain.push(web3.utils.keccak256(hashChain[i - 1]));
    }

    async function getIndexHash(opId){
        try {
            const opInfo = await insRollupPoS.operators(opId);
            const currentHash = opInfo.rndHash;
            const index = hashChain.findIndex(hash => hash === currentHash);
            return index;
        } catch (error){
            return -1;
        }
    }

    before(async () => {
    // Deploy token test
        insRollupPoS = await RollupPoS.new(addressRollupTest, maxTx);
        // Initialization
        // fill with first block of each era
        [slotPerEra, blocksPerSlot, blockPerEra, amountToStake, genesisBlock, deadlineBlocks] = await getPublicPoSVariables(insRollupPoS);
        amountToStakeNumber= Number(web3.utils.fromWei(amountToStake, "ether"));
        for (let i = 0; i < 20; i++) {
            eraBlock.push(i * blockPerEra + Number(genesisBlock) + 1);
            eraSlot.push(i * slotPerEra);
        }
        // fill 5 addresses for operators
        for (let i = 1; i < 6; i++) {
            operators.push({ address: accounts[i], idOp: (i - 1).toString() });
        }
        // set first era block
        await insRollupPoS.setBlockNumber(eraBlock[0]);
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

        it("add operator", async () => {
            let initBalOp = await getEtherBalance(operators[0].address);
            // add operator 0 with eStake = 4
            await insRollupPoS.addOperator(hashChain[9], url,
                { from: operators[0].address, value: amountToStake});
            const balOpAdd = await getEtherBalance(operators[0].address);
            expect(Math.ceil(balOpAdd)).to.be.equal(Math.ceil(initBalOp) - amountToStakeNumber);
            // get back stake
            await insRollupPoS.setBlockNumber(eraBlock[3]);
            // try to get back stake from different operator
            try {
                await insRollupPoS.removeOperator(operators[0].idOp, { from: operators[1].address });
            } catch (error) {
                expect((error.message).includes("Sender does not match with operator controller")).to.be.equal(true);
            }
            initBalOp = await getEtherBalance(operators[0].address);
            await insRollupPoS.removeOperator(operators[0].idOp, { from: operators[0].address });

            // Era to remove operator
            await insRollupPoS.setBlockNumber(eraBlock[4]);
            try {
                await insRollupPoS.withdraw(0);
            } catch (error) {
                expect((error.message).includes("Era to withdraw after current era")).to.be.equal(true);
            }
            // Era to remove operator
            await insRollupPoS.setBlockNumber(eraBlock[5]);
            await insRollupPoS.withdraw(0);

            const balOpWithdraw = await getEtherBalance(operators[0].address);
            expect(Math.ceil(initBalOp)).to.be.equal(Math.ceil(balOpWithdraw) - amountToStakeNumber);
        });

        it("add operator with different beneficiary address", async () => {
            const initBalance = await getEtherBalance(beneficiaryAddress);
            await insRollupPoS.setBlockNumber(eraBlock[5]);
            // add operator 1 with eStake = 4
            await insRollupPoS.addOperatorWithDifferentBeneficiary(beneficiaryAddress, hashChain[9], url,
                { from: operators[1].address, value: amountToStake});
            await insRollupPoS.setBlockNumber(eraBlock[6]);
            await insRollupPoS.removeOperator(1, { from: operators[1].address });
            await insRollupPoS.setBlockNumber(eraBlock[8]);
            await insRollupPoS.withdraw(1);
            // Check balance beneficiary Address
            const balance = await getEtherBalance(beneficiaryAddress);
            expect(initBalance + amountToStakeNumber).to.be.equal(balance);
        });

        it("add operator with different beneficiary address and relay staker", async () => {
            const initBalanceRelay = await getEtherBalance(relayStaker);
            const initBalOp = await getEtherBalance(operators[2].address);
            const initBalBeneficiary = await getEtherBalance(beneficiaryAddress);
            await insRollupPoS.setBlockNumber(eraBlock[8]);
            // add operator 2 with stakerAddress commiting 2 ether
            await insRollupPoS.addOperatorRelay(operators[2].address, beneficiaryAddress, hashChain[9], url,
                { from: relayStaker, value: amountToStake});

            const balanceRelay0 = await getEtherBalance(relayStaker);
            const balOp0 = await getEtherBalance(operators[2].address);
            const balBeneficiary0 = await getEtherBalance(beneficiaryAddress);
            // check balances of all addresses
            expect(Math.ceil(initBalanceRelay) - amountToStakeNumber).to.be.equal(Math.ceil(balanceRelay0));
            expect(initBalOp).to.be.equal(balOp0);
            expect(initBalBeneficiary).to.be.equal(balBeneficiary0);
            // sign ethereum message and build signature
            const hashMsg = web3.utils.soliditySha3("RollupPoS", "remove", { type: "uint32", value: operators[2].idOp });
            const sigOp = await web3.eth.sign(hashMsg, operators[2].address);
            const r = sigOp.substring(0, 66);
            const s = `0x${sigOp.substring(66, 130)}`;
            const v = Number(sigOp.substring(130, 132)) + 27;
            // remove operator and withdraw
            await insRollupPoS.setBlockNumber(eraBlock[7]);
            await insRollupPoS.removeOperatorRelay(operators[2].idOp, r, s, v.toString());
            await insRollupPoS.setBlockNumber(eraBlock[9]);
            await insRollupPoS.withdraw(operators[2].idOp);
            // check
            const balanceRelay1 = await getEtherBalance(relayStaker);
            const balOp1 = await getEtherBalance(operators[2].address);
            const balBeneficiary1 = await getEtherBalance(beneficiaryAddress);
            expect(balanceRelay0).to.be.equal(balanceRelay1);
            expect(balOp1).to.be.equal(balOp1);
            expect(balBeneficiary0 + amountToStakeNumber).to.be.equal(balBeneficiary1);
        });

        it("slash operator", async () => {
            const amountToStakeSlash = 20;
            const initBalOp = await getEtherBalance(operators[0].address);
            const initBalanceSlash = await getEtherBalance(slashAddress);
            // reset rollup PoS
            insRollupPoS = await RollupPoS.new(addressRollupTest, maxTx);
            await insRollupPoS.setBlockNumber(eraBlock[0]);
            await insRollupPoS.addOperator(hashChain[9], url,
                { from: operators[0].address, value: web3.utils.toWei(amountToStakeSlash.toString(), "ether") });
            await insRollupPoS.setBlockNumber(eraBlock[1]);
            try {
                await insRollupPoS.slash(eraSlot[2], { from: slashAddress });
            } catch (error) {
                expect((error.message).includes("Slot requested still does not exist")).to.be.equal(true);
            }
            try {
                await insRollupPoS.slash(eraSlot[0], { from: slashAddress });
            } catch (error) {
                expect((error.message).includes("Must be stakers")).to.be.equal(true);
            }
            await insRollupPoS.setBlockNumber(eraBlock[3]);
            // Check balances before slashing
            let balOp = await getEtherBalance(operators[0].address);
            let balSlash = await getEtherBalance(slashAddress);

            expect(Math.ceil(initBalOp)).to.be.equal(Math.ceil(balOp) + amountToStakeSlash);
            expect(Math.ceil(initBalanceSlash)).to.be.equal(Math.ceil(balSlash));

            await insRollupPoS.slash(eraSlot[2], { from: slashAddress });
            // Check balances after slashing
            balOp = await getEtherBalance(operators[0].address);
            balSlash = await getEtherBalance(slashAddress);
            // operator 1 lose its amount staked
            expect(Math.ceil(initBalOp)).to.be.equal(Math.ceil(balOp) + amountToStakeSlash);
            // slash account to receive 10% of amount staked
            expect(Math.ceil(initBalanceSlash) + 0.1 * amountToStakeSlash).to.be.equal(Math.ceil(balSlash));

            // Add operator again
            await insRollupPoS.addOperator(hashChain[9], url,
                { from: operators[0].address, value: web3.utils.toWei(amountToStakeSlash.toString(), "ether") });
            await insRollupPoS.setBlockNumber(eraBlock[6]);
            // simulate operator has forge a batch
            await insRollupPoS.setBlockForged(eraSlot[5]);
            // try to slash operator
            try {
                await insRollupPoS.slash(eraSlot[5], { from: slashAddress });
            } catch (error) {
                expect((error.message).includes("Batch has been committed and forged during this slot")).to.be.equal(true);
            }
        });

        it("commit and forge batch", async () => {
            const opId = 0;
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
            // reset rollup PoS
            insRollupPoS = await RollupPoS.new(addressRollupTest, maxTx);
            await insRollupPoS.setBlockNumber(eraBlock[0]);
            await insRollupPoS.addOperator(hashChain[9], url,
                { from: operators[0].address, value: amountToStake});
            await insRollupPoS.setBlockNumber(eraBlock[1]);
            await insRollupPoS.setBlockNumber(eraBlock[3]); // set era to 3

            // Check raffle random number initialization
            let oldRaffleRandom = "0x0000000000000000";
            let currentRaffleRandom = await insRollupPoS.getRaffle(5); // currentEra + 2 = 3 + 2 = 5
            expect(currentRaffleRandom.seedRnd).to.be.equal(oldRaffleRandom);
            oldRaffleRandom = currentRaffleRandom; // Update old raffle random

            // try to commit batch with wrong previous hash
            let index = await getIndexHash(opId);
            try {
                await insRollupPoS.commitBatch(hashChain[index - 2], compressedTxTest, [],  {from: operators[0].address});
                // above function should trigger an error
                // otherwise test should not pass
                expect(true).to.be.equal(false);
            } catch(error) {
                expect((error.message).includes("hash revealed not match current committed hash")).to.be.equal(true);
            }

            // check commit hash
            const resCommit = await insRollupPoS.commitBatch(hashChain[index - 1], compressedTxTest, [], {from: operators[0].address});
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
            expect(compressedTxTest).to.be.equal(inputRetrieved);
            // try to update data committed before without forging
            try {
                await insRollupPoS.commitBatch(hashChain[index - 1], compressedTxTest, [], {from: operators[0].address});
                // above function should trigger an error
                // otherwise test should not pass
                expect(true).to.be.equal(false);
            } catch(error) {
                expect((error.message).includes("there is data which is not forged")).to.be.equal(true);
            }
            
            // Forge batch
            await insRollupPoS.forgeCommittedBatch(proofA, proofB, proofC, input, [], {from: operators[0].address});

            // Check raffle random number has been updated
            currentRaffleRandom = await insRollupPoS.getRaffle(5); // currentEra + 2 = 3 + 2 = 5
            expect(currentRaffleRandom.seedRnd).to.be.not.equal(oldRaffleRandom);
            oldRaffleRandom = currentRaffleRandom; // Update old raffle random

            // try to forge data when there is no data committed
            try {
                await insRollupPoS.forgeCommittedBatch(proofA, proofB, proofC, input, [], {from: operators[0].address});
                // above function should trigger an error
                // otherwise test should not pass
                expect(true).to.be.equal(false);
            } catch (error) {
                expect((error.message).includes("There is no committed data")).to.be.equal(true);
            }

            if (deadlineBlocks){
                // commit data just before deadline
                index = await getIndexHash(opId);
                await insRollupPoS.setBlockNumber(eraBlock[3] + blocksPerSlot - deadlineBlocks - 2);
                await insRollupPoS.commitBatch(hashChain[index - 1], compressedTxTest, [], {from: operators[0].address});
                await insRollupPoS.forgeCommittedBatch(proofA, proofB, proofC, input, [], {from: operators[0].address});

                // Check raffle random number has been updated
                currentRaffleRandom = await insRollupPoS.getRaffle(5); // currentEra + 2 = 3 + 2 = 5
                expect(currentRaffleRandom.seedRnd).to.be.not.equal(oldRaffleRandom);
                oldRaffleRandom = currentRaffleRandom; // Update old raffle random

                // try to commit just after the deadline
                await insRollupPoS.setBlockNumber(eraBlock[3] + blocksPerSlot - deadlineBlocks + 1);
                index = await getIndexHash(opId);
                try { 
                    await insRollupPoS.commitBatch(hashChain[index - 1], compressedTxTest, [], {from: operators[0].address});
                    // above function should trigger an error
                    // otherwise test should not pass
                    expect(true).to.be.equal(false);
                } catch (error) {
                    expect((error.message).includes("not possible to commit data after deadline")).to.be.equal(true);
                }

                // move forward just one slot
                await insRollupPoS.setBlockNumber(eraBlock[3] + blocksPerSlot);
                // try to slash operator
                try {
                    await insRollupPoS.slash(eraSlot[3]);
                    // above function should trigger an error
                    // otherwise test should not pass
                    expect(true).to.be.equal(false);
                } catch(error) {
                    expect((error.message).includes("Batch has been committed and forged during this slot")).to.be.equal(true);
                }

                // commit data before deadline, try to update it, not forge block and slash operator
                // commit and forge
                await insRollupPoS.commitBatch(hashChain[index - 1], compressedTxTest, [], {from: operators[0].address});
                await insRollupPoS.forgeCommittedBatch(proofA, proofB, proofC, input, [], {from: operators[0].address});
                // commit again but not forge
                index = await getIndexHash(opId);
                await insRollupPoS.commitBatch(hashChain[index - 1], compressedTxTest, [], {from: operators[0].address});
                // move forward and try to update committed info after deadline
                await insRollupPoS.setBlockNumber(eraBlock[3] + blocksPerSlot + blocksPerSlot - deadlineBlocks + 1);
                try {
                    await insRollupPoS.commitBatch(hashChain[index - 1], compressedTxTest, [], {from: operators[0].address});
                    // above function should trigger an error
                    // otherwise test should not pass
                    expect(true).to.be.equal(false);
                } catch(error) {
                    expect((error.message).includes("not possible to commit data after deadline")).to.be.equal(true);
                }
                // move forward next slot without forging
                await insRollupPoS.setBlockNumber(eraBlock[3] + 2*blocksPerSlot);
                // slash operator despite a block has been forged
                // but it committed data and has not forge committed data
                try {
                    await insRollupPoS.slash(eraSlot[3]);
                    // above function should trigger an error
                    // otherwise test should not pass
                    expect(true).to.be.equal(false);
                } catch(error) {
                    expect((error.message).includes("Batch has been committed and forged during this slot")).to.be.equal(true);
                }
                await insRollupPoS.slash(eraSlot[3] + 1);
                // move forward and be sure that there are no operators
                await insRollupPoS.setBlockNumber(eraBlock[5]);
                try {
                    await insRollupPoS.getRaffleWinner(eraSlot[5]);
                    // above function should trigger an error
                    // otherwise test should not pass
                    expect(true).to.be.equal(false);
                } catch (error) {
                    expect((error.message).includes("Must be stakers")).to.be.equal(true);
                }
            }
        });

        it("slash operator with no commitment data", async () => {
            // reset rollup PoS
            insRollupPoS = await RollupPoS.new(addressRollupTest, maxTx);
            await insRollupPoS.setBlockNumber(eraBlock[0]);
            await insRollupPoS.addOperator(hashChain[9], url,
                { from: operators[0].address, value: amountToStake});
            await insRollupPoS.setBlockNumber(eraBlock[1]);
            await insRollupPoS.setBlockNumber(eraBlock[3]);
            // Balance before slashing
            const initBalSlash = await getEtherBalance(slashAddress);
            // slash operator 
            await insRollupPoS.slash(eraSlot[2], { from: slashAddress });
            // balance after slash operator
            const balSlash = await getEtherBalance(slashAddress);
            expect((0.1 * amountToStakeNumber).toFixed(1)).to.be.equal((balSlash - initBalSlash).toFixed(1));
            // Assure no operators after slashing
            await insRollupPoS.setBlockNumber(eraBlock[5]);
            try {
                await insRollupPoS.getRaffleWinner(eraSlot[5]);
                // above function should trigger an error
                // otherwise test should not pass
                expect(true).to.be.equal(false);
            } catch (error) {
                expect((error.message).includes("Must be stakers")).to.be.equal(true);
            }
        });
    });
});
