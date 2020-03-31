const chai = require("chai");
const path = require("path");
const bigInt = require("big-integer");
const snarkjs = require("snarkjs");
const compiler = require("circom");
const RollupAccount = require("../js/rollupaccount");
const { buildTxData, txRoundValues } = require("../js/utils");
const { random } = require("./helpers/utils-circuit");

const { expect } = chai;

describe("Decode Tx test", function () {
    let circuit;

    this.timeout(100000);

    before( async() => {
        const cirDef = await compiler(path.join(__dirname, "circuits", "decodetx_test.circom"));
        circuit = new snarkjs.Circuit(cirDef);
        console.log("NConstraints `decodetx.circom` circuit: " + circuit.nConstraints + "\n");
    });

    it("Should check decode txData", async () => {
        // Accounts
        const fromAcc = new RollupAccount(0);
        const toAcc = new RollupAccount(0);

        // build tx data js
        const tx = {
            amount: random(2**50),
            coin: random(2**32),
            nonce: random(2**48),
            userFee: random(2**50),
            rqOffset: random(2**3),
            onChain: 1,
            newAccount: 1,
        };

        txRoundValues(tx);
        const txData = buildTxData(tx);

        const input = {
            previousOnChain: 1,
            oldOnChainHash: 0,
            txData,
            rqTxData: 0,
            loadAmount: 0,
            fromIdx: 0,
            toIdx: 0,
            fromAx: fromAcc.ax,
            fromAy: fromAcc.ay,
            fromEthAddr: fromAcc.ethAddress,
            toAx: toAcc.ax,
            toAy: toAcc.ay,
            toEthAddr: toAcc.ethAddress,
        };

        const w = circuit.calculateWitness(input, {logOutput: false});

        const amount = w[circuit.getSignalIdx("main.amount")].toJSNumber();
        const coin = w[circuit.getSignalIdx("main.coin")].toJSNumber();
        const nonce = w[circuit.getSignalIdx("main.nonce")].toJSNumber();
        const userFee = w[circuit.getSignalIdx("main.userFee")].toJSNumber();
        const rqOffset = w[circuit.getSignalIdx("main.rqOffset")].toJSNumber();
        const onChain = w[circuit.getSignalIdx("main.onChain")].toJSNumber();
        const newAccount = w[circuit.getSignalIdx("main.newAccount")].toJSNumber();

        expect(tx.amount.toJSNumber()).to.be.equal(amount);
        expect(tx.coin).to.be.equal(coin);
        expect(tx.nonce).to.be.equal(nonce);
        expect(tx.userFee.toJSNumber()).to.be.equal(userFee);
        expect(tx.rqOffset).to.be.equal(rqOffset);
        expect(tx.onChain).to.be.equal(onChain);
        expect(tx.newAccount).to.be.equal(newAccount);
    });

    it("Should check signature off-chain", async () => {
        // build tx data js
        const tx = {
            amount: random(2**16),
            coin: random(2**32),
            nonce: random(2**48),
            userFee: random(2**16),
            rqOffset: random(2**3),
            onChain: 0,
            newAccount: 0,
        };
        txRoundValues(tx);
        const txData = buildTxData(tx);

        const input = {
            previousOnChain: 0,
            oldOnChainHash: 0,
            txData,
            rqTxData: 0,
            loadAmount: 0,
            fromIdx: 0,
            toIdx: 0,
            fromAy: 0,
            fromAx: 0,
            fromEthAddr: 0,
            toAy: 0,
            toAx: 0,
            toEthAddr: 0,
        };

        const w = circuit.calculateWitness(input, {logOutput: false});

        const sigOffChaiash = w[circuit.getSignalIdx("main.sigOffChainHash")];
    });
});
