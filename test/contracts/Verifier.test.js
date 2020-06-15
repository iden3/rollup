/* global artifacts */
/* global contract */

const chai = require("chai");
const { expect } = chai;
const Verifier16 = artifacts.require("../contracts/verifiers/Verifier_16_24");
const Verifier128 = artifacts.require("../contracts/verifiers/Verifier_128_24");

const { generateCall } = require("../../rollup-operator/src/utils");

contract("Verifier", () => {

    let insVerifier16;
    let insVerifier128;

    let proof16;
    let proof128;

    const proofServer16 = {
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

    const proofServer128 = {
        proofA: [
            "16800683322358729782558539405444460657095236755164804941741334024853300252926",
            "13637424009861970428436032241205875210112061894739973602480381219489614968408"
        ],
        proofB: [
            [
                "20188414792447662050888918983778584008338108248112647856696049252327606701446",
                "16271649501527115135443119169398969989740342088044025504740081638310753880036"
            ],
            [
                "15629987825442031163542187923243139838847837497408982898813570345424325112877",
                "3609095780336634668540313867001449384068132366490686870759313434627663556514"
            ]
        ],
        proofC: [
            "3196470311703647745929562460070537579992309515710537067718315974586923451124",
            "3097275469822708168033734516791292342184892905177629377823920901988464729120",
        ],
        publicInputs: [
            "0",
            "0",
            "0",
            "0",
            "6446566627056056266281880624075440234336819950888749561686198322173882165734",
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
        insVerifier16 = await Verifier16.new();
        insVerifier128 = await Verifier128.new();
    });

    it("should generate input parameters for contract", async () => {
        proof16 = generateCall(proofServer16);
        proof128 = generateCall(proofServer128);
    });

    it("verify correct proof 16", async () => {
        const res = await insVerifier16.verifyProof(proof16.proofA, proof16.proofB, proof16.proofC,
            proof16.publicInputs);
        expect(res).to.be.equal(true);

        const gasVerify = (await insVerifier16.verifyProof.estimateGas(proof16.proofA, proof16.proofB, proof16.proofC,
            proof16.publicInputs)).toString();
        
        console.log("Gas spend by \"VerifyProof16\" function: ", gasVerify);
    });

    it("verify incorrect proof 16", async () => {
        proof16.publicInputs[9] = inputChange;

        const res = await insVerifier16.verifyProof(proof16.proofA, proof16.proofB, proof16.proofC,
            proof16.publicInputs);
        expect(res).to.be.equal(false);
    });

    it("verify correct proof 128", async () => {
        const res = await insVerifier128.verifyProof(proof128.proofA, proof128.proofB, proof128.proofC,
            proof128.publicInputs);
        expect(res).to.be.equal(true);

        const gasVerify = (await insVerifier128.verifyProof.estimateGas(proof128.proofA, proof128.proofB, proof128.proofC,
            proof128.publicInputs)).toString();
        
        console.log("Gas spend by \"VerifyProof128\" function: ", gasVerify);
    });

    it("verify incorrect proof 128", async () => {
        proof128.publicInputs[9] = inputChange;

        const res = await insVerifier128.verifyProof(proof128.proofA, proof128.proofB, proof128.proofC,
            proof128.publicInputs);
        expect(res).to.be.equal(false);
    });
});