/* global BigInt */
const rollupUtils = require("../../rollup-utils/rollup-utils");

function timeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function padding256(n) {
    let nstr = BigInt(n).toString(16);
    while (nstr.length < 64) nstr = "0"+nstr;
    nstr = `0x${nstr}`;
    return nstr;
}

function buildPublicInputsSm(bb) {
    return [
        padding256(bb.getNewStateRoot()),
        padding256(bb.getNewExitRoot()),
        padding256(bb.getOnChainHash()),
        padding256(bb.getOffChainHash()),
        padding256(bb.getCountersOut()),
        padding256(bb.getOldStateRoot()),
        padding256(bb.getFeePlanCoins()),
        padding256(bb.getFeePlanFees()),
    ];
}

function manageEvent(event) {
    if (event.event == "OnChainTx") {
        const txData = rollupUtils.decodeTxData(event.args.txData);
        return {
            fromIdx: txData.fromId,
            toIdx: txData.toId,
            amount: txData.amount,
            loadAmount: BigInt(event.args.loadAmount),
            coin: txData.tokenId,
            ax: BigInt(event.args.Ax).toString(16),
            ay: BigInt(event.args.Ay).toString(16),
            ethAddress: BigInt(event.args.ethAddress).toString(),
            onChain: true
        };
    } else if (event.event == "OffChainTx") {
        return event.tx;
    }
}

function generateCall(proofInput){
    const proof = {};
    proof.proofA = [];
    proof.proofA[0] = padding256(proofInput.proofA[0]);
    proof.proofA[1] = padding256(proofInput.proofA[1]);

    proof.proofB = [[],[]];

    proof.proofB[0][0] = padding256(proofInput.proofB[0][1]);
    proof.proofB[0][1] = padding256(proofInput.proofB[0][0]);
    proof.proofB[1][0] = padding256(proofInput.proofB[1][1]);
    proof.proofB[1][1] = padding256(proofInput.proofB[1][0]);

    proof.proofC = [];
    proof.proofC[0] = padding256(proofInput.proofC[0]);
    proof.proofC[1] = padding256(proofInput.proofC[1]);

    if (proofInput.publicInputs){
        proof.publicInputs = [];
        for (const elem of proofInput.publicInputs)
            proof.publicInputs.push(`${padding256(elem)}`);
    }
    
    return proof;
}

module.exports = {
    timeout,
    buildPublicInputsSm,
    manageEvent,
    generateCall,
};