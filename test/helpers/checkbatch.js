const chai = require("chai");

const assert = chai.assert;

module.exports = checkBatch;


function checkBatch(circuit, w, bb) {
    const newStateRoot = w[circuit.getSignalIdx("main.newStRoot")];
    // console.log("newStateRoot circuit: ", newStateRoot.toString());
    // const v = bb.getNewStateRoot();
    // console.log("newStateRoot bb: ", v);    
    assert(newStateRoot.equals(bb.getNewStateRoot()));


    const newExitRoot = w[circuit.getSignalIdx("main.newExitRoot")];
    // console.log("newExitRoot circuit: ", newExitRoot.toString());
    // const v2 = bb.getNewExitRoot();
    // console.log("newExitRoot circuit: ", v2);
    assert(newExitRoot.equals(bb.getNewExitRoot()));

    const onChainHash = w[circuit.getSignalIdx("main.onChainHash")];
    // console.log("onChainHash circuit: ", onChainHash.toString());
    // const v3 = bb.getOnChainHash();
    // console.log("onChainHash bb: ", v3);
    assert(onChainHash.equals(bb.getOnChainHash()));

    const offChainHash = w[circuit.getSignalIdx("main.offChainHash")];
    // console.log("offChainHash circuit: ", offChainHash.toString());
    // const v4 = bb.getOffChainHash();
    // console.log("offChainHash bb: ", v4);
    assert(offChainHash.equals(bb.getOffChainHash()));

    const countersOut = w[circuit.getSignalIdx("main.countersOut")];
    // console.log("Counters circuit: ", countersOut.toString());
    // const v5 = bb.getCountersOut();
    // console.log("Counters bb: ", v5);
    assert(countersOut.equals(bb.getCountersOut()));

    const finalIdx = w[circuit.getSignalIdx("main.finalIdx")];
    // console.log("final Idx circuit: ", finalIdx.toString());
    // const v6 = bb.getFinalIdx();
    // console.log("final Idx bb: ", v6);
    assert(finalIdx.equals(bb.getFinalIdx()));
}
