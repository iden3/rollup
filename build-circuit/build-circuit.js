const { createCircuit, compileCircuit, setupCircuit,
    inputs, witness, exportFiles } = require("./helpers/actions");

// Input parameters
const op = process.argv[2];
const nTx = Number(process.argv[3]);
const Levels = Number(process.argv[4]);
const setupFile = process.argv[5];

// compile circuit
if (op == "create"){
    createCircuit(nTx, Levels);
} else if (op == "compile") {
    compileCircuit(nTx, Levels);
} else if (op == "setup") {
    setupCircuit(nTx, Levels, setupFile);
} else if (op == "input"){
    inputs(nTx, Levels);
} else if (op == "witness"){
    witness(nTx, Levels);
} else if (op == "export"){
    exportFiles(nTx, Levels);
} else {
    console.error(`command "${op}" not accepted`);
}
