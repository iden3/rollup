const path = require("path");
const snarkjs = require("snarkjs");
const compiler = require("circom");

describe("Compile all circuits {24 Levels}", function () {
    this.timeout(100000);

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
        const cirDef = await compiler(path.join(__dirname, "circuits", "balancesupdater_test.circom"));
        circuitBalanceUpdater = new snarkjs.Circuit(cirDef);
    });

    it("Decode float", async () => {
        const cirDef = await compiler(path.join(__dirname, "circuits", "decodefloat_test.circom"));
        circuitDecodeFloat = new snarkjs.Circuit(cirDef);
    });

    it("Decode Tx", async () => {
        const cirDef = await compiler(path.join(__dirname, "circuits", "decodetx_test.circom"));
        circuitDecodeTx = new snarkjs.Circuit(cirDef);
    });

    it("Fee plan decoder", async () => {
        const cirDef = await compiler(path.join(__dirname, "circuits", "feeplandecoder_test.circom"));
        circuitFeePlanDecoder = new snarkjs.Circuit(cirDef);
    });

    it("Fee selector", async () => {
        const cirDef = await compiler(path.join(__dirname, "circuits", "feeselector_test.circom"));
        circuitFeeSelector = new snarkjs.Circuit(cirDef);
    });

    it("Required transaction verifier", async () => {
        const cirDef = await compiler(path.join(__dirname, "circuits", "requiredtxverifier_test.circom"));
        circuitRequiredTxVerifier = new snarkjs.Circuit(cirDef);
    });

    it("Rollup transaction", async () => {
        const cirDef = await compiler(path.join(__dirname, "circuits", "rolluptx_test.circom"));
        circuitRollupTx = new snarkjs.Circuit(cirDef);
    });

    it("Rollup transactions states", async () => {
        const cirDef = await compiler(path.join(__dirname, "circuits", "rolluptxstates_test.circom"));
        circuitRollupTxStates = new snarkjs.Circuit(cirDef);
    });

    it("State packer", async () => {
        const cirDef = await compiler(path.join(__dirname, "circuits", "statepacker_test.circom"));
        circuitStatePacker = new snarkjs.Circuit(cirDef);
    });

    it("", async () => {
        console.log("balancesupdater.circom: " + circuitBalanceUpdater.nConstraints);
        console.log("decodefloat.circom: " + circuitDecodeFloat.nConstraints);
        console.log("decodetx.circom: " + circuitDecodeTx.nConstraints);
        console.log("feeplandecoder.circom: " + circuitFeePlanDecoder.nConstraints);
        console.log("feeselector.circom: " + circuitFeeSelector.nConstraints);
        console.log("requiredtxverifier.circom: " + circuitRequiredTxVerifier.nConstraints);
        console.log("rolluptx.circom: " + circuitRollupTx.nConstraints);
        console.log("rolluptxstates.circom: " + circuitRollupTxStates.nConstraints);
        console.log("statepacker.circom: " + circuitStatePacker.nConstraints);
        
    });
});