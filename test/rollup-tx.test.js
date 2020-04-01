const chai = require("chai");
const path = require("path");
const snarkjs = require("snarkjs");
const compiler = require("circom");

describe("Rollup Tx test", function () {
    let circuit;

    this.timeout(100000);

    it("Should create empty TXs", async () => {
        const cirDef = await compiler(path.join(__dirname, "circuits", "rolluptx_test.circom"));
        circuit = new snarkjs.Circuit(cirDef);
        console.log("NConstraints `rolluptx.circom` circuit: " + circuit.nConstraints + "\n");
    });
});