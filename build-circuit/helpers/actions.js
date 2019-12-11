const fs = require("fs");
const path = require("path");
const snarkjs = require("snarkjs");
const compiler = require("circom");
const { stringifyBigInts } = require("snarkjs");

// Define name-files
const circuitName = "rollup";

async function compileCircuit(nTx, levels) {
    let cirDef;
    const circuitCode = `
    include "../../circuits/rollup.circom";

    component main = Rollup(${nTx}, ${levels});
    `;

    // create folder to store circuit files
    const pathName = path.join(__dirname, `../rollup-${nTx}-${levels}`);
    fs.mkdirSync(pathName);

    // store circuit
    const circuitCodeFile = path.join(pathName, `${circuitName}-${nTx}-${levels}.circom`);
    fs.writeFileSync(circuitCodeFile, circuitCode, "utf8");

    console.log("compiling circuit...");
    console.time("compile circuit");
    try {
        cirDef = await compiler(circuitCodeFile);
    } catch(err) {
        console.log(err);
    }
    console.timeEnd("compile circuit");
    const circuit = new snarkjs.Circuit(cirDef);
    console.log(`Stats ${circuitName}-${nTx}-${levels}.circom circuit with: \n
        Transactions: ${nTx}
        Levels: ${levels}:
        Constraints: ${circuit.nConstraints}\n`);
    console.log("storing circuit...");
    const circuitOutputName = `${circuitName}-${nTx}-${levels}`;
    const circuitOutputFile = path.join(pathName, `${circuitOutputName}.json`);
    fs.writeFileSync(circuitOutputFile, JSON.stringify(cirDef, null, 1), "utf8");
}

async function setupCircuit(nTx, levels) {

    const circuitInputName = `${circuitName}-${nTx}-${levels}`;
    const circuitInputFile = path.join(__dirname, `../rollup-${nTx}-${levels}`, `${circuitInputName}.json`);

    const pkOutputName = `pk-${nTx}-${levels}`;
    const pkOutputFile = path.join(__dirname, `../rollup-${nTx}-${levels}`, `${pkOutputName}.json`);

    const vkOutputName = `vk-${nTx}-${levels}`;
    const vkOutputFile = path.join(__dirname, `../rollup-${nTx}-${levels}`, `${vkOutputName}.json`);

    console.log("loading circuit...");
    const cirDef = JSON.parse(fs.readFileSync(circuitInputFile, "utf8"));
    const cir = new snarkjs.Circuit(cirDef);

    if (!snarkjs["groth"]) throw new Error("Invalid protocol");
    console.log("Doing setup circuit...");
    console.time("setup circuit");
    const setup = snarkjs["groth"].setup(cir);
    console.timeEnd("setup circuit");

    fs.writeFileSync(pkOutputFile, JSON.stringify(stringifyBigInts(setup.vk_proof), null, 1), "utf-8");
    fs.writeFileSync(vkOutputFile, JSON.stringify(stringifyBigInts(setup.vk_verifier), null, 1), "utf-8");
}

module.exports = {
    compileCircuit,
    setupCircuit,
};