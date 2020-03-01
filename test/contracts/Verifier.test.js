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
        proofA: ["9957705619370292715314504544887915433730593129729226776692857676680909293296", "19095077379038349733686944415544157292925814358918091121839656059525481733907"],
        proofB: [["14594518315528653447810886795056720171551520852695218444124211251535418383907", "13780170386871124733496137302984099797864251376186358209034879341122609349592"],
            ["8931775236553317175839508857307562038697295191483922035146797122880365543058", "20796196030654652942070512738563521797990496856306682971436410496140679264636"]],
        proofC: ["7129905686377782884306224900916529740665890733301597278687882486271948008612", "18897771028139104549958702889825633253570994899298299703572456522084295868435"],
        publicInputs: ["0","0",
            "0","16186323098297518352005776852277589061624321541262190393338420202752241764101",
            "0","0",
            "0","0"],
    };

    const inputChange = "0x0f35b130a033a10d021a636718b9c881e9d552e6e974bad03c18b47dbd2995e7";

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
        proof.publicInputs[0] = inputChange;
        const res = await insVerifier.verifyProof(proof.proofA, proof.proofB, proof.proofC,
            proof.publicInputs);
        expect(res).to.be.equal(false);
    });
});
