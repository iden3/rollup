/* global artifacts */
/* global web3 */

const poseidonUnit = require("../node_modules/circomlib/src/poseidon_gencontract.js");
const Verifier = artifacts.require("../contracts/test/VerifierHelper");
const Rollup = artifacts.require("../contracts/Rollup");
const TokenRollup = artifacts.require("../contracts/test/TokenRollup");
const RollupPoS = artifacts.require("../contracts/RollupPoS");

const maxTx = 4;
const maxOnChainTx = 2;
const initialAmount = 1000;
let insPoseidonUnit;
let feeTokenAddress = "0x29a9b6486667E67e4ef9e586E3622d35b19E3E7E";

module.exports = async function (deployer, network, accounts) {
    const C = new web3.eth.Contract(poseidonUnit.abi);
    insPoseidonUnit = await C.deploy({ data: poseidonUnit.createCode() })
        .send({ gas: 2500000, from: accounts[0] });
    // console.log("Poseidon address:" + insPoseidonUnit._address);
    await deployer.deploy(TokenRollup, accounts[0], initialAmount);
    // console.log("Token rollup address:" + TokenRollup.address);
    await deployer.deploy(Verifier);
    // console.log("Verifier address:" + Verifier.address);
    await deployer.deploy(Rollup, Verifier.address, insPoseidonUnit._address,
        maxTx, maxOnChainTx, feeTokenAddress);
    // console.log("Rollup address:" + Rollup.address);
    await deployer.deploy(RollupPoS, Rollup.address, maxTx);
    // console.log("RollupPoS address:" + RollupPoS.address);
    // load forge batch mechanism
    const insRollup = await Rollup.deployed();
    await insRollup.loadForgeBatchMechanism(RollupPoS.address);
};
