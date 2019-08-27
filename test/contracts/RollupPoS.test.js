/* global artifacts */
/* global contract */

const chai = require('chai');

const { expect } = chai;
const RollupPoS = artifacts.require('../contracts/test/RollupPoSTest');

contract('Token Rollup', (accounts) => {
  const {
    0: owner,
    1: id1,
    2: id2,
  } = accounts;

  const initialAmount = 100;
  let insRollupPoS;

  before(async () => {
    // Deploy token test
    insRollupPoS = await RollupPoS.new(owner, initialAmount);
  });
});
