const chai = require("chai");
const path = require("path");
const snarkjs = require("snarkjs");
const compiler = require("circom");
const bigInt = require("snarkjs").bigInt;
const SMTMemDB = require("circomlib").SMTMemDB;
const fs = require("fs");
const RollupAccount = require("../js/rollupaccount");
const RollupDB = require("../js/rollupdb");
const checkBatch = require("./helpers/checkbatch");
const TxPool = require("../js/txpool");

const assert = chai.assert;

describe("Rollup run 4 null TX", function () {
    let circuit;

    this.timeout(100000);

    before( async() => {
        // const cirDef = await compiler(path.join(__dirname, "circuits", "rollup_test.circom"), {reduceConstraints:false});
        const cirDef = JSON.parse(fs.readFileSync(path.join(__dirname, "circuits", "circuit.json"), "utf8"));
        circuit = new snarkjs.Circuit(cirDef);
        console.log("NConstrains Rollup: " + circuit.nConstraints);
    });
    it("Should extract 4 tx from tx pool", async () => {

        // Start a new state
        const db = new SMTMemDB();
        const rollupDB = await RollupDB(db);
        const conversion = {
            0: {   // Coin 1
                token: "ETH",
                price: 210.21,
                decimals: 18
            },
            1: {
                token: "DAI",
                price: 1,
                decimals: 18
            }
        };
        const txPool = await TxPool(rollupDB, conversion);

        // Block 1
        const bb = await rollupDB.buildBatch(4, 8);

        const account1 = new RollupAccount(1);
        const account2 = new RollupAccount(2);

        bb.addTx({
            fromIdx: 1,
            loadAmount: bigInt(10).mul(bigInt(10).pow(bigInt(18))),
            coin: 0,
            ax: account1.ax,
            ay: account1.ay,
            ethAddress: account1.ethAddress,
            onChain: true
        });

        bb.addTx({
            fromIdx: 2,
            loadAmount: bigInt(100).mul(bigInt(10).pow(bigInt(18))),
            coin: 1,
            ax: account1.ax,
            ay: account1.ay,
            ethAddress: account1.ethAddress,
            onChain: true
        });

        bb.addTx({
            fromIdx: 3,
            loadAmount: 0,
            coin: 0,
            ax: account2.ax,
            ay: account2.ay,
            ethAddress: account2.ethAddress,
            onChain: true
        });

        bb.addTx({
            fromIdx: 4,
            loadAmount: 0,
            coin: 1,
            ax: account2.ax,
            ay: account2.ay,
            ethAddress: account2.ethAddress,
            onChain: true
        });

        await bb.build();
        const input = bb.getInput();

        const w = circuit.calculateWitness(input, {logTrigger:false, logOutput: false, logSet: false});
        checkBatch(circuit, w, bb);
        await rollupDB.consolidate(bb);

        /// Block 2

        const txs = [];
        txs[0] = {
            fromIdx: 1,
            toIdx: 3,
            coin: 0,
            amount: bigInt(3).mul(bigInt(10).pow(bigInt(18))),
            nonce: 0,
            userFee: bigInt(10).mul(bigInt(10).pow(bigInt(9))),
        };
        account1.signTx(txs[0]);

        txs[1] = {
            fromIdx: 3,
            toIdx: 1,
            coin: 0,
            amount: bigInt(2).mul(bigInt(10).pow(bigInt(18))),
            nonce: 0,
            userFee: bigInt(20).mul(bigInt(10).pow(bigInt(9))),
        };
        account2.signTx(txs[1]);

        txs[2] = {
            fromIdx: 2,
            toIdx: 4,
            coin: 1,
            amount: bigInt(4).mul(bigInt(10).pow(bigInt(18))),
            nonce: 0,
            userFee: bigInt(1).mul(bigInt(10).pow(bigInt(16))),
        };
        account1.signTx(txs[2]);

        txs[3] = {
            fromIdx: 2,
            toIdx: 4,
            coin: 1,
            amount: bigInt(2).mul(bigInt(10).pow(bigInt(18))),
            nonce: 1,
            userFee: bigInt(3).mul(bigInt(10).pow(bigInt(16))),
        };
        account1.signTx(txs[3]);

        txs[4] = {
            fromIdx: 4,
            toIdx: 2,
            coin: 1,
            amount: bigInt(5).mul(bigInt(10).pow(bigInt(18))),
            nonce: 0,
            userFee: bigInt(20).mul(bigInt(10).pow(bigInt(16))),
        };
        account2.signTx(txs[4]);

        txs[5] = {
            fromIdx: 4,
            toIdx: 2,
            coin: 1,
            amount: bigInt(3).mul(bigInt(10).pow(bigInt(18))),
            nonce: 0,
            userFee: bigInt(10).mul(bigInt(10).pow(bigInt(16))),
        };
        account2.signTx(txs[5]);

        for (let i=0; i<txs.length; i++) {
            await txPool.addTx(txs[i]);
        }

        const bb2 = await rollupDB.buildBatch(4, 8);

        await txPool.fillBatch(bb2);

        const calcSlots = bb2.offChainTxs.map((tx) => tx.slot);
        const expectedSlots = [2,5,0,1].map( (i) => txs[i].slot);

        assert.deepEqual(calcSlots, expectedSlots);

        const input2 = bb2.getInput();

        const w2 = circuit.calculateWitness(input2, {logTrigger:false, logOutput: false, logSet: false});
        checkBatch(circuit, w2, bb2);
    });

});
