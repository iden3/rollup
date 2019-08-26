/* global artifacts */
/* global contract */
/* global web3 */
/* global assert */

const poseidonUnit = require('../node_modules/circomlib/src/poseidon_gencontract.js');
const Verifier = artifacts.require('../contracts/test/VerifierHelper');
const Rollup = artifacts.require('../contracts/Rollup');

let insPoseidonUnit;

module.exports = async function (deployer, network, accounts) {
  const C = new web3.eth.Contract(poseidonUnit.abi);
  insPoseidonUnit = await C.deploy({ data: poseidonUnit.createCode() })
    .send({ gas: 2500000, from: accounts[0] });
};
