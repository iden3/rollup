/* eslint-disable no-underscore-dangle */
/* global artifacts */
/* global contract */
/* global web3 */
/* global BigInt */

const chai = require('chai');

const { expect } = chai;
const RollupPoS = artifacts.require('../contracts/test/RollupPoSTest');

contract('Token StakerManager', (accounts) => {
  const {
    0: owner,
  } = accounts;

  let insRollupPoS;

  const operators = [];
  const eraBlock = [];
  const eraSlot = [];
  const hashChain = [];
  const blockPerEra = 2000;
  const slotPerEra = 20;

  const initialMsg = 'rollup';
  hashChain.push(web3.utils.keccak256(initialMsg));
  for (let i = 1; i < 10; i++) {
    hashChain.push(web3.utils.keccak256(hashChain[i - 1]));
  }

  before(async () => {
    // Deploy token test
    insRollupPoS = await RollupPoS.new();
  });

  it('Check ganache provider', async () => {
    if (accounts.length < 100) {
      throw new Error('launch ganache with more than 100 accounts:\n\n `ganache-cli -a 100`');
    }

    // fill 99 addresses for operators
    for (let i = 1; i < 100; i++) {
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

  describe('test staker PoS tree', () => {
    it('add 2 stakers', async () => {
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
  });
});
