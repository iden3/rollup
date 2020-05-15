async function checkBatch(circuit, w, bb) {

    const out = {
        newStRoot: bb.getNewStateRoot(),
        newExitRoot: bb.getNewExitRoot(),
        onChainHash: bb.getOnChainHash(),
        offChainHash: bb.getOffChainHash(),
        finalIdx: bb.getFinalIdx(),
    };

    await circuit.assertOut(w, out);
}

module.exports = checkBatch;