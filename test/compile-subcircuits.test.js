const path = require("path");
const snarkjs = require("snarkjs");
const tester = require("circom").tester;

describe("Compile all circuits {24 Levels}", function () {
    this.timeout(0);

    let circuitBalanceUpdater;
    let circuitDecodeFloat;
    let circuitDecodeTx;
    let circuitFeePlanDecoder;
    let circuitFeeSelector;
    let circuitRequiredTxVerifier;
    let circuitRollupTx;
    let circuitRollupTxStates;
    let circuitStatePacker;

    it("Balance updater", async () => {
        circuitBalanceUpdater = await tester(path.join(__dirname, "circuits", "balancesupdater_test.circom"));
        await circuitBalanceUpdater.loadConstraints();
    });

    it("Decode float", async () => {
        circuitDecodeFloat = await tester(path.join(__dirname, "circuits", "decodefloat_test.circom"));
        await circuitDecodeFloat.loadConstraints();
    });

    it("Decode Tx", async () => {
        circuitDecodeTx = await tester(path.join(__dirname, "circuits", "decodetx_test.circom"));
        await circuitDecodeTx.loadConstraints();
    });

    it("Fee plan decoder", async () => {
        circuitFeePlanDecoder = await tester(path.join(__dirname, "circuits", "feeplandecoder_test.circom"));
        await circuitFeePlanDecoder.loadConstraints();
    });

    it("Fee selector", async () => {
        circuitFeeSelector = await tester(path.join(__dirname, "circuits", "feeselector_test.circom"));
        await circuitFeeSelector.loadConstraints();
    });

    it("Required transaction verifier", async () => {
        circuitRequiredTxVerifier = await tester(path.join(__dirname, "circuits", "requiredtxverifier_test.circom"));
        await circuitRequiredTxVerifier.loadConstraints();
    });

    it("Rollup transaction", async () => {
        circuitRollupTx = await tester(path.join(__dirname, "circuits", "rolluptx_test.circom"));
        await circuitRollupTx.loadConstraints();
    });

    it("Rollup transactions states", async () => {
        circuitRollupTxStates = await tester(path.join(__dirname, "circuits", "rolluptxstates_test.circom"));
        await circuitRollupTxStates.loadConstraints();
    });

    it("State packer", async () => {
        circuitStatePacker = await tester(path.join(__dirname, "circuits", "statepacker_test.circom"));
        await circuitStatePacker.loadConstraints();
    });

    it("", async () => {
        console.log("balancesupdater.circom: " + circuitBalanceUpdater.constraints.length);
        console.log("decodefloat.circom: " + circuitDecodeFloat.constraints.length);
        console.log("decodetx.circom: " + circuitDecodeTx.constraints.length);
        console.log("feeplandecoder.circom: " + circuitFeePlanDecoder.constraints.length);
        console.log("feeselector.circom: " + circuitFeeSelector.constraints.length);
        console.log("requiredtxverifier.circom: " + circuitRequiredTxVerifier.constraints.length);
        console.log("rolluptx.circom: " + circuitRollupTx.constraints.length);
        console.log("rolluptxstates.circom: " + circuitRollupTxStates.constraints.length);
        console.log("statepacker.circom: " + circuitStatePacker.constraints.length);
        
    });
});