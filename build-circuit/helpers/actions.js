const fs = require("fs");
const path = require("path");
const snarkjs = require("snarkjs");
const compiler = require("circom");
const JSONStream = require("JSONStream");
const util = require("util");
const exec = util.promisify(require("child_process").exec);
const process = require("child_process");
const { stringifyBigInts } = require("snarkjs");

// Define name-files
const circuitName = "circuit";

async function createCircuit(nTx, levels){
    // create folder to store circuit files
    const pathName = path.join(__dirname, `../rollup-${nTx}-${levels}`);
    if (!fs.existsSync(pathName))
        fs.mkdirSync(pathName);

    const circuitCode = `include "../../circuits/rollup.circom";\n
    component main = Rollup(${nTx}, ${levels});`;

    // store circuit
    const circuitCodeFile = path.join(pathName, `${circuitName}-${nTx}-${levels}.circom`);
    fs.writeFileSync(circuitCodeFile, circuitCode, "utf8");
}


async function compileCircuit(nTx, levels) {
    const pathName = path.join(__dirname, `../rollup-${nTx}-${levels}`);
    const cirName = `${circuitName}-${nTx}-${levels}.circom`;

    const cmd = `cd ${pathName} && \
    node  --max-old-space-size=50000 \
    ../../../circom/cli.js \
    ${cirName} \
    -c -r -v`; 

    const out = process.exec(cmd);
    out.stdout.on("data", (data) => {
        console.log(data);
    });
}

async function setupCircuit(nTx, levels, setupFile) {
    
    let config;
    if (fs.existsSync(`${__dirname}/../config.json`))
        config = JSON.parse(fs.readFileSync(`${__dirname}/../config.json`, "utf8"));
    else {
        console.error(`Config file ${__dirname}/../config.json is missing`);
        process.exit(0);
    }

    let extension;
    if (setupFile === "r1cs")
        extension = ".r1cs";
    else extension = ".json";

    // Folders
    const pySrc = config.pathSrc;
    const pyCir = config.pathCir;
    const list = config.list;

    const circuitInputName = `${circuitName}-${nTx}-${levels}`;
    const pathName = path.join(__dirname, `../rollup-${nTx}-${levels}`); 
    const circuitInputFile = path.join(pathName, `${circuitInputName}${extension}`);
    
    // check circuit file exist
    if (!fs.existsSync(circuitInputFile)){
        console.log(`Circuit file: ${circuitInputFile} does not exist`);
        return;
    } else {
        const pkCirFile = path.join(pyCir, `${circuitInputName}${extension}`);
        const cmd = `cp ${circuitInputFile} ${pkCirFile}`;
        await exec(cmd);
    }

    // CUDA_VISIBLE_DEVICES=1,2 python3 pysnarks.py -m s -in_c r1cs4M_c.bin -pk r1cs4M_pk.bin -vk r1cs4M_vk.json 

    const pkOutputName = `pk-${nTx}-${levels}`;
    const pkOutputFile = path.join(pathName, `${pkOutputName}.bin`);
    // const pkOutputFile = path.join(pyCir, `${pkOutputName}.bin`);

    const vkOutputName = `vk-${nTx}-${levels}`;
    const vkOutputFile = path.join(pathName, `${vkOutputName}.json`);
    // const vkOutputFile = path.join(pyCir, `${vkOutputName}.json`);

    const cmd = `cd ${pySrc} && \
    CUDA_VISIBLE_DEVICES=${list} \
    python3 pysnarks.py -m s \
    -in_c ${circuitInputFile} \
    -pk ${pkOutputFile} \
    -vk ${vkOutputFile}`;
    console.error("Calculating setup...");
    await exec(cmd);
    console.error("Setup finished");
}

async function inputs(nTx, levels) {
    const SMTMemDB = require("circomlib").SMTMemDB;
    const RollupDb = require("../../js/rollupdb");

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

async function witness(nTx, levels){
    let config;
    if (fs.existsSync(`${__dirname}/../config.json`))
        config = JSON.parse(fs.readFileSync(`${__dirname}/../config.json`, "utf8"));
    else {
        console.error(`Config file ${__dirname}/../config.json is missing`);
        process.exit(0);
    }

    const circomPath = config.pathCircom;

    // create folder to store input file
    const pathName = path.join(__dirname, `../rollup-${nTx}-${levels}`);
    const cppName = path.join(pathName, `${circuitName}-${nTx}-${levels}.cpp`);
    const exeOutputName = path.join(pathName, `${circuitName}-${nTx}-${levels}`); 

    // compile witness cpp program
    const cmd = `g++ -pthread ${cppName} \
    ${circomPath}/c/main.cpp \
    ${circomPath}/c/calcwit.cpp \
    ${circomPath}/c/fr.c \
    ${circomPath}/c/fr.o \
    ${circomPath}/c/utils.cpp \
    -o ${exeOutputName} -I ${circomPath}/c -lgmp -std=c++11 -O3`;

    console.error("Compiling witness...");
    await exec(cmd);
    console.error("Witness compilation done");

    // generate empty witness as an example
    const witnessName = path.join(pathName, `witness-${nTx}-${levels}.bin`);
    const inputName = path.join(pathName, `input-${nTx}-${levels}.json`);

    const cmd2 = `cd ${pathName} && ./${circuitName}-${nTx}-${levels} ${inputName} ${witnessName}`;

    console.log("Calculating witness example...");
    await exec(cmd2);
    console.log("Witness example calculated");
}


module.exports = {
    createCircuit,
    compileCircuit,
    setupCircuit,
    inputs,
    witness,
};