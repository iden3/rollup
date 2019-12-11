const fs = require("fs");
const path = require("path");
const snarkjs = require("snarkjs");
const compiler = require("circom");
const JSONStream = require("JSONStream");
const util = require("util");
const exec = util.promisify(require("child_process").exec);
const { stringifyBigInts } = require("snarkjs");

const SMTMemDB = require("circomlib").SMTMemDB;
const RollupDb = require("../../js/rollupdb");

// Define name-files
const circuitName = "circuit";

async function compileCircuit(nTx, levels) {
    // create folder to store circuit files
    const pathName = path.join(__dirname, `../rollup-${nTx}-${levels}`);
    if (!fs.existsSync(pathName))
        fs.mkdirSync(pathName);
    
    let cirDef;
    const circuitCode = `
    include "../../circuits/rollup.circom";

    component main = Rollup(${nTx}, ${levels});
    `;

    // store circuit
    const circuitCodeFile = path.join(pathName, `${circuitName}-${nTx}-${levels}.circom`);
    fs.writeFileSync(circuitCodeFile, circuitCode, "utf8");

    console.log("compiling circuit...");
    console.time("compile circuit");
    try {
        cirDef = await compiler(circuitCodeFile, {reduceConstraints: true});
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

    let transformStream = JSONStream.stringifyObject();
    let outputStream = fs.createWriteStream(circuitOutputFile);

    transformStream.pipe(outputStream);

    Object.keys(cirDef).forEach(function (key) {
        transformStream.write([key, cirDef[key]]);
    });

    transformStream.end();
}

async function setupCircuit(nTx, levels) {
    
    let config;
    if (fs.existsSync(`${__dirname}/../config.json`))
        config = JSON.parse(fs.readFileSync(`${__dirname}/../config.json`, "utf8"));
    else {
        console.error(`Config file ${__dirname}/../config.json is missing`);
        process.exit(0);
    }

    // Folders
    const pySrc = config.pathSrc;
    const pyCir = config.pathCir;
    const list = config.list;

    const circuitInputName = `${circuitName}-${nTx}-${levels}`;
    const circuitInputFile = path.join(__dirname, `../rollup-${nTx}-${levels}`, `${circuitInputName}.json`);
    
    // check circuit file exist
    if (!fs.existsSync(circuitInputFile)){
        console.log(`Circuit file: ${circuitInputFile} does not exist`);
        return;
    } else {
        const pkCirFile = path.join(pyCir, `${circuitInputName}.json`);
        const cmd = `cp ${circuitInputFile} ${pkCirFile}`;
        await exec(cmd);
    }

    // CUDA_VISIBLE_DEVICES=1,2 python3 pysnarks.py -m s -in_c r1cs4M_c.bin -pk r1cs4M_pk.bin -vk r1cs4M_vk.json 

    const pkOutputName = `pk-${nTx}-${levels}`;
    const pkOutputFile = path.join(pyCir, `${pkOutputName}.bin`);

    const vkOutputName = `vk-${nTx}-${levels}`;
    const vkOutputFile = path.join(pyCir, `${vkOutputName}.json`);

    const cmd = `cd ${pySrc} && \
    CUDA_VISIBLE_DEVICES=${list} \
    python3 pysnarks.py -m s \
    -in_c ${circuitInputFile} \
    -pk ${pkOutputFile} \
    -vk ${vkOutputFile}`;
    console.error("Calculating setup...");
    await exec(cmd);
    // fs.writeFileSync(pkOutputFile, JSON.stringify(stringifyBigInts(setup.vk_proof), null, 1), "utf-8");
    // fs.writeFileSync(vkOutputFile, JSON.stringify(stringifyBigInts(setup.vk_verifier), null, 1), "utf-8");
    console.error("Setup finished");
}

async function inputs(nTx, levels) {
    // create folder to store input file
    const pathName = path.join(__dirname, `../rollup-${nTx}-${levels}`);
    if (!fs.existsSync(pathName))
        fs.mkdirSync(pathName);
    
    const inputName = `input-${nTx}-${levels}`;
    const inputFile = path.join(pathName, `${inputName}.json`);

    // Start a new state
    const db = new SMTMemDB();
    const rollupDB = await RollupDb(db);
    const bb = await rollupDB.buildBatch(nTx, levels);

    await bb.build();
    const input = bb.getInput();

    fs.writeFileSync(inputFile, JSON.stringify(stringifyBigInts(input), null, 1), "utf-8");
}

module.exports = {
    compileCircuit,
    setupCircuit,
    inputs,
};