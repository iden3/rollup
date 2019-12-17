const chai = require("chai");

const assert = chai.assert;

module.exports = checkBatch;


async function checkBatch(circuit, w, bb) {

    const out = {
        newStRoot: bb.getNewStateRoot(),
        newExitRoot: bb.getNewExitRoot(),
        onChainHash: bb.getOnChainHash(),
        offChainHash: bb.getOffChainHash(),
        countersOut: bb.getCountersOut()
    };

    await circuit.assertOut(w, out);
}
