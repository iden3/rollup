const chai = require("chai");
const path = require("path");
const snarkjs = require("snarkjs");
const compiler = require("circom");
const bigInt = require("snarkjs").bigInt;
const SMTMemDB = require("circomlib").SMTMemDB;
const RollupAccount = require("../js/rollupaccount");
const RollupDB = require("../js/rollupdb");
const checkBatch = require("./helpers/checkbatch");
const TxPool = require("../js/txpool");

const assert = chai.assert;

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

const eth = (e) => bigInt(e).mul(bigInt(10).pow(bigInt(18)));
const gwei = (e) => bigInt(e).mul(bigInt(10).pow(bigInt(9)));
const dai = (e) => bigInt(e).mul(bigInt(10).pow(bigInt(18)));
const cdai = (e) => bigInt(e).mul(bigInt(10).pow(bigInt(16)));


async function initBlock(rollupDB) {

    const bb = await rollupDB.buildBatch(4, 8);

    const account1 = new RollupAccount(1);
    const account2 = new RollupAccount(2);

    bb.addTx({ fromIdx: 1, loadAmount: eth(10), coin: 0, ax: account1.ax, ay: account1.ay,
        ethAddress: account1.ethAddress, onChain: true });

    bb.addTx({ fromIdx: 2, loadAmount: dai(100), coin: 1, ax: account1.ax, ay: account1.ay,
        ethAddress: account1.ethAddress, onChain: true });

    bb.addTx({ fromIdx: 3, loadAmount: 0, coin: 0, ax: account2.ax, ay: account2.ay,
        ethAddress: account2.ethAddress, onChain: true });

    bb.addTx({ fromIdx: 4, loadAmount: 0, coin: 1, ax: account2.ax, ay: account2.ay,
        ethAddress: account2.ethAddress, onChain: true });

    await bb.build();
    // const input = bb.getInput();

    // const w = circuit.calculateWitness(input, {logTrigger:false, logOutput: false, logSet: false});
    // checkBatch(circuit, w, bb);
    await rollupDB.consolidate(bb);

    return [account1, account2];
}

describe("txPool test", function () {
    let circuit;

    this.timeout(1000000);

    before( async() => {
        const cirDef = await compiler(path.join(__dirname, "circuits", "rollup_pool_test.circom"), {reduceConstraints:false});
        // const cirDef = JSON.parse(fs.readFileSync(path.join(__dirname, "circuits", "circuit.json"), "utf8"));
        circuit = new snarkjs.Circuit(cirDef);
        console.log("NConstrains Rollup: " + circuit.nConstraints);
    });

    it("Should extract 4 tx from tx pool", async () => {

        // Start a new state
        const db = new SMTMemDB();
        const rollupDB = await RollupDB(db);

        const [account1, account2] = await initBlock(rollupDB);

        /// Block 2
        const txPool = await TxPool(rollupDB, conversion);

        const txs = [];
        txs[0] = { fromIdx: 1, toIdx: 3, coin: 0, amount: eth(3), nonce: 0, userFee: gwei(10)};
        txs[1] = { fromIdx: 3, toIdx: 1, coin: 0, amount: eth(2), nonce: 0, userFee: gwei(20)};
        txs[2] = { fromIdx: 2, toIdx: 4, coin: 1, amount: dai(4), nonce: 0, userFee: cdai(1)};
        txs[3] = { fromIdx: 2, toIdx: 4, coin: 1, amount: dai(2), nonce: 1, userFee: cdai(3)};
        txs[4] = { fromIdx: 4, toIdx: 2, coin: 1, amount: dai(5), nonce: 0, userFee: cdai(20)};
        txs[5] = { fromIdx: 4, toIdx: 2, coin: 1, amount: dai(3), nonce: 0, userFee: cdai(10)};

        account1.signTx(txs[0]);
        account2.signTx(txs[1]);
        account1.signTx(txs[2]);
        account1.signTx(txs[3]);
        account2.signTx(txs[4]);
        account2.signTx(txs[5]);

        for (let i=0; i<txs.length; i++) {
            await txPool.addTx(txs[i]);
        }

        const bb2 = await rollupDB.buildBatch(4, 8);

        await txPool.fillBatch(bb2);

        const calcSlots = bb2.offChainTxs.map((tx) => tx.slot);
        const expectedSlots = [2,5,0,1];

        assert.deepEqual(calcSlots, expectedSlots);

        const input2 = bb2.getInput();

        const w2 = circuit.calculateWitness(input2, {logTrigger:false, logOutput: false, logSet: false});
        checkBatch(circuit, w2, bb2);

        await rollupDB.consolidate(bb2);

        await txPool.purge();

        assert(txPool.txs.length, 1);

    });

    it("Check purge", async () => {

        // Start a new state
        const db = new SMTMemDB();
        const rollupDB = await RollupDB(db);

        const [account1, account2] = await initBlock(rollupDB);

        /// Block 2
        const txPool = await TxPool(rollupDB, conversion, {executableSlots: 1, nonExecutableSlots: 1});

        const txs = [];
        txs[0] = { fromIdx: 1, toIdx: 3, coin: 0, amount: eth(3), nonce: 0, userFee: gwei(10)};
        txs[1] = { fromIdx: 3, toIdx: 1, coin: 0, amount: eth(2), nonce: 0, userFee: gwei(20)};
        txs[2] = { fromIdx: 2, toIdx: 4, coin: 1, amount: dai(4), nonce: 0, userFee: cdai(1)};
        txs[3] = { fromIdx: 2, toIdx: 4, coin: 1, amount: dai(2), nonce: 1, userFee: cdai(3)};
        txs[4] = { fromIdx: 4, toIdx: 2, coin: 1, amount: dai(5), nonce: 0, userFee: cdai(20)};
        txs[5] = { fromIdx: 4, toIdx: 2, coin: 1, amount: dai(3), nonce: 0, userFee: cdai(10)};

        account1.signTx(txs[0]);
        account2.signTx(txs[1]);
        account1.signTx(txs[2]);
        account1.signTx(txs[3]);
        account2.signTx(txs[4]);
        account2.signTx(txs[5]);

        for (let i=0; i<txs.length; i++) {
            await txPool.addTx(txs[i]);
        }

        await txPool.purge();

        assert.equal(txPool.txs.length, 2);
    });

    it("Check send thousands of txs", async () => {

        // Start a new state
        const db = new SMTMemDB();
        const rollupDB = await RollupDB(db);

        const [account1, account2] = await initBlock(rollupDB);

        /// Block 2
        const txPool = await TxPool(rollupDB, conversion, {executableSlots: 1, nonExecutableSlots: 1, maxSlots: 10});

        const txs = [];
        txs[0] = { fromIdx: 1, toIdx: 3, coin: 0, amount: eth(3), nonce: 0, userFee: gwei(10)};
        txs[1] = { fromIdx: 3, toIdx: 1, coin: 0, amount: eth(2), nonce: 0, userFee: gwei(20)};
        txs[2] = { fromIdx: 2, toIdx: 4, coin: 1, amount: dai(4), nonce: 0, userFee: cdai(1)};
        txs[3] = { fromIdx: 2, toIdx: 4, coin: 1, amount: dai(2), nonce: 1, userFee: cdai(3)};
        txs[4] = { fromIdx: 4, toIdx: 2, coin: 1, amount: dai(5), nonce: 0, userFee: cdai(20)};
        txs[5] = { fromIdx: 4, toIdx: 2, coin: 1, amount: dai(3), nonce: 0, userFee: cdai(10)};

        account1.signTx(txs[0]);
        account2.signTx(txs[1]);
        account1.signTx(txs[2]);
        account1.signTx(txs[3]);
        account2.signTx(txs[4]);
        account2.signTx(txs[5]);

        for (let i=0; i<100; i++) {
            // console.log(i);
            await txPool.addTx(txs[i % txs.length ]);
        }

        await txPool.purge();

        assert.equal(txPool.txs.length, 2);
    });
});
