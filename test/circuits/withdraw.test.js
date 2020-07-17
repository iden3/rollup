const { expect } = require("chai");
const path = require("path");
const tester = require("circom").tester;
const Scalar = require("ffjavascript").Scalar;
const utils = require("../../js/utils");
const SMTMemDB = require("circomlib").SMTMemDB;
const RollupDB = require("../../js/rollupdb");
const Constants = require("../../js/constants");
const RollupAccount = require("../../js/rollupaccount");

const NTX = 4;
const NLEVELS = 24;

async function depositTx(bb, account, loadamount) {
    bb.addTx({
        loadAmount: loadamount,
        coin: 0,
        fromAx: account.ax,
        fromAy: account.ay,
        fromEthAddr: account.ethAddress,
        toAx: Constants.exitAx,
        toAy: Constants.exitAy,
        toEthAddr: Constants.exitEthAddr,
        onChain: true
    });
}

describe("Test withdraw", function () {
    let circuit;

    this.timeout(0);

    before( async() => {
        circuit = await tester(path.join(__dirname, "circuits-test", "withdraw_test.circom"), {reduceConstraints:false});
        await circuit.loadConstraints();
        console.log("Constraints `withdraw.circom` circuit: " + circuit.constraints.length + "\n");

        // const testerAux = require("circom").testerAux;
        // const pathTmp = "/tmp/circom_23224tUX0uESB5UO2";
        // circuit = await testerAux(pathTmp, path.join(__dirname, "circuits", "inputschecker_test.circom"));
    });

    it("Should check withdraw", async () => {
        // Start a new rollup state
        const db = new SMTMemDB();
        const rollupDB = await RollupDB(db);
        const bb = await rollupDB.buildBatch(NTX, NLEVELS);

        const account1 = new RollupAccount(1);
        const account2 = new RollupAccount(2);
        const account3 = new RollupAccount(3);
        const account4 = new RollupAccount(4);

        // Add 4 deposits
        depositTx(bb, account1, 1000);
        depositTx(bb, account2, 2000);
        depositTx(bb, account3, 3000);
        depositTx(bb, account4, 4000);

        await bb.build();
        await rollupDB.consolidate(bb);

        // Add 4 exits
        const bb2 = await rollupDB.buildBatch(NTX, NLEVELS);

        const tx0 = {
            toEthAddr: Constants.exitEthAddr,
            coin: 0,
            amount: 100,
            nonce: 0,
            fee: Constants.fee["0%"]
        };
        account1.signTx(tx0);
        
        const tx1 = {
            toEthAddr: Constants.exitEthAddr,
            coin: 0,
            amount: 200,
            nonce: 0,
            fee: Constants.fee["0%"]
        };
        account2.signTx(tx1);

        const tx2 = {
            toEthAddr: Constants.exitEthAddr,
            coin: 0,
            amount: 300,
            nonce: 0,
            fee: Constants.fee["0%"]
        };
        account3.signTx(tx2);

        const tx3 = {
            toEthAddr: Constants.exitEthAddr,
            coin: 0,
            amount: 400,
            nonce: 0,
            fee: Constants.fee["0%"]
        };
        account4.signTx(tx3);
        
        bb2.addTx(tx0);
        bb2.addTx(tx1);
        bb2.addTx(tx2);
        bb2.addTx(tx3);

        await bb2.build();
        const rootExitBb2 = bb2.getNewExitRoot();
        await rollupDB.consolidate(bb2);

        const exitInfo1 = await rollupDB.getExitTreeInfo(2, 0, account1.ethAddress);
        const exitInfo2 = await rollupDB.getExitTreeInfo(2, 0, account2.ethAddress);
        const exitInfo3 = await rollupDB.getExitTreeInfo(2, 0, account3.ethAddress);
        const exitInfo4 = await rollupDB.getExitTreeInfo(2, 0, account4.ethAddress);

        const exitInfo = [];
        exitInfo.push(exitInfo1);
        exitInfo.push(exitInfo2);
        exitInfo.push(exitInfo3);
        exitInfo.push(exitInfo4);

        expect(exitInfo1.found).to.be.equal(true);
        expect(exitInfo2.found).to.be.equal(true);
        expect(exitInfo3.found).to.be.equal(true);
        expect(exitInfo4.found).to.be.equal(true);

        const inputs = [];
        const nullifiers = [];
        const numWithdraw = 4;

        for (let i = 0; i < numWithdraw; i++){
            const tmpInput = {};
            const tmpExitInfo = exitInfo[i];
            const tmpState = tmpExitInfo.state;

            // fill public inputs
            tmpInput.ethAddr = Scalar.fromString(tmpState.ethAddress, 16);
            tmpInput.numBatch = 2;
            tmpInput.rootExit = rootExitBb2;
            tmpInput.amount = tmpState.amount;
            tmpInput.tokenId = tmpState.coin;
            // compute nullifier
            nullifiers.push(utils.computeNullifier(tmpState, 2, rootExitBb2));

            // fill private inputs
            tmpInput.idx = tmpState.idx;
            tmpInput.ax = Scalar.fromString(tmpState.ax, 16);
            tmpInput.ay = Scalar.fromString(tmpState.ay, 16);
            let siblings = tmpExitInfo.siblings;
            while (siblings.length < (NLEVELS + 1)) siblings.push(Scalar.e(0));
            tmpInput.siblingsState = siblings;

            inputs.push(tmpInput);
        }

        for (let i = 0; i < inputs.length ; i++){
            const w = await circuit.calculateWitness(inputs[i], {logTrigger:false, logOutput: false, logSet: false});
            await circuit.assertOut(w, {nullifier: nullifiers[i]});
        }

        // Wrong input when checking SMTVerifier
        const inputSMTKO = Object.assign({}, inputs[0]);
        inputSMTKO.amount = Scalar.e(2);
        
        try {
            await circuit.calculateWitness(inputSMTKO, {logTrigger:false, logOutput: false, logSet: false});
            expect(true).to.be.equal(false);
        } catch (error) {
            expect(error.message.includes("Constraint doesn't match 1 != 0")).to.be.equal(true);
        }

        // Wrong input when computing nullifier
        const inputNullfierKO = Object.assign({}, inputs[0]);
        inputNullfierKO.numBatch = Scalar.e(3);
        
        
        const witnessNullifierKO = await circuit.calculateWitness(inputNullfierKO, {logTrigger:false, logOutput: false, logSet: false});
        try {
            await circuit.assertOut(witnessNullifierKO, {nullifier: nullifiers[0]});
        } catch (error){
            expect(error.message.includes("main.nullifier")).to.be.equal(true);
        }
    });
});