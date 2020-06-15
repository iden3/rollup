/* eslint-disable no-await-in-loop */
/* eslint-disable no-console */
/* global contract */
const { addBlocks } = require('../../../test/contracts/helpers/timeTravel');
const { timeout } = require('../../../rollup-utils/utils');

const slotsPerEra = 20;
const blockPerSlots = 100;

const erasToAdd = 4;

const blocksToAdd = erasToAdd * slotsPerEra * blockPerSlots;

contract('Add blocks', () => {
    it('Should add blocks', async () => {
        for (let i = 0; i < erasToAdd; i++) {
            await addBlocks(slotsPerEra * blockPerSlots);
            if (i !== erasToAdd - 1) await timeout(5000);
            console.log('Move forward 1 era');
        }
        console.log(`Add ${blocksToAdd} blocks`);
    });
});
