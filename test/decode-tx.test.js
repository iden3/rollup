const chai = require("chai");
const path = require("path");
const { bigInt } = require("snarkjs");
const snarkjs = require("snarkjs");
const compiler = require("circom");
const RollupAccount = require("../js/rollupaccount");
const RollupTx = require("../js/tx");
const { buildTxData, txRoundValues } = require("../js/utils");
const { random } = require("./helpers/utils-circuit");

const { expect } = chai;

describe("Decode Tx test", function () {
    let circuit;

    this.timeout(100000);

    // Accounts
    const fromAcc = new RollupAccount(0);
    const toAcc = new RollupAccount(1);

    before( async() => {
        const cirDef = await compiler(path.join(__dirname, "circuits", "decodetx_test.circom"));
        circuit = new snarkjs.Circuit(cirDef);
        console.log("NConstraints `decodetx.circom` circuit: " + circuit.nConstraints + "\n");
    });

    it("Should check decode txData", async () => {
        const tx = {
            amount: random(2**50),
            coin: random(2**32),
            nonce: random(2**48),
            userFee: random(2**50),
            rqOffset: random(2**3),
            onChain: 1,
            newAccount: 1,
        };

        const rollupTx = new RollupTx(tx);

        const input = {
            previousOnChain: 1,
            oldOnChainHash: 0,
            txData: rollupTx.getTxData().toString(),
            rqTxData: 0,
            loadAmount: 0,
            fromIdx: 0,
            toIdx: 0,
            fromAx: 0,
            fromAy: 0,
            fromEthAddr: 0,
            toAx: 0,
            toAy: 0,
            toEthAddr: 0,
        };

        const w = circuit.calculateWitness(input, {logOutput: false});

        const amount = w[circuit.getSignalIdx("main.amount")].toString();
        const coin = w[circuit.getSignalIdx("main.coin")].toString();
        const nonce = w[circuit.getSignalIdx("main.nonce")].toString();
        const userFee = w[circuit.getSignalIdx("main.userFee")].toString();
        const rqOffset = w[circuit.getSignalIdx("main.rqOffset")].toString();
        const onChain = w[circuit.getSignalIdx("main.onChain")].toString();
        const newAccount = w[circuit.getSignalIdx("main.newAccount")].toString();

        expect(rollupTx.amount.toString()).to.be.equal(amount);
        expect(rollupTx.coin.toString()).to.be.equal(coin);
        expect(rollupTx.nonce.toString()).to.be.equal(nonce);
        expect(rollupTx.userFee.toString()).to.be.equal(userFee);
        expect(rollupTx.rqOffset.toString()).to.be.equal(rqOffset);
        expect(rollupTx.onChain.toString()).to.be.equal(onChain);
        expect(rollupTx.newAccount.toString()).to.be.equal(newAccount);
    });

    it("Should check signature off-chain", async () => {
        const tx = {
            amount: random(2**50),
            coin: random(2**32),
            nonce: random(2**48),
            userFee: random(2**50),
            rqOffset: random(2**3),
            onChain: 1,
            newAccount: 1,
            toAx: toAcc.ax,
            toAy: toAcc.ay,
            toEthAddr: toAcc.ethAddress,
        };
        
        const rollupTx = new RollupTx(tx);

        fromAcc.signClassTx(rollupTx);

        const input = {
            previousOnChain: 1,
            oldOnChainHash: 0,
            txData: rollupTx.getTxData(),
            rqTxData: 0,
            loadAmount: 0,
            fromIdx: 0,
            toIdx: 0,
            fromAx: 0,
            fromAy: 0,
            fromEthAddr: 0,
            toAx: rollupTx.toAx,
            toAy: rollupTx.toAy,
            toEthAddr: rollupTx.toEthAddr,
        };

        const w = circuit.calculateWitness(input, {logOutput: false});

        const sigOffChainHash = w[circuit.getSignalIdx("main.sigOffChainHash")].toString();

        const sigHash = rollupTx.getHashSignature();
        expect(sigHash.toString()).to.be.equal(sigOffChainHash);
    });

    it("Should check on-chain hash", async () => {
        const oldOnChainHash = 0;

        const tx = {
            loadAmount: random(2**50),
            amount: random(2**50),
            coin: random(2**32),
            nonce: random(2**48),
            userFee: random(2**50),
            rqOffset: random(2**3),
            onChain: 1,
            newAccount: 1,
            fromAx: toAcc.ax,
            fromAy: toAcc.ay,
            fromEthAddr: toAcc.ethAddress,
            toAx: toAcc.ax,
            toAy: toAcc.ay,
            toEthAddr: toAcc.ethAddress,
        };
        
        const rollupTx = new RollupTx(tx);

        const input = {
            previousOnChain: 1,
            oldOnChainHash: oldOnChainHash,
            txData: rollupTx.getTxData(),
            rqTxData: 0,
            loadAmount: rollupTx.loadAmount,
            fromIdx: 0,
            toIdx: 0,
            fromAx: rollupTx.fromAx,
            fromAy: rollupTx.fromAy,
            fromEthAddr: rollupTx.fromEthAddr,
            toAx: rollupTx.toAx,
            toAy: rollupTx.toAy,
            toEthAddr: rollupTx.toEthAddr,
        };

        const w = circuit.calculateWitness(input, {logOutput: false});

        const newOnChainHash = w[circuit.getSignalIdx("main.newOnChainHash")].toString();

        const newOnChainHashJs = rollupTx.getOnChainHash(oldOnChainHash);
        
        expect(newOnChainHashJs.toString()).to.be.equal(newOnChainHash);
    });
});
