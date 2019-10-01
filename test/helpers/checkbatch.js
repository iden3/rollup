const chai = require("chai");

const assert = chai.assert;

module.exports = checkBatch;


function checkBatch(circuit, w, bb) {
    const newStateRoot = w[circuit.getSignalIdx("main.newStRoot")];
/*    console.log(newStateRoot.toString());
    const v=bb.getNewStateRoot();
    console.log(v);
*/    assert(newStateRoot.equals(bb.getNewStateRoot()));


    const newExitRoot = w[circuit.getSignalIdx("main.newExitRoot")];
/*    console.log(newExitRoot.toString());
    const v2=bb.getNewExitRoot();
    console.log(v2);
*/    assert(newExitRoot.equals(bb.getNewExitRoot()));

    const onChainHash = w[circuit.getSignalIdx("main.onChainHash")];
    assert(onChainHash.equals(bb.getOnChainHash()));

    const offChainHash = w[circuit.getSignalIdx("main.offChainHash")];
    assert(offChainHash.equals(bb.getOffChainHash()));

    const countersOut = w[circuit.getSignalIdx("main.countersOut")];
    assert(countersOut.equals(bb.getCountersOut()));
}
