/* global artifacts */
/* global contract */

const chai = require("chai");
const { expect } = chai;
const Verifier = artifacts.require("../contracts/verifiers/Verifier_16_24");

const { generateCall } = require("../../rollup-operator/src/utils");

contract("Verifier", () => {

    let insVerifier;

    let proof;

    const proofServer = {
        proofA: [
            "9253558836951391180215401092285942392106850777386280952695062100433051361088",
            "18697207118335119388548517833235335684285063697800660628381013502181764601642"
        ],
        proofB: [
            [
                "16819816793033687854457570364443713703712988943424356538480617917260408774895", 
                "15339146369398367592555915429051222557792280537981727126816909815432548334387"
            ],
            [
                "11471305792942219955083942233076207445275372852040435338302711224619012307806",
                "19304473865083891746231449156526543962120656926030787909826253015449194244154"
            ]
        ],
        proofC: [
            "17511460333203330740661919811828192033379494070881427968160555529501062259", 
            "15107370117321020231678791673933590649795613180360293311916826899106455614893"
        ],
        publicInputs: [
            "0",
            "0",
            "0",
            "0",
            "17121139641034451728603403693688230434069818244575059927391929551411913760048",
            "0",
            "0",
            "0",
            "1809279001739708310272933373752901772209482937325336653336454810774441821184",
            "103929005321308650693500321209372945468207036570"
        ],
    };

    const inputChange = "0x000000000000000000000000123456789abcdef123456789abcdef123456789b";

    before(async () => {
    // Deploy new contract
        insVerifier = await Verifier.new();
    });

    it("should generate input parameters for contract", async () => {
        proof = generateCall(proofServer);
    });

    it("verify correct proof", async () => {
        const res = await insVerifier.verifyProof(proof.proofA, proof.proofB, proof.proofC,
            proof.publicInputs);
        expect(res).to.be.equal(true);
    });

    it("verify incorrect proof", async () => {
        proof.publicInputs[9] = inputChange;

        const res = await insVerifier.verifyProof(proof.proofA, proof.proofB, proof.proofC,
            proof.publicInputs);
        expect(res).to.be.equal(false);
    });
});
