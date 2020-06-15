const path = require("path");
const tester = require("circom").tester;

describe("Compile all circuits for 24 Levels", function () {
    this.timeout(250000);

    let circuitBalanceUpdater;
    let circuitDecodeFloat;
    let circuitDecodeTx;
    let circuitFeePlanDecoder;
    let circuitFeeTableSelector;
    let circuitFeeUpdater;
    let circuitCheckFees;
    let circuitRequiredTxVerifier;
    let circuitRollupTx;
    let circuitRollupTxStates;
    let circuitStatePacker;

    it("Balance updater", async () => {
        circuitBalanceUpdater = await tester(path.join(__dirname, "circuits-test", "balancesupdater_test.circom"));
        await circuitBalanceUpdater.loadConstraints();
    });

    it("Decode float", async () => {
        circuitDecodeFloat = await tester(path.join(__dirname, "circuits-test", "decodefloat_test.circom"));
        await circuitDecodeFloat.loadConstraints();
    });

    it("Decode Tx", async () => {
        circuitDecodeTx = await tester(path.join(__dirname, "circuits-test", "decodetx_test.circom"));
        await circuitDecodeTx.loadConstraints();
    });

    it("Fee plan decoder", async () => {
        circuitFeePlanDecoder = await tester(path.join(__dirname, "circuits-test", "feeplandecoder_test.circom"));
        await circuitFeePlanDecoder.loadConstraints();
    });

    it("Fee table selector", async () => {
        circuitFeeTableSelector = await tester(path.join(__dirname, "circuits-test", "feetableselector_test.circom"));
        await circuitFeeTableSelector.loadConstraints();
    });

    it("Fee updater", async () => {
        circuitFeeUpdater = await tester(path.join(__dirname, "circuits-test", "feeupdater_test.circom"));
        await circuitFeeUpdater.loadConstraints();
    });

    it("Check fees", async () => {
        circuitCheckFees = await tester(path.join(__dirname, "circuits-test", "checkfees_test.circom"));
        await circuitCheckFees.loadConstraints();
    });

    it("Required transaction verifier", async () => {
        circuitRequiredTxVerifier = await tester(path.join(__dirname, "circuits-test", "requiredtxverifier_test.circom"));
        await circuitRequiredTxVerifier.loadConstraints();
    });

    it("Rollup transaction", async () => {
        circuitRollupTx = await tester(path.join(__dirname, "circuits-test", "rolluptx_test.circom"));
        await circuitRollupTx.loadConstraints();
    });

    it("Rollup transactions states", async () => {
        circuitRollupTxStates = await tester(path.join(__dirname, "circuits-test", "rolluptxstates_test.circom"));
        await circuitRollupTxStates.loadConstraints();
    });

    it("State packer", async () => {
        circuitStatePacker = await tester(path.join(__dirname, "circuits-test", "statepacker_test.circom"));
        await circuitStatePacker.loadConstraints();
    });

    it("", async () => {
        console.log("balancesupdater.circom: " + circuitBalanceUpdater.constraints.length);
        console.log("decodefloat.circom: " + circuitDecodeFloat.constraints.length);
        console.log("decodetx.circom: " + circuitDecodeTx.constraints.length);
        console.log("feeplandecoder.circom: " + circuitFeePlanDecoder.constraints.length);
        console.log("feetableselector.circom: " + circuitFeeTableSelector.constraints.length);
        console.log("feeupdater.circom: " + circuitFeeUpdater.constraints.length);
        console.log("checkfees.circom: " + circuitCheckFees.constraints.length);
        console.log("requiredtxverifier.circom: " + circuitRequiredTxVerifier.constraints.length);
        console.log("rolluptx.circom: " + circuitRollupTx.constraints.length);
        console.log("rolluptxstates.circom: " + circuitRollupTxStates.constraints.length);
        console.log("statepacker.circom: " + circuitStatePacker.constraints.length);
    });
});