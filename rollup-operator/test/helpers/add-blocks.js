/* global contract */
const { addBlocks } = require("../../../test/contracts/helpers/timeTravel");

const slotsPerEra = 20;
const blockPerSlots = 100;

const erasToAdd = 1;

const blocksToAdd = erasToAdd*slotsPerEra*blockPerSlots;

contract("Add blocks", () => {
    it("Should add blocks", async () => {
        await addBlocks(blocksToAdd);
        console.log(`Add ${blocksToAdd} blocks`);
    });
});