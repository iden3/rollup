const fs = require("fs");
const path = require("path");
const util = require("util");
const exec = util.promisify(require("child_process").exec);
const process = require("child_process");
const { stringifyBigInts } = require("ffjavascript").utils;
const Scalar = require("ffjavascript").Scalar;
const buildZqField = require("ffiasm").buildZqField;
const { performance } = require("perf_hooks");

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
    const startTime = performance.now();

    const pathName = path.join(__dirname, `../rollup-${nTx}-${levels}`);
    const cirName = `${circuitName}-${nTx}-${levels}.circom`;

    const cmd = `cd ${pathName} && \
    node  --max-old-space-size=100000 \
    ../../node_modules/circom/cli.js \
    ${cirName} \
    -c -r -v`; 
    console.log(cmd);
    const out = process.exec(cmd);
    out.stdout.on("data", (data) => {
        console.log(data);
    });
    
    const stopTime = performance.now();
    
    console.log(`Compile command took ${(stopTime - startTime)/1000} s`);
}

async function setupCircuit(nTx, levels, setupFile) {
    const startTime = performance.now();

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

    const stopTime = performance.now();
    
    console.log(`Setup command took ${(stopTime - startTime)/1000} s`);
}

async function inputs(nTx, levels) {
    const startTime = performance.now();

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

    const beneficiaryAddress = "0x123456789abcdef123456789abcdef123456789a";
    bb.addBeneficiaryAddress(beneficiaryAddress);
    
    await bb.build();
    const input = bb.getInput();

    fs.writeFileSync(inputFile, JSON.stringify(stringifyBigInts(input), null, 1), "utf-8");

    const stopTime = performance.now();
    
    console.log(`Input command took ${(stopTime - startTime)/1000} s`);
}

async function witness(nTx, levels, platform){
    const startTime = performance.now();

    // create folder to store input file
    const pathName = path.join(__dirname, `../rollup-${nTx}-${levels}`);
    const cppName = path.join(pathName, `${circuitName}-${nTx}-${levels}.cpp`); 

    // compile witness cpp program
    const pathBase = path.dirname(cppName);
    const baseName = path.basename(cppName);

    const pThread = await compileFr(pathBase, platform);

    const cdir = path.join(path.dirname(require.resolve("circom_runtime")), "c");

    console.error("Compiling witness...");

    await exec("g++" + ` ${pThread}` +
               ` ${path.join(cdir,  "main.cpp")}` +
               ` ${path.join(cdir,  "calcwit.cpp")}` +
               ` ${path.join(cdir,  "utils.cpp")}` +
               ` ${path.join(pathBase,  "fr.c")}` +
               ` ${path.join(pathBase,  "fr.o")}` +
               ` ${path.join(pathBase, baseName)} ` +
               ` -o ${path.join(pathBase, path.parse(baseName).name)}` +
               ` -I ${pathBase} -I${cdir}` +
               " -lgmp -std=c++11 -DSANITY_CHECK -g"
    );

    console.error("Witness compilation done");

    // generate empty witness as an example
    const witnessName = path.join(pathName, `witness-${nTx}-${levels}.bin`);
    const inputName = path.join(pathName, `input-${nTx}-${levels}.json`);

    const cmd2 = `cd ${pathName} && ./${circuitName}-${nTx}-${levels} ${inputName} ${witnessName}`;

    console.log("Calculating witness example...");
    console.time("witness time");
    await exec(cmd2);
    console.timeEnd("witness time");
    console.log("Witness example calculated");

    const stopTime = performance.now();
    
    console.log(`Witness command took ${(stopTime - startTime)/1000} s`);
}

async function compileFr(pathC, platform){

    const p = Scalar.fromString("21888242871839275222246405745257275088548364400416034343698204186575808495617");

    const source = await buildZqField(p, "Fr");

    fs.writeFileSync(path.join(pathC, "fr.asm"), source.asm, "utf8");
    fs.writeFileSync(path.join(pathC, "fr.h"), source.h, "utf8");
    fs.writeFileSync(path.join(pathC, "fr.c"), source.c, "utf8");

    let pThread = "";

    if (platform === "darwin") {
        await exec("nasm -fmacho64 --prefix _ " +
            ` ${path.join(pathC,  "fr.asm")}`
        );
    }  else if (platform === "linux") {
        pThread = "-pthread";
        await exec("nasm -felf64 " +
            ` ${path.join(pathC,  "fr.asm")}`
        );
    } else throw("Unsupported platform");

    return pThread;
}

async function exportFiles(nTx, levels){

    let config;
    if (fs.existsSync(`${__dirname}/../config.json`))
        config = JSON.parse(fs.readFileSync(`${__dirname}/../config.json`, "utf8"));
    else {
        console.error(`Config file ${__dirname}/../config.json is missing`);
        process.exit(0);
    }

    // Folders
    const pyCir = config.pathCir;

    // Files to export
    const pathName = path.join(__dirname, `../rollup-${nTx}-${levels}`);
    
    const pkName = `pk-${nTx}-${levels}`;
    const pkFile = path.join(pathName, `${pkName}.bin`);

    const vkName = `vk-${nTx}-${levels}`;
    const vkFile = path.join(pathName, `${vkName}.json`);

    const witnessCppName = `${circuitName}-${nTx}-${levels}`;
    const witnessCppFile = path.join(pathName, `${witnessCppName}`);

    const cmd = `cp ${pkFile} ${pyCir} && ` +
                `cp ${vkFile} ${pyCir} && ` +
                `cp ${witnessCppFile} ${pyCir}`;
    
    await exec(cmd);
}

module.exports = {
    createCircuit,
    compileCircuit,
    setupCircuit,
    inputs,
    witness,
    exportFiles,
};