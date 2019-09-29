/* global BigInt */
const rollupUtils = require("../../rollup-utils/rollup-utils");

function timeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function buildInputSm(bb) {
    const feePlan = rollupUtils.buildFeeInputSm(bb.feePlan);
    return [
        bb.getInput().oldStRoot.toString(),
        bb.getNewStateRoot().toString(),
        bb.getNewExitRoot().toString(),
        bb.getOnChainHash().toString(),
        bb.getOffChainHash().toString(),
        feePlan[0],
        feePlan[1],
        bb.getCountersOut().toString(),
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
        return {
            fromIdx: event.fromId,
            toIdx: event.toId,
            amount: event.amount,
        };
    }
}

module.exports = {
    timeout,
    buildInputSm,
    manageEvent,
};