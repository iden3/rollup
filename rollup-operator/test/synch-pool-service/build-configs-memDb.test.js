/* global artifacts */
/* global contract */
/* global web3 */

const poseidonUnit = require("circomlib/src/poseidon_gencontract");
const fs = require("fs");
const path = require("path");

const Verifier = artifacts.require("../contracts/test/VerifierHelper");
const Rollup = artifacts.require("../contracts/test/Rollup");
const configSynchPoolPath = path.join(__dirname, "./config/config-test.json");
const pathConversionTable = path.join(__dirname,"./config/table-conversion-test.json");
const pathCustomTokens = path.join(__dirname,"./config/custom-test.json");

contract("Synnchronizer Pool", (accounts) => {
    const {
        0: owner,
        2: feeTokenAddress,
        3: ethAddress,
    } = accounts;

    const maxTx = 10;
    const maxOnChainTx = 5;
    
    let insPoseidonUnit;
    let insRollup;
    let insVerifier;

    before(async () => {
        // Deploy poseidon
        const C = new web3.eth.Contract(poseidonUnit.abi);
        insPoseidonUnit = await C.deploy({ data: poseidonUnit.createCode()})
            .send({ gas: 2500000, from: owner });

        // Deploy Verifier
        insVerifier = await Verifier.new();

        // Deploy Rollup
        insRollup = await Rollup.new(insVerifier.address, insPoseidonUnit._address,
            maxTx, maxOnChainTx, feeTokenAddress);
    });

    it("Should build configuration for synch pool service", async () => {
        let config = {
            pathDb: undefined,
            ethNodeUrl: "http://localhost:8545",
            ethAddress: ethAddress,
            rollupAddress: insRollup.address,
            rollupAbi: Rollup.abi,
            logLevel: "debug",
            pathConversionTable: pathConversionTable,
            pathCustomTokens: pathCustomTokens,
            timeouts: { ERROR: 5000, NEXT_LOOP: 5000 },
        };

        fs.writeFileSync(configSynchPoolPath, JSON.stringify(config));
    });
});