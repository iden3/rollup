const poseidonUnit = require("./node_modules/circomlib/src/poseidon_gencontract.js");
const verifier = require("./build/contracts/VerifierHelper.json");
const rollup = require("./build/contracts/Rollup.json");
const rollupPoS = require("./build/contracts/RollupPoS.json");
const ethers = require("ethers");
const Web3 = require("web3");
const fs = require("fs");
const path = require("path");
const configSynchPath = path.join(__dirname, "./synch-config.json");
const configPoolPath = path.join(__dirname, "./pool-config.json");
const walletPath = path.join(__dirname, "./wallet.json");
const pathRollupSynch = path.join(__dirname, "./rollup-operator/src/server/tmp-0");
const pathRollupTree = path.join(__dirname, "./rollup-operator/src/server/tmp-1");
const pathRollupPoSSynch = path.join(__dirname, "./rollup-operator/src/server/tmp-2");


// | Contract                | Gas Used |
// | ----------------------- | -------- |
// | Poseidon                | 1873872  |
// | Verifier                | 159847   |
// | Rollup                  | 4130071  |
// | RollupPoS               | 4121055  |
// | addTokenTx              | 102456   |
// | LoadForgeMechanismPoSTx | 64416    |
const gasLimit = {
    poseidon: 2000000,
    verifier: 200000,
    rollup: 5000000,
    rollupPoS: 5000000,
    addTokenTx: 200000,
    loadForgeMechanismPoSTx: 100000
};

async function getGasPrice(gasMul){
    const web3 = new Web3(process.env.ETH_NODE_URL);
    const strAvgGas = await web3.eth.getGasPrice();
    return (strAvgGas* gasMul).toString();
}

async function createConfig(){
    const pathEnvironmentFile = path.join(__dirname, "config.env");
    if (fs.existsSync(pathEnvironmentFile)) {
        require("dotenv").config({ path: pathEnvironmentFile });
    } 
    if (!process.env.MNEMONIC && !process.env.INDEX_ACCOUNT && !process.env.INDEX_ACCOUNT_TOKEN_FEES &&  
        !process.env.ETH_NODE_URL && !process.env.MAX_TX && !process.env.MAX_ONCHAIN_TX)
    {
        throw new Error("There's need a config.env or enviroment variables to proceed, in README.md there's further information");
    }

    const maxTx = process.env.MAX_TX || 256;
    const maxOnChainTx = process.env.MAX_ONCHAIN_TX || 128;
    const maxOffChainTx = process.env.MAX_OFFCHAIN_TX || 128;
    const poolTimeout = process.env.POOL_TIMEOUT || 10800;
    const gasMul = process.env.GAS_MULTIPLIER ? parseInt(process.env.GAS_MULTIPLIER) : 1;
    const web3 = new Web3(process.env.ETH_NODE_URL);
    const etherWallet = ethers.Wallet.fromMnemonic(process.env.MNEMONIC, `m/44'/60'/0'/0/${process.env.INDEX_ACCOUNT}`);
    const encWallet = await etherWallet.encrypt(process.env.PASSWORD);
    const addressFee = ethers.Wallet.fromMnemonic(process.env.MNEMONIC, `m/44'/60'/0'/0/${process.env.INDEX_ACCOUNT_TOKEN_FEES}`).address;
    const web3Wallet = web3.eth.accounts.privateKeyToAccount(etherWallet.privateKey);
    
    const rollupContract =  new web3.eth.Contract(rollup.abi);
    const rollupPoSContract =  new web3.eth.Contract(rollupPoS.abi);
    let nonceToSend = await web3.eth.getTransactionCount(etherWallet.address);
    console.log("Deploying Poseidon");
    const PoseidonTx = {
        data: poseidonUnit.createCode(),
        from: web3Wallet.address,
        nonce: nonceToSend++,
        gasLimit: gasLimit.poseidon,
        gasPrice: await getGasPrice(gasMul),
    };
    const signedPoseidon = await web3Wallet.signTransaction(PoseidonTx);
    console.log("Transactoin Hash: ", signedPoseidon.transactionHash);
    const resPoseidon = await web3.eth.sendSignedTransaction(signedPoseidon.rawTransaction);
    console.log("Poseidon Deployed", {"receipt poseidon":resPoseidon});

    console.log("\n\n");
    console.log("Deploying Verifier");
    const VerifierTx = {
        data: verifier.bytecode,
        from: web3Wallet.address,
        nonce: nonceToSend++,
        gasLimit: gasLimit.verifier,
        gasPrice: await getGasPrice(gasMul),
    };
    const signedVerifier = await web3Wallet.signTransaction(VerifierTx);
    console.log("Transactoin Hash: ", signedVerifier.transactionHash);
    const resVerifier = await web3.eth.sendSignedTransaction(signedVerifier.rawTransaction);
    console.log("Verifier Deployed", {"receipt verifier":resVerifier});

    console.log("\n\n");
    console.log("Deploying Rollup");
    const RollupTx = {
        data: rollupContract.deploy({
            data: rollup.bytecode,
            arguments: [resVerifier.contractAddress, resPoseidon.contractAddress, maxTx, maxOnChainTx, addressFee]
        }).encodeABI(),
        from: web3Wallet.address,
        nonce: nonceToSend++,
        gasLimit: gasLimit.rollup,
        gasPrice: await getGasPrice(gasMul),
    };
    const signedRollup = await web3Wallet.signTransaction(RollupTx);
    console.log("Transactoin Hash: ", signedRollup.transactionHash);
    const resRollup = await web3.eth.sendSignedTransaction(signedRollup.rawTransaction);
    console.log("Rollup Deployed", {"receipt rollup":resRollup});

    console.log("\n\n");
    console.log("Deploying RollupPoS");
    const RollupPoSTx = {
        data: rollupPoSContract.deploy({
            data: rollupPoS.bytecode,
            arguments: [resRollup.contractAddress, maxTx]
        }).encodeABI(),
        from: web3Wallet.address,
        nonce: nonceToSend++,
        gasLimit: gasLimit.rollupPoS,
        gasPrice: await getGasPrice(gasMul),
    };
    const signedRollupPoS = await web3Wallet.signTransaction(RollupPoSTx);
    console.log("Transactoin Hash: ", signedRollupPoS.transactionHash);
    const resRollupPoS = await web3.eth.sendSignedTransaction(signedRollupPoS.rawTransaction);
    console.log("RollupPoS Deployed", {"receipt rollupPoS":resRollupPoS});  

    console.log("\n\n");
    console.log("Load forge mechanism PoS");
    const loadForgeMechanismPoSTx = {
        from: web3Wallet.address,
        to: resRollup.contractAddress,
        nonce: nonceToSend++,
        gasLimit: gasLimit.loadForgeMechanismPoSTx,
        data: rollupContract.methods.loadForgeBatchMechanism(resRollupPoS.contractAddress).encodeABI(),
        gasPrice: await getGasPrice(gasMul),
    };
    const signedLoadForgeMechanismPoSTx = await web3Wallet.signTransaction(loadForgeMechanismPoSTx);
    console.log("Transactoin Hash: ", signedLoadForgeMechanismPoSTx.transactionHash);
    const resLoadForgeMechanismPoSTx = await web3.eth.sendSignedTransaction(signedLoadForgeMechanismPoSTx.rawTransaction);
    console.log("Forge mechanism loaded", {"receipt load PoS":resLoadForgeMechanismPoSTx});  

    if (process.env.TOKEN_ADDRESS){
        rollupContract.options.address =resRollup.contractAddress;
        const feeAddToken= await rollupContract.methods.feeAddToken().call();
        console.log({feeAddToken});
        console.log("\n\n");
        console.log("Add new token in rollup");
        const addTokenTx = {
            from: web3Wallet.address,
            to: resRollup.contractAddress,
            nonce: nonceToSend++,
            gasLimit: gasLimit.addTokenTx,
            data: rollupContract.methods.addToken(process.env.TOKEN_ADDRESS).encodeABI(),
            value: feeAddToken,
            gasPrice: await getGasPrice(gasMul),
        };
        const signedAddTokenTx = await web3Wallet.signTransaction(addTokenTx);   
        console.log("Transactoin Hash: ", signedAddTokenTx.transactionHash);
        const resAddTokenTx = await web3.eth.sendSignedTransaction(signedAddTokenTx.rawTransaction);
        console.log("Token added", {"receipt add token":resAddTokenTx});  
    }
    else{
        console.log("No tokens added to rollup");
    }

    const configSynch = {
        rollup: {
            synchDb: pathRollupSynch,
            treeDb: pathRollupTree,
            address: resRollup.contractAddress,
            abi: rollup.abi,
            creationHash: resRollup.transactionHash,
        },
        rollupPoS: {
            synchDb: pathRollupPoSSynch,
            address: resRollupPoS.contractAddress,
            abi: rollupPoS.abi,
            creationHash: resRollupPoS.transactionHash,
        },
        ethNodeUrl: process.env.ETH_NODE_URL,
        ethAddress: etherWallet.address,
    };
    
    const configPool = {
        "maxSlots": maxTx,               
        "executableSlots": maxOnChainTx,      
        "nonExecutableSlots": maxOffChainTx,      
        "timeout": poolTimeout,
        "pathConversionTable": process.env.PATH_CONVERSION_TABLE        
    };

    fs.writeFileSync(configSynchPath, JSON.stringify(configSynch));
    fs.writeFileSync(configPoolPath, JSON.stringify(configPool));
    fs.writeFileSync(walletPath, JSON.stringify(JSON.parse(encWallet)));
}

createConfig();
