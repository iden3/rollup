const { compileCircuit, setupCircuit, inputs } = require("./helpers/actions");

// Input parameters
const op = process.argv[2];
const nTx = Number(process.argv[3]);
const Levels = Number(process.argv[4]);

// compile circuit
if (op == "compile") {
    compileCircuit(nTx, Levels);
} else if (op == "setup") {
    setupCircuit(nTx, Levels);
} else if (op == "input"){
    inputs(nTx, Levels);
}
