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

    bb.addTx({  
        loadAmount: eth(10), 
        coin: 0, 
        fromAx: account1.ax, 
        fromAy: account1.ay,
        fromEthAddr: account1.ethAddress,
        toAx: 0,
        toAy: 0,
        toEthAddr: 0,
        onChain: true 
    });

    bb.addTx({  
        loadAmount: dai(100), 
        coin: 1, 
        fromAx: account1.ax, 
        fromAy: account1.ay,
        fromEthAddr: account1.ethAddress,
        toAx: 0,
        toAy: 0,
        toEthAddr: 0, 
        onChain: true 
    });

    bb.addTx({  
        loadAmount: 0, 
        coin: 0, 
        fromAx: account2.ax, 
        fromAy: account2.ay,
        fromEthAddr: account2.ethAddress,
        toAx: 0,
        toAy: 0,
        toEthAddr: 0, 
        onChain: true 
    });

    bb.addTx({ 
        loadAmount: 0, 
        coin: 1, 
        fromAx: account2.ax, 
        fromAy: account2.ay,
        fromEthAddr: account2.ethAddress,
        toAx: 0,
        toAy: 0,
        toEthAddr: 0, 
        onChain: true 
    });

    await bb.build();
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
    });

    it("Should extract 4 tx from pool and check it on rollup circuit", async () => {
        // Start a new state
        const db = new SMTMemDB();
        const rollupDB = await RollupDB(db);

        const [account1, account2] = await initBlock(rollupDB);

        /// Block 2
        const txPool = await TxPool(rollupDB, conversion);

        const txs = [];
        txs[0] = { toAx: account2.ax, toAy: account2.ay, toEthAddr: account2.ethAddress, coin: 0, amount: eth(3), nonce: 0, userFee: gwei(10)};
        txs[1] = { toAx: account1.ax, toAy: account1.ay, toEthAddr: account1.ethAddress, coin: 0, amount: eth(2), nonce: 0, userFee: gwei(20)};
        txs[2] = { toAx: account2.ax, toAy: account2.ay, toEthAddr: account2.ethAddress, coin: 1, amount: dai(4), nonce: 0, userFee: cdai(1)};
        txs[3] = { toAx: account2.ax, toAy: account2.ay, toEthAddr: account2.ethAddress, coin: 1, amount: dai(2), nonce: 1, userFee: cdai(3)};
        txs[4] = { toAx: account1.ax, toAy: account1.ay, toEthAddr: account1.ethAddress, coin: 1, amount: dai(5), nonce: 0, userFee: cdai(20)};
        txs[5] = { toAx: account1.ax, toAy: account1.ay, toEthAddr: account1.ethAddress, coin: 1, amount: dai(3), nonce: 0, userFee: cdai(10)};


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

    it("Should check purge functionality", async () => {
        // Start a new state
        const db = new SMTMemDB();
        const rollupDB = await RollupDB(db);

        const [account1, account2] = await initBlock(rollupDB);

        /// Block 2
        const txPool = await TxPool(rollupDB, conversion, {executableSlots: 1, nonExecutableSlots: 1});

        const txs = [];
        txs[0] = { toAx: account2.ax, toAy: account2.ay, toEthAddr: account2.ethAddress, coin: 0, amount: eth(3), nonce: 0, userFee: gwei(10)};
        txs[1] = { toAx: account1.ax, toAy: account1.ay, toEthAddr: account1.ethAddress, coin: 0, amount: eth(2), nonce: 0, userFee: gwei(20)};
        txs[2] = { toAx: account2.ax, toAy: account2.ay, toEthAddr: account2.ethAddress, coin: 1, amount: dai(4), nonce: 0, userFee: cdai(1)};
        txs[3] = { toAx: account2.ax, toAy: account2.ay, toEthAddr: account2.ethAddress, coin: 1, amount: dai(2), nonce: 1, userFee: cdai(3)};
        txs[4] = { toAx: account1.ax, toAy: account1.ay, toEthAddr: account1.ethAddress, coin: 1, amount: dai(5), nonce: 0, userFee: cdai(20)};
        txs[5] = { toAx: account1.ax, toAy: account1.ay, toEthAddr: account1.ethAddress, coin: 1, amount: dai(3), nonce: 0, userFee: cdai(10)};

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

    it("Should check send thousands of txs", async () => {
        // Start a new state
        const db = new SMTMemDB();
        const rollupDB = await RollupDB(db);

        const [account1, account2] = await initBlock(rollupDB);

        /// Block 2
        const txPool = await TxPool(rollupDB, conversion, {executableSlots: 1, nonExecutableSlots: 1, maxSlots: 10});

        const txs = [];
        txs[0] = { toAx: account2.ax, toAy: account2.ay, toEthAddr: account2.ethAddress, coin: 0, amount: eth(3), nonce: 0, userFee: gwei(10)};
        txs[1] = { toAx: account1.ax, toAy: account1.ay, toEthAddr: account1.ethAddress, coin: 0, amount: eth(2), nonce: 0, userFee: gwei(20)};
        txs[2] = { toAx: account2.ax, toAy: account2.ay, toEthAddr: account2.ethAddress, coin: 1, amount: dai(4), nonce: 0, userFee: cdai(1)};
        txs[3] = { toAx: account2.ax, toAy: account2.ay, toEthAddr: account2.ethAddress, coin: 1, amount: dai(2), nonce: 1, userFee: cdai(3)};
        txs[4] = { toAx: account1.ax, toAy: account1.ay, toEthAddr: account1.ethAddress, coin: 1, amount: dai(5), nonce: 0, userFee: cdai(20)};
        txs[5] = { toAx: account1.ax, toAy: account1.ay, toEthAddr: account1.ethAddress, coin: 1, amount: dai(3), nonce: 0, userFee: cdai(10)};

        account1.signTx(txs[0]);
        account2.signTx(txs[1]);
        account1.signTx(txs[2]);
        account1.signTx(txs[3]);
        account2.signTx(txs[4]);
        account2.signTx(txs[5]);

        for (let i=0; i<100; i++) {
            await txPool.addTx(txs[i % txs.length ]);
        }

        await txPool.purge();

        assert.equal(txPool.txs.length, 2);
    });

    it("Should not add any transaction to the pool", async () => {
        // Start a new state
        const db = new SMTMemDB();
        const rollupDB = await RollupDB(db);

        const [account1, account2] = await initBlock(rollupDB);
        const account3 = new RollupAccount(3);

        /// Block 2
        const txPool = await TxPool(rollupDB, conversion);

        const txs = [];
        txs[0] = { toAx: account2.ax, toAy: account2.ay, toEthAddr: account2.ethAddress, coin: 0, amount: eth(3), nonce: 0, userFee: gwei(10)}; // from: unexistent leaf
        txs[1] = { toAx: account3.ax, toAy: account3.ay, toEthAddr: account3.ethAddress, coin: 0, amount: eth(3), nonce: 0, userFee: gwei(10)}; // to: unexistent leaf
        txs[2] = { toAx: account2.ax, toAy: account2.ay, toEthAddr: account2.ethAddress, coin: 3, amount: dai(4), nonce: 0, userFee: cdai(1)}; // coin does not match
        txs[3] = { toAx: account2.ax, toAy: account2.ay, toEthAddr: account2.ethAddress, coin: 1, amount: dai(1000), nonce: 0, userFee: cdai(1)}; // insufficient funds
        txs[4] = { toAx: account2.ax, toAy: account2.ay, toEthAddr: account2.ethAddress, coin: 1, amount: dai(2), nonce: 10, userFee: cdai(3)}; // invalid nonce 
        txs[5] = { toAx: account2.ax, toAy: account2.ay, toEthAddr: account2.ethAddress, coin: 0, amount: dai(5), nonce: 0, userFee: eth(40)}; // insufficient fee funds
        txs[6] = { toAx: account2.ax, toAy: account2.ay, toEthAddr: account2.ethAddress, coin: 0, amount: eth(2), nonce: 0, userFee: gwei(20), onChain : true}; // onChain should be false
        txs[7] = { toAx: account2.ax, toAy: account2.ay, toEthAddr: account2.ethAddress, coin: 0, amount: eth(2), nonce: 0, userFee: gwei(30)}; // invalid signature

        account3.signTx(txs[0]);
        account1.signTx(txs[1]);
        account1.signTx(txs[2]);
        account1.signTx(txs[3]);
        account1.signTx(txs[4]);
        account1.signTx(txs[5]);
        account1.signTx(txs[6]);
        account1.signTx(txs[7]);
        
        txs[7].fromAx = account2.ax; // invalid signature Ax
        txs[7].fromAy = account2.ay; // invalid signature Ay


        for (let i=0; i<txs.length; i++) {
            await txPool.addTx(txs[i]);
        }

        const bb2 = await rollupDB.buildBatch(4, 8);

        await txPool.fillBatch(bb2);

        const calcSlots = bb2.offChainTxs.map((tx) => tx.slot);
        const expectedSlots = [];

        assert.deepEqual(calcSlots, expectedSlots);
    });

    it("Should process maximum valid transactions", async () => {
        // Start a new state
        const db = new SMTMemDB();
        const rollupDB = await RollupDB(db);

        const [account1, account2] = await initBlock(rollupDB);
        /// Batch
        const cfg = {
            maxSlots : 512,
            executableSlots: 256,
            nonExecutableSlots: 256,
            timeout: 10000,
        };

        const txPool = await TxPool(rollupDB, conversion, cfg);

        const txs = [];

        for (let i = 0; i < 256; i++) {
            let tx = {
                toAx: account2.ax,
                toAy: account2.ay,
                toEthAddr: account2.ethAddress,
                coin: 0,
                amount: 1,
                nonce: i,
                userFee: Math.floor(Math.random() * 10) + 1,
                rqOffset: 0,
                onChain: 0,
                newAccount: 0,
            };
            account1.signTx(tx);
            txs.push(tx);
        } 

        for (let i = 0; i < txs.length; i++) {
            await txPool.addTx(txs[i]);
        }

        const bb = await rollupDB.buildBatch(512, 24);
        await txPool.fillBatch(bb);

        await rollupDB.consolidate(bb);
        await txPool.purge();

        const calcSlots = bb.offChainTxs.map((tx) => tx.slot);
        assert.equal(calcSlots.length, 256);
        assert.equal(txPool.txs.length, 0);
    });
});
