/* global web3 */
async function advanceTime(time) {
    // eslint-disable-next-line no-new
    new Promise((resolve, reject) => {
        web3.currentProvider.send({
            jsonrpc: "2.0",
            method: "evm_increaseTime",
            params: [time],
            id: new Date().getTime(),
        }, (err, result) => {
            if (err) { return reject(err); }
            return resolve(result);
        });
    });
}

async function advanceBlock() {
    // eslint-disable-next-line no-new
    new Promise((resolve, reject) => {
        web3.currentProvider.send({
            jsonrpc: "2.0",
            method: "evm_mine",
            id: new Date().getTime(),
        }, (err, result) => {
            if (err) { return reject(err); }
            return resolve(result);
        });
    });
}

async function addBlocks(numBlocks) {
    for (let i = 0; i < numBlocks; i++) {
    // eslint-disable-next-line no-await-in-loop
        await advanceBlock();
    }
}

module.exports = {
    advanceTime,
    advanceBlock,
    addBlocks,
};
