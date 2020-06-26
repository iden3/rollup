/* global contract */
const { addBlocks } = require('../../test/contracts/helpers/timeTravel');

const blocksGenesis = 1000;
const blockPerSlots = 100;

contract('Add blocks Genesis', () => {
  it('Should add blocks blocksGenesis', async () => {
    await addBlocks(blocksGenesis);
    console.log(`Add ${blocksGenesis} blocks`);
  });
  it('Should add blocks blocksGenesis', async () => {
    await addBlocks(2 * blockPerSlots);
    console.log(`Add ${2 * blockPerSlots} blocks`);
  });
});
