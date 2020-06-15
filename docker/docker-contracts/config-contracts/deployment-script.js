const ethers = require("ethers");
const Web3 = require("web3");
const fs = require("fs");
const path = require("path");

const poseidonUnit = require("./node_modules/circomlib/src/poseidon_gencontract.js");
const rollup = require("./build/contracts/Rollup.json");
const rollupPoB = require("./build/contracts/RollupPoB.json");

const configSynchPath = path.join(__dirname, "./synch-config.json");
const configPoolPath = path.join(__dirname, "./pool-config.json");
const walletPath = path.join(__dirname, "./wallet.json");

const pathRollupSynch = path.join(__dirname, "./rollup-operator/src/server/tmp-0");
const pathRollupTree = path.join(__dirname, "./rollup-operator/src/server/tmp-1");
const pathRollupPoBSynch = path.join(__dirname, "./rollup-operator/src/server/tmp-2");

// Global vars
// general
let web3;
let nodeEth;
let etherWallet;
let encWallet;
let web3Wallet;
let gasMul;
let maxDeposits;
let nonce2Send;

// rollup
let maxTx;
let maxOnChainTx;
let addressTokenFee;

// pob
let burnAddress;

// pool
let maxOffChainTx;
let poolTimeout;
let pathConversionTable;

// | Contract                | Gas Used |
// | ----------------------- | -------- |
// | Poseidon                | 1873872  |
// | Verifier                | 1244675  |
// | Rollup                  | 5376252  |
// | RollupPoB               | 3718667  |
// | LoadForgeMechanismPoSTx | 64385    |
// | addTokenTx              | 103305   |


const gasLimit = {
    poseidon: 2000000,
    verifier: 2000000,
    rollup: 6000000,
    rollupPoB: 4500000,
    loadForgeMechanismPoB: 100000,
    addTokenTx: 200000,
};

async function getGasPrice(gasMul){
    const strAvgGas = await web3.eth.getGasPrice();
    return (strAvgGas* gasMul).toString();
}

async function checkAddress(addressEth, isContract = true){
    
    const isValidAddress = await web3.utils.isAddress(addressEth);
    
    if (!isValidAddress)
        throw new Error(`Address ${addressEth} is not a valid address`);

    if (isContract){
        const addressCode = await web3.eth.getCode(addressEth);

        if (addressCode === "0x")
            throw new Error(`Address ${addressEth} does not contain any code`);
    }
}

async function loadVars(){

    // Check local configuration
    const pathEnvironmentFile = path.join(__dirname, "config.env");
    if (fs.existsSync(pathEnvironmentFile)) {
        require("dotenv").config({ path: pathEnvironmentFile });
    }
    
    // Check global environment variables
    if (!process.env.ETH_NODE_URL &&
        !process.env.MNEMONIC && 
        !process.env.INDEX_ACCOUNT && 
        !process.env.PASSWORD &&   
        !process.env.BRANCH
    ){
        throw new Error("Missing global environment variables which are required");
    } else {
        nodeEth = process.env.ETH_NODE_URL;
        web3 = new Web3(nodeEth);
    }

    // Check rollup environment variables
    if (!process.env.MAX_TX &&
        !process.env.MAX_ONCHAIN_TX &&
        !process.env.ROLLUP_TOKEN_FEE_ADDRESS
    ){
        throw new Error("Missing rollup environment variables which are required");
    } else {
        checkAddress(process.env.ROLLUP_TOKEN_FEE_ADDRESS, false);
        addressTokenFee = process.env.ROLLUP_TOKEN_FEE_ADDRESS;
    }

    // Check rollup PoB environment variables
    if (!process.env.POB_BURN_ADDRESS){
        throw new Error("Missing rollup PoB environment variables which are required");
    } else {
        checkAddress(process.env.POB_BURN_ADDRESS, false);
        burnAddress = process.env.POB_BURN_ADDRESS;
    }

    // Check pool environment variables
    if (!process.env.MAX_OFFCHAIN_TX &&
        !process.env.PATH_CONVERSION_TABLE
    ){
        throw new Error("Missing pool environment variables which are required");
    }

    // Load environment variables
    maxTx = process.env.MAX_TX;
    maxOnChainTx = process.env.MAX_ONCHAIN_TX;
    maxOffChainTx = process.env.MAX_OFFCHAIN_TX;
    poolTimeout = process.env.POOL_TIMEOUT || 10800;
    pathConversionTable = process.env.PATH_CONVERSION_TABLE;
    gasMul = process.env.GAS_MULTIPLIER ? parseInt(process.env.GAS_MULTIPLIER) : 1;
    maxDeposits = process.env.MAX_DEPOSITS ? process.env.MAX_DEPOSITS : "18";


    etherWallet = ethers.Wallet.fromMnemonic(process.env.MNEMONIC, `m/44'/60'/0'/0/${process.env.INDEX_ACCOUNT}`);
    encWallet = await etherWallet.encrypt(process.env.PASSWORD);
    web3Wallet = web3.eth.accounts.privateKeyToAccount(etherWallet.privateKey);

    nonce2Send = await web3.eth.getTransactionCount(etherWallet.address);
}

async function deployVerifier(){

    console.log("Verifier Contract");

    // get environment variable
    let verifierAddress = process.env.VERIFIER_ADDRESS || "noaddress";
    
    if (verifierAddress !== "debug" && verifierAddress !== "noaddress") {
        checkAddress(verifierAddress);
        console.log("   Loaded at: ", verifierAddress);
        return verifierAddress;  
    } else {
        let verifierInstance;

        if (verifierAddress === "debug")
            verifierInstance = require("./build/contracts/VerifierHelper.json");
        else {
            const pathVerifier = `./build/contracts/Verifier_${maxTx}_24.json`;

            if (fs.existsSync(pathVerifier)){
                verifierInstance = require(`./build/contracts/Verifier_${maxTx}_24.json`);
            } else {
                throw new Error(`Verifier with ${maxTx} transactions does not exist`);
            }  
        }

        const VerifierTx = {
            data: verifierInstance.bytecode,
            from: web3Wallet.address,
            nonce: nonce2Send++,
            gasLimit: gasLimit.verifier,
            gasPrice: await getGasPrice(gasMul),
        };

        const signedVerifier = await web3Wallet.signTransaction(VerifierTx);
        console.log("   Transaction Hash: ", signedVerifier.transactionHash);
        
        const resVerifier = await web3.eth.sendSignedTransaction(signedVerifier.rawTransaction);
        console.log("   Deployed: ", { resVerifier });
        console.log("\n\n");

        return resVerifier.contractAddress;
    }
}

async function deployPoseidon(){

    console.log("Poseidon Contract");

    // get environment variable
    const poseidonAddress = process.env.POSEIDON_ADDRESS || "noaddress";
    
    if (poseidonAddress !== "noaddress") {
        checkAddress(poseidonAddress);
        console.log("   Loaded at: ", poseidonAddress);
        return poseidonAddress;  
    } else {

        const PoseidonTx = {
            data: poseidonUnit.createCode(),
            from: web3Wallet.address,
            nonce: nonce2Send++,
            gasLimit: gasLimit.poseidon,
            gasPrice: await getGasPrice(gasMul),
        };

        const signedPoseidon = await web3Wallet.signTransaction(PoseidonTx);
        console.log("   Transactoin Hash: ", signedPoseidon.transactionHash);
        
        const resPoseidon = await web3.eth.sendSignedTransaction(signedPoseidon.rawTransaction);
        console.log("   Deployed: ", { resPoseidon });
        console.log("\n\n");

        return resPoseidon.contractAddress;
    }
}

async function deployRollup(poseidonAddress, verifierAddress){

    console.log("Rollup contract");

    const rollupContract = new web3.eth.Contract(rollup.abi);

    const RollupTx = {
        data: rollupContract.deploy({
            data: rollup.bytecode,
            arguments: [verifierAddress, poseidonAddress, maxTx, maxOnChainTx, addressTokenFee]
        }).encodeABI(),
        from: web3Wallet.address,
        nonce: nonce2Send++,
        gasLimit: gasLimit.rollup,
        gasPrice: await getGasPrice(gasMul),
    };

    const signedRollup = await web3Wallet.signTransaction(RollupTx);
    console.log("   Transactoin Hash: ", signedRollup.transactionHash);

    const resRollup = await web3.eth.sendSignedTransaction(signedRollup.rawTransaction);
    console.log("   Deployed: ", { resRollup });
    console.log("\n\n");
    
    return {address: resRollup.contractAddress, transactionHash: resRollup.transactionHash};
}

async function deployRollupPoB(rollupAddress){

    const urlOperator = process.env.POB_URL_DEFAULT || "nourl";

    const rollupPoBContract =  new web3.eth.Contract(rollupPoB.abi);
    
    console.log("Deploying RollupPoB");
    const RollupPoSTx = {
        data: rollupPoBContract.deploy({
            data: rollupPoB.bytecode,
            arguments: [rollupAddress, maxTx, burnAddress, etherWallet.address, urlOperator]
        }).encodeABI(),
        from: web3Wallet.address,
        nonce: nonce2Send++,
        gasLimit: gasLimit.rollupPoB,
        gasPrice: await getGasPrice(gasMul),
    };

    const signedRollupPoB = await web3Wallet.signTransaction(RollupPoSTx);
    console.log("   Transactoin Hash: ", signedRollupPoB.transactionHash);
    
    const resRollupPoB = await web3.eth.sendSignedTransaction(signedRollupPoB.rawTransaction);
    console.log("   Deployed: ", { resRollupPoB }); 
    console.log("\n\n");

    return {address: resRollupPoB.contractAddress, transactionHash: resRollupPoB.transactionHash};
}

async function loadForgeBatchMechanism(rollupAddress, rollupPoBAddress){
    console.log("Load forge mechanism PoB");

    const rollupContract =  new web3.eth.Contract(rollup.abi);

    const loadForgeMechanismPoSTx = {
        from: web3Wallet.address,
        to: rollupAddress,
        nonce: nonce2Send++,
        gasLimit: gasLimit.loadForgeMechanismPoB,
        data: rollupContract.methods.loadForgeBatchMechanism(rollupPoBAddress).encodeABI(),
        gasPrice: await getGasPrice(gasMul),
    };
    
    const signedLoadForgeMechanismPoSTx = await web3Wallet.signTransaction(loadForgeMechanismPoSTx);
    console.log("   Transactoin Hash: ", signedLoadForgeMechanismPoSTx.transactionHash);
    
    const resLoadForgeMechanismPoSTx = await web3.eth.sendSignedTransaction(signedLoadForgeMechanismPoSTx.rawTransaction);
    console.log("   Transaction receipt: ", { resLoadForgeMechanismPoSTx });
}

async function addToken(rollupAddress){

    const token2AddAddress = process.env.ROLLUP_ADD_TOKEN_ADDRESS || "notoken"; 
    const rollupContract =  new web3.eth.Contract(rollup.abi);

    if (token2AddAddress !== "notoken"){
        checkAddress(token2AddAddress, false);

        console.log("Add new token in rollup");

        rollupContract.options.address = rollupAddress;
        const feeAddToken= await rollupContract.methods.feeAddToken().call();
        const addTokenTx = {
            from: web3Wallet.address,
            to: rollupAddress,
            nonce: nonce2Send++,
            gasLimit: gasLimit.addTokenTx,
            data: rollupContract.methods.addToken(token2AddAddress).encodeABI(),
            value: feeAddToken,
            gasPrice: await getGasPrice(gasMul),
        };
        
        const signedAddTokenTx = await web3Wallet.signTransaction(addTokenTx);   
        console.log("   Transactoin Hash: ", signedAddTokenTx.transactionHash);
        
        const resAddTokenTx = await web3.eth.sendSignedTransaction(signedAddTokenTx.rawTransaction);
        console.log("   Transaction succesfull: ", { resAddTokenTx });  
    } else {
        console.log("No tokens has been set to add it to rollup");
    }
}

async function createConfig(){
    
    await loadVars();
    
    const poseidonAddress = await deployPoseidon();    
    const verifierAddress = await deployVerifier();

    const rollupData = await deployRollup(poseidonAddress, verifierAddress);
    const rollupPoBData = await deployRollupPoB(rollupData.address);

    await loadForgeBatchMechanism(rollupData.address, rollupPoBData.address);
    await addToken(rollupData.address);
    
    // Write useful configuration files
    const configSynch = {
        rollup: {
            synchDb: pathRollupSynch,
            treeDb: pathRollupTree,
            address: rollupData.address,
            abi: rollup.abi,
            creationHash: rollupData.transactionHash,
        },
        rollupPoB: {
            synchDb: pathRollupPoBSynch,
            address: rollupPoBData.address,
            abi: rollupPoB.abi,
            creationHash: rollupPoBData.transactionHash,
        },
        ethNodeUrl: nodeEth,
        ethAddress: etherWallet.address,
    };
    
    const configPool = {
        "maxSlots": maxTx,               
        "executableSlots": maxOnChainTx,      
        "nonExecutableSlots": maxOffChainTx,      
        "timeout": poolTimeout,
        "pathConversionTable": pathConversionTable,
        "maxDeposits": maxDeposits        
    };

    fs.writeFileSync(configSynchPath, JSON.stringify(configSynch));
    fs.writeFileSync(configPoolPath, JSON.stringify(configPool));
    fs.writeFileSync(walletPath, JSON.stringify(JSON.parse(encWallet)));
}

createConfig();
