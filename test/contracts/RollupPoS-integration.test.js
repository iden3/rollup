/* eslint-disable no-underscore-dangle */
/* eslint-disable no-await-in-loop */
/* global artifacts */
/* global contract */
/* global web3 */
/* global BigInt */

const chai = require('chai');

const { expect } = chai;
const RollupPoS = artifacts.require('../contracts/test/RollupPoSTest');

async function getEtherBalance(address) {
  let balance = await web3.eth.getBalance(address);
  balance = web3.utils.fromWei(balance, 'ether');
  return Number(balance);
}

contract('RollupPoS', (accounts) => {
  let insRollupPoS;

  const addressRollupTest = '0x0000000000000000000000000000000000000001';
  const operators = [];
  const eraBlock = [];
  const eraSlot = [];
  const hashChain = [];
  const blockPerEra = 2000;
  const slotPerEra = 20;
  const amountToStake = 2;

  const initialMsg = 'rollup';
  hashChain.push(web3.utils.keccak256(initialMsg));
  for (let i = 1; i < 10; i++) {
    hashChain.push(web3.utils.keccak256(hashChain[i - 1]));
  }

  before(async () => {

  });

  describe('Rollup - RollupPoS integration', () => {
    it('add operator', async () => {

    });
  });
});
