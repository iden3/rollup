/* eslint-disable no-underscore-dangle */
/* eslint-disable no-await-in-loop */
/* global artifacts */
/* global contract */
/* global web3 */
/* global BigInt */

const chai = require('chai');

const { expect } = chai;
const RollupPoS = artifacts.require('../contracts/test/RollupPoSTest');

contract('RollupPoS', (accounts) => {
  const {
    0: owner,
    99: staker
  } = accounts;

  let insRollupPoS;

  const addressRollupTest = '0x0000000000000000000000000000000000000001';
  const operators = [];
  const eraBlock = [];
  const eraSlot = [];
  const hashChain = [];
  let raffleWinner = [];
  const blockPerEra = 2000;
  const slotPerEra = 20;

  const initialMsg = 'rollup';
  hashChain.push(web3.utils.keccak256(initialMsg));
  for (let i = 1; i < 10; i++) {
    hashChain.push(web3.utils.keccak256(hashChain[i - 1]));
  }

  before(async () => {
    // Deploy token test
    insRollupPoS = await RollupPoS.new(addressRollupTest);
  });

  describe('staker tree', () => {
    it('Check ganache provider', async () => {
      if (accounts.length < 100) {
        throw new Error('launch ganache with more than 100 accounts:\n\n `ganache-cli -a 100`');
      }

      // fill 99 addresses for operators
      for (let i = 1; i < 99; i++) {
        operators.push({ address: accounts[i], idOp: (i - 1).toString() });
      }
    });

    it('get genesis block', async () => {
    // get genesis block
      const genesisBlockNum = await insRollupPoS.genesisBlock();
      expect(genesisBlockNum.toString()).to.be.equal(BigInt(1000).toString());

      // fill with first block of each era
      for (let i = 0; i < 20; i++) {
        eraBlock.push(i * blockPerEra + Number(genesisBlockNum) + 1);
        eraSlot.push(i * slotPerEra + 1);
      }

      // set first era block
      await insRollupPoS.setBlockNumber(eraBlock[0]);

      // check block has been settled
      const currentBlock = await insRollupPoS.getBlockNumber();
      expect(currentBlock.toString()).to.be.equal(BigInt(1001).toString());
    });

    it('add 2 operators', async () => {
      // add operator 0 with eStake = 4
      await insRollupPoS.addStaker(hashChain[9],
        { from: operators[0].address, value: web3.utils.toWei('4', 'ether') });

      // add operator 1 with eStake = 4
      await insRollupPoS.addStaker(hashChain[9],
        { from: operators[1].address, value: web3.utils.toWei('2', 'ether') });

      // move to era 2, where there are two operators
      await insRollupPoS.setBlockNumber(eraBlock[2]);
    });

    it('test raffle winner', async () => {
      // get raffle winner for era 2 for different lucky numbers
      let winner = await insRollupPoS.getRaffleWinnerTest(eraSlot[2], 15);
      expect(winner.toString()).to.be.equal(operators[0].idOp);

      winner = await insRollupPoS.getRaffleWinnerTest(eraSlot[2], 16);
      expect(winner.toString()).to.be.equal(operators[1].idOp);

      winner = await insRollupPoS.getRaffleWinnerTest(eraSlot[2], 15 + 20);
      expect(winner.toString()).to.be.equal(operators[0].idOp);

      winner = await insRollupPoS.getRaffleWinnerTest(eraSlot[2], 16 + 20);
      expect(winner.toString()).to.be.equal(operators[1].idOp);
    });

    it('add 12 operators', async () => {
      // restart smart contract
      insRollupPoS = await RollupPoS.new(addressRollupTest);
      // set first era block
      await insRollupPoS.setBlockNumber(eraBlock[0]);
      // add 12 operators with eStake = 4
      for (let i = 0; i < 5; i++) {
        await insRollupPoS.addStaker(hashChain[9],
          { from: operators[i].address, value: web3.utils.toWei('2', 'ether') });
        raffleWinner.push(4 * i);
      }
      // move to era 2, where there are the operators
      await insRollupPoS.setBlockNumber(eraBlock[2]);
      // test raffle winner depending on lucky number
      for (let i = 0; i < 5; i++) {
        const winner = await insRollupPoS.getRaffleWinnerTest(eraSlot[2], raffleWinner[i]);
        expect(winner.toString()).to.be.equal(operators[i].idOp);
      }
    });

    it('remove operators', async () => {
      // move to era 1, to remove operator (effective on era 3)
      await insRollupPoS.setBlockNumber(eraBlock[1]);
      // remove operator 9 operator with eStake = 4
      await insRollupPoS.remove(operators[3].idOp, { from: operators[3].address });
      // move to era 3, where there are the operators
      await insRollupPoS.setBlockNumber(eraBlock[3]);
      // store all winners
      let winners = [];
      for (let i = 0; i < 5; i++) {
        const winner = await insRollupPoS.getRaffleWinnerTest(eraSlot[3], raffleWinner[i]);
        winners.push(Number(winner));
      }
      console.log(winners);
      // expect(winners.includes(9)).to.be.equal(false);
      // check era 2 remains same before removing operator 9
      // winners = [];
      // for (let i = 0; i < 5; i++) {
      //   const winner = await insRollupPoS.getRaffleWinnerTest(eraSlot[2], raffleWinner[i]);
      //   expect(winner.toString()).to.be.equal(operators[i].idOp);
      // }

      // // move to era 1, to remove operator (effective on era 3)
      // await insRollupPoS.setBlockNumber(eraBlock[1]);
      // // remove operator 4 operator with eStake = 4
      // await insRollupPoS.remove(operators[4].idOp, { from: operators[4].address });
      // // move to era 3, where there are the operators
      // await insRollupPoS.setBlockNumber(eraBlock[3]);

      // // store all winners
      // winners = [];
      // for (let i = 0; i < 12; i++) {
      //   const winner = await insRollupPoS.getRaffleWinnerTest(eraSlot[3], raffleWinner[i]);
      //   // if (!winners.includes(Number(winner))) winners.push(Number(winner));
      //   winners.push(Number(winner));
      // }
      // console.log(winners);
      // expect(winners.includes(4)).to.be.equal(false);
      // expect(winners.includes(9)).to.be.equal(false);

      // // move to era 1, to remove operator (effective on era 3)
      // await insRollupPoS.setBlockNumber(eraBlock[1]);
      // // remove the rest of operators
      // winners.forEach(async (element) => {
      //   await insRollupPoS.remove(operators[element].idOp, { from: operators[element].address });
      // });
      // // move to era 3, where there are the operators
      // await insRollupPoS.setBlockNumber(eraBlock[3]);
      // // test raffle winner --> should trigger error that there are no stakers
      // try {
      //   await insRollupPoS.getRaffleWinnerTest(eraSlot[3], raffleWinner[0]);
      // } catch (error) {
      //   expect((error.message).includes('Must be stakers')).to.be.equal(true);
      // }
    });

    // it('add 50 operators, remove and check winners', async () => {
    //   // restart smart contract
    //   insRollupPoS = await RollupPoS.new(addressRollupTest);
    //   // move to era 0
    //   await insRollupPoS.setBlockNumber(eraBlock[0]);

    //   raffleWinner = [];
    //   // add 16 operators
    //   for (let i = 0; i < 17; i++) {
    //     await insRollupPoS.addStaker(hashChain[9],
    //       { from: operators[i].address, value: web3.utils.toWei('2', 'ether') });
    //     raffleWinner.push(4 * i);
    //   }
    //   // move to era 4, to remove operator (effective on era 6)
    //   await insRollupPoS.setBlockNumber(eraBlock[4]);
    //   // remove random operator
    //   const opRemove = Math.floor(Math.random() * 50);
    //   // remove random operator with eStake = 4
    //   await insRollupPoS.remove(operators[15].idOp, { from: operators[15].address });
    //   // move to era 6
    //   await insRollupPoS.setBlockNumber(eraBlock[6]);
    //   // store all winners
    //   const winners = [];
    //   for (let i = 0; i < 17; i++) {
    //     const winner = await insRollupPoS.getRaffleWinnerTest(eraSlot[6], raffleWinner[i]);
    //     // if (!winners.includes(Number(winner))) winners.push(Number(winner));
    //     winners.push(Number(winner));
    //   }
    //   // expect(winners.includes(opRemove)).to.be.equal(false);
    //   console.log(15);
    //   console.log(winners);
    // });
  });

  // TODO:
  // - Test:
  //   - Get back staked ether
  //    - controller = beneficiary = staker
  //    - controller = staker, beneficiary
  //    - controller, staker, beneficiary
});
