const { assert } = require("chai");
const Scalar = require("ffjavascript").Scalar;
const SMTMemDB = require("circomlib").SMTMemDB;

const RollupAccount = require("../../js/rollupaccount");
const RollupDB = require("../../js/rollupdb");
const TxPool = require("../../js/txpool");
const Constants = require("../../js/constants");

const conversion = {
    0: {   
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

const eth = (e) => Scalar.mul(e, Scalar.pow(10, 18));
const gwei = (e) => Scalar.mul(e, Scalar.pow(10, 9));
const dai = (e) => Scalar.mul(e, Scalar.pow(10, 18));


async function initBlock(rollupDB) {

    const bb = await rollupDB.buildBatch(4, 8);

    const account1 = new RollupAccount(1);
    const account2 = new RollupAccount(2);

    bb.addTx({  
        loadAmount: eth(100), 
        coin: 0, 
        fromAx: account1.ax, 
        fromAy: account1.ay,
        fromEthAddr: account1.ethAddress,
        toAx: Constants.exitAx,
        toAy: Constants.exitAy,
        toEthAddr: Constants.exitEthAddr,
        onChain: true 
    });

    bb.addTx({  
        loadAmount: dai(100), 
        coin: 1, 
        fromAx: account1.ax, 
        fromAy: account1.ay,
        fromEthAddr: account1.ethAddress,
        toAx: Constants.exitAx,
        toAy: Constants.exitAy,
        toEthAddr: Constants.exitEthAddr, 
        onChain: true 
    });

    bb.addTx({  
        loadAmount: 0, 
        coin: 0, 
        fromAx: account2.ax, 
        fromAy: account2.ay,
        fromEthAddr: account2.ethAddress,
        toAx: Constants.exitAx,
        toAy: Constants.exitAy,
        toEthAddr: Constants.exitEthAddr, 
        onChain: true 
    });

    bb.addTx({ 
        loadAmount: 0, 
        coin: 1, 
        fromAx: account2.ax, 
        fromAy: account2.ay,
        fromEthAddr: account2.ethAddress,
        toAx: Constants.exitAx,
        toAy: Constants.exitAy,
        toEthAddr: Constants.exitEthAddr, 
        onChain: true 
    });

    await bb.build();
    await rollupDB.consolidate(bb);

    return [account1, account2];
}

describe("Tx pool", function () {

    this.timeout(150000);

    it("Should extract 4 tx from pool and process them", async () => {
        // Start a new state
        const db = new SMTMemDB();
        const rollupDB = await RollupDB(db);

        const [account1, account2] = await initBlock(rollupDB);

        /// Block 2
        const txPool = await TxPool(rollupDB, conversion);

        const txs = [];
        txs[0] = { toAx: account2.ax, toAy: account2.ay, toEthAddr: account2.ethAddress, coin: 0, amount: eth(3), nonce: 0, fee: Constants.fee["0.001%"]};
        txs[1] = { toAx: account1.ax, toAy: account1.ay, toEthAddr: account1.ethAddress, coin: 0, amount: eth(2), nonce: 0, fee: Constants.fee["0.002%"]};
        txs[2] = { toAx: account2.ax, toAy: account2.ay, toEthAddr: account2.ethAddress, coin: 1, amount: dai(4), nonce: 0, fee: Constants.fee["0.2%"]};
        txs[3] = { toAx: account2.ax, toAy: account2.ay, toEthAddr: account2.ethAddress, coin: 1, amount: dai(2), nonce: 1, fee: Constants.fee["1%"]};
        txs[4] = { toAx: account1.ax, toAy: account1.ay, toEthAddr: account1.ethAddress, coin: 1, amount: dai(5), nonce: 0, fee: Constants.fee["2%"]}; // not mined, cause will be mined txs[5] for the way txpool process availableTxs
        txs[5] = { toAx: account1.ax, toAy: account1.ay, toEthAddr: account1.ethAddress, coin: 1, amount: dai(3), nonce: 0, fee: Constants.fee["2%"]}; 

        account1.signTx(txs[0]);
        account2.signTx(txs[1]);
        account1.signTx(txs[2]);
        account1.signTx(txs[3]);
        account2.signTx(txs[4]);
        account2.signTx(txs[5]);

        for (let i=0; i<txs.length; i++) {
            await txPool.addTx(txs[i]);
        }

        const bb = await rollupDB.buildBatch(4, 8);

        await txPool.fillBatch(bb);

        const calcSlots = bb.offChainTxs.map((tx) => tx.slot);
        const expectedSlots = [ 2, 5, 3, 0 ];

        assert.deepEqual(calcSlots, expectedSlots);

        await rollupDB.consolidate(bb);

        await txPool.purge();

        assert.equal(txPool.txs.length, 1);
    });

    it("Should extract 2 tx offchain withdraw formthe pool", async () => {
        // Start a new state
        const db = new SMTMemDB();
        const rollupDB = await RollupDB(db);

        const [account1] = await initBlock(rollupDB);

        /// Block 2
        const txPool = await TxPool(rollupDB, conversion);

        const txs = [];
        txs[0] = { toAx: Constants.exitAx, toAy: Constants.exitAy, toEthAddr: Constants.exitEthAddr, coin: 0, amount: eth(3), nonce: 0, fee: Constants.fee["0.001%"]};
        txs[1] = { toAx: Constants.exitAx, toAy: Constants.exitAy, toEthAddr: Constants.exitEthAddr, coin: 0, amount: eth(2), nonce: 1, fee: Constants.fee["0.002%"]};

        account1.signTx(txs[0]);
        account1.signTx(txs[1]);

        for (let i=0; i<txs.length; i++) {
            await txPool.addTx(txs[i]);
        }

        const bb = await rollupDB.buildBatch(4, 8);

        await txPool.fillBatch(bb);

        const calcSlots = bb.offChainTxs.map((tx) => tx.slot);
        const expectedSlots = [ 0, 1 ];

        assert.deepEqual(calcSlots, expectedSlots);

        await rollupDB.consolidate(bb);

        await txPool.purge();

        assert.equal(txPool.txs.length, 0);
    });


    it("Should load tx from Db and extract 4 tx from pool and process them", async () => {
        // Start a new state
        const db = new SMTMemDB();
        const rollupDB = await RollupDB(db);

        const [account1, account2] = await initBlock(rollupDB);

        const txPool = await TxPool(rollupDB, conversion);

        const txs = [];
        txs[0] = { toAx: account2.ax, toAy: account2.ay, toEthAddr: account2.ethAddress, coin: 0, amount: eth(3), nonce: 0, fee: Constants.fee["0.001%"]};
        txs[1] = { toAx: account1.ax, toAy: account1.ay, toEthAddr: account1.ethAddress, coin: 0, amount: eth(2), nonce: 0, fee: Constants.fee["0.002%"]};
        txs[2] = { toAx: account2.ax, toAy: account2.ay, toEthAddr: account2.ethAddress, coin: 1, amount: dai(4), nonce: 0, fee: Constants.fee["0.2%"]};
        txs[3] = { toAx: account2.ax, toAy: account2.ay, toEthAddr: account2.ethAddress, coin: 1, amount: dai(2), nonce: 1, fee: Constants.fee["1%"]};
        txs[4] = { toAx: account1.ax, toAy: account1.ay, toEthAddr: account1.ethAddress, coin: 1, amount: dai(5), nonce: 0, fee: Constants.fee["2%"]};
        txs[5] = { toAx: account1.ax, toAy: account1.ay, toEthAddr: account1.ethAddress, coin: 1, amount: dai(3), nonce: 0, fee: Constants.fee["2%"]};

        account1.signTx(txs[0]);
        account2.signTx(txs[1]);
        account1.signTx(txs[2]);
        account1.signTx(txs[3]);
        account2.signTx(txs[4]);
        account2.signTx(txs[5]);

        for (let i=0; i<txs.length; i++) {
            await txPool.addTx(txs[i]);
        }

        // Instantiate pool with database
        const newPool = await TxPool(rollupDB, conversion);

        const bb = await rollupDB.buildBatch(4, 8);

        await newPool.fillBatch(bb);

        const calcSlots = bb.offChainTxs.map((tx) => tx.slot);
        const expectedSlots = [ 2, 5, 3, 0 ];

        assert.deepEqual(calcSlots, expectedSlots);

        await rollupDB.consolidate(bb);

        await newPool.purge();

        assert.equal(newPool.txs.length, 1);
    });

    it("Should check one deposits off-chain transaction", async () => {
        // Start a new state
        const db = new SMTMemDB();
        const rollupDB = await RollupDB(db);

        const [account1] = await initBlock(rollupDB);

        const account3 = new RollupAccount(3);
        
        const txPool = await TxPool(rollupDB, conversion);
        // Set deposit off-chain price to 0.2*Eth
        txPool.setFeeDeposit(0.2);
        txPool.setEthPrice(conversion[0].price);

        // Transaction to a non-existent leaf with insufficient funds
        let tx = { toAx: account3.ax, toAy: account3.ay, toEthAddr: account3.ethAddress, coin: 0, amount: eth(2), nonce: 0, fee: Constants.fee["0.001%"]};

        account1.signTx(tx);

        let resPool = await txPool.addTx(tx);
        assert.equal(resPool, false);

        // Transaction to a non-existent leaf with enough funds
        tx = { toAx: account3.ax, toAy: account3.ay, toEthAddr: account3.ethAddress, coin: 0, amount: eth(2), nonce: 0, fee: Constants.fee["50%"]};

        account1.signTx(tx);

        resPool = await txPool.addTx(tx);

        assert.equal(resPool, true);

        const bb = await rollupDB.buildBatch(4, 8);
        await txPool.fillBatch(bb);

        assert.equal(bb.offChainTxs.length, 1);
        assert.equal(bb.onChainTxs.length, 1);

        await rollupDB.consolidate(bb);
        
        // Check balances
        const state3 = await rollupDB.getStateByAccount(0, account3.ax, account3.ay);
        assert.equal(Scalar.eq(state3.coin, 0), true);
        assert.equal(Scalar.eq(state3.nonce, 0), true);
        assert.equal(Scalar.eq(state3.amount, eth(2)), true);
        assert.equal(state3.ax, account3.ax);
        assert.equal(state3.ay, account3.ay);
        assert.equal(state3.ethAddress, account3.ethAddress);

        const state1 = await rollupDB.getStateByAccount(0, account1.ax, account1.ay);
        // finalAmount = initialDeposit - transfer - fee = 100 - 2 - 1 eth
        assert.equal(Scalar.eq(state1.amount, eth(97)), true);  
    });

    it("Should check max deposit Off-chain transactions", async () => {
        // Start a new state
        const db = new SMTMemDB();
        const rollupDB = await RollupDB(db);

        const [account1] = await initBlock(rollupDB);

        const account3 = new RollupAccount(3);
        const account4 = new RollupAccount(4);
        const account5 = new RollupAccount(5);

        
        const txPool = await TxPool(rollupDB, conversion, {maxDeposits: 2});
        // Set deposit off-chain price to 0.2*Eth
        txPool.setFeeDeposit(0.2);
        txPool.setEthPrice(conversion[0].price);

        // Transaction to a non-existent leaf with insufficient funds
        const txs = [];
        txs[0]= { toAx: account3.ax, toAy: account3.ay, toEthAddr: account3.ethAddress, coin: 0, amount: eth(2), nonce: 0, fee: Constants.fee["50%"]};
        txs[1]= { toAx: account4.ax, toAy: account4.ay, toEthAddr: account4.ethAddress, coin: 0, amount: eth(2), nonce: 1, fee: Constants.fee["50%"]};
        txs[2]= { toAx: account5.ax, toAy: account5.ay, toEthAddr: account5.ethAddress, coin: 0, amount: eth(2), nonce: 2, fee: Constants.fee["50%"]};

        for (let i=0; i<txs.length; i++) {
            account1.signTx(txs[i]);
            const resPool = await txPool.addTx(txs[i]);
            assert.equal(resPool, true);
        }

        const bb = await rollupDB.buildBatch(4, 8);
        await txPool.fillBatch(bb);

        assert.equal(bb.offChainTxs.length, 2);
        assert.equal(bb.onChainTxs.length, 2);

        await rollupDB.consolidate(bb);
        
        // Check balances
        const state3 = await rollupDB.getStateByAccount(0, account3.ax, account3.ay);
        assert.equal(Scalar.eq(state3.coin, 0), true);
        assert.equal(Scalar.eq(state3.nonce, 0), true);
        assert.equal(Scalar.eq(state3.amount, eth(2)), true);
        assert.equal(state3.ax, account3.ax);
        assert.equal(state3.ay, account3.ay);
        assert.equal(state3.ethAddress, account3.ethAddress);

        // Check balances
        const state4 = await rollupDB.getStateByAccount(0, account4.ax, account4.ay);
        assert.equal(Scalar.eq(state4.coin, 0), true);
        assert.equal(Scalar.eq(state4.nonce, 0), true);
        assert.equal(Scalar.eq(state4.amount, eth(2)), true);
        assert.equal(state4.ax, account4.ax);
        assert.equal(state4.ay, account4.ay);
        assert.equal(state4.ethAddress, account4.ethAddress);
 
        const state5 = await rollupDB.getStateByAccount(0, account5.ax, account5.ay);
        assert.equal(state5, null);

        const state1 = await rollupDB.getStateByAccount(0, account1.ax, account1.ay);
        // finalAmount = initialDeposit - transfer - fee = 100 - 2 - 1 eth
        assert.equal(Scalar.eq(state1.amount, eth(94)), true);  
    });

    it("Should save/load deposits off-chain from Db", async () => {
        // Start a new state
        const db = new SMTMemDB();
        const rollupDB = await RollupDB(db);

        const [account1] = await initBlock(rollupDB);

        const account3 = new RollupAccount(3);
        const account4 = new RollupAccount(4);
        const account5 = new RollupAccount(5);
        
        const txPool = await TxPool(rollupDB, conversion);
        txPool.setFeeDeposit(0.2);
        txPool.setEthPrice(conversion[0].price);

        // Transaction to a non-existent leaf with enough funds
        const tx0 = { toAx: account3.ax, toAy: account3.ay, toEthAddr: account3.ethAddress, coin: 0, amount: eth(6), nonce: 0, fee: Constants.fee["50%"]};
        const tx1 = { toAx: account4.ax, toAy: account4.ay, toEthAddr: account4.ethAddress, coin: 0, amount: eth(2), nonce: 0, fee: Constants.fee["50%"]};
        const tx2 = { toAx: account5.ax, toAy: account5.ay, toEthAddr: account5.ethAddress, coin: 0, amount: eth(4), nonce: 0, fee: Constants.fee["50%"]};

        account1.signTx(tx0);
        account1.signTx(tx1);
        account1.signTx(tx2);

        const resTx0 = await txPool.addTx(tx0);
        const resTx1 = await txPool.addTx(tx1);
        const resTx2 = await txPool.addTx(tx2);

        assert.equal(resTx0, true);
        assert.equal(resTx1, true);
        assert.equal(resTx2, true);
        
        // newPool
        const newTxPool = await TxPool(rollupDB, conversion, {feeDeposit: 0.2, ethPrice:conversion[0].price});

        const bb = await rollupDB.buildBatch(4, 8);
        await newTxPool.fillBatch(bb);

        // 2 deposits off-chain added
        assert.equal(bb.offChainTxs.length, 1);
        assert.equal(bb.onChainTxs.length, 1);

        await rollupDB.consolidate(bb);
        
        // Check balances
        const state3 = await rollupDB.getStateByAccount(0, account3.ax, account3.ay);
        assert.equal(Scalar.eq(state3.amount, eth(6)), true);

        const state4 = await rollupDB.getStateByAccount(0, account4.ax, account4.ay);
        assert.equal(state4, null);

        const state5 = await rollupDB.getStateByAccount(0, account5.ax, account5.ay);
        assert.equal(state5, null);

        const state1 = await rollupDB.getStateByAccount(0, account1.ax, account1.ay);
        // finalAmount = initialDeposit - transfer - fee = 100 - 6 - 3 eth
        assert.equal(Scalar.eq(state1.amount, eth(91)), true);
    });

    it("Should check update TmpState with on-chain transactions", async () => {
        // Start a new state
        const db = new SMTMemDB();
        const rollupDB = await RollupDB(db);

        const [account1, account2] = await initBlock(rollupDB);

        const bbTmp = await rollupDB.buildBatch(4, 8);
    
        // build tmp State for the Block 1
        const txsOnChain = [];
        txsOnChain[0] = {  
            loadAmount: 0, 
            amount: eth(96),
            coin: 0, 
            fromAx: account1.ax, 
            fromAy: account1.ay,
            fromEthAddr: account1.ethAddress,
            toAx: account2.ax,
            toAy: account2.ay,
            toEthAddr: account2.ethAddress,
            onChain: true 
        };
    
        for (let i=0; i<txsOnChain.length; i++) {
            await bbTmp.addTx(txsOnChain[i]);
        }
        await bbTmp.build();

        const tmpStateOnchain = await bbTmp.getTmpStateOnChain();

        // Block 1 off-chain Transactions, should be the same as first test:
        const txPool = await TxPool(rollupDB, conversion);

        const txs = [];
        txs[0] = { toAx: account2.ax, toAy: account2.ay, toEthAddr: account2.ethAddress, coin: 0, amount: eth(3), nonce: 0, fee: Constants.fee["0.001%"]};
        txs[1] = { toAx: account2.ax, toAy: account2.ay, toEthAddr: account2.ethAddress, coin: 0, amount: eth(2), nonce: 1, fee: Constants.fee["0.002%"]};

        account1.signTx(txs[0]);
        account1.signTx(txs[1]);

        for (let i=0; i<txs.length; i++) {
            await txPool.addTx(txs[i]);
        }
        
        const bb = await rollupDB.buildBatch(8, 8);

        for (let i=0; i<txsOnChain.length; i++) { // fill batch with Onchain Tx
            await bb.addTx(txsOnChain[i]);
        }

        await txPool.fillBatch(bb, tmpStateOnchain); // update tmpState of the pool with the Onchain Tx

        const calcSlots = bb.offChainTxs.map((tx) => tx.slot);
        const expectedSlots = [ 0 ];

        assert.deepEqual(calcSlots, expectedSlots);

        await rollupDB.consolidate(bb);

        await txPool.purge();

        assert.equal(txPool.txs.length, 1);
    });

    it("Should check purge functionality", async () => {
        // Start a new state
        const db = new SMTMemDB();
        const rollupDB = await RollupDB(db);

        const [account1, account2] = await initBlock(rollupDB);

        /// Block 2
        const txPool = await TxPool(rollupDB, conversion, {executableSlots: 1, nonExecutableSlots: 1});

        const txs = [];
        txs[0] = { toAx: account2.ax, toAy: account2.ay, toEthAddr: account2.ethAddress, coin: 0, amount: eth(3), nonce: 0, fee: Constants.fee["0.001%"]};
        txs[1] = { toAx: account1.ax, toAy: account1.ay, toEthAddr: account1.ethAddress, coin: 0, amount: eth(2), nonce: 0, fee: Constants.fee["0.002%"]};
        txs[2] = { toAx: account2.ax, toAy: account2.ay, toEthAddr: account2.ethAddress, coin: 1, amount: dai(4), nonce: 0, fee: Constants.fee["0.2%"]};
        txs[3] = { toAx: account2.ax, toAy: account2.ay, toEthAddr: account2.ethAddress, coin: 1, amount: dai(2), nonce: 1, fee: Constants.fee["1%"]};
        txs[4] = { toAx: account1.ax, toAy: account1.ay, toEthAddr: account1.ethAddress, coin: 1, amount: dai(5), nonce: 0, fee: Constants.fee["2%"]};
        txs[5] = { toAx: account1.ax, toAy: account1.ay, toEthAddr: account1.ethAddress, coin: 1, amount: dai(3), nonce: 0, fee: Constants.fee["2%"]};

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

    it("Should check send hundreds of txs", async () => {
        // Start a new state
        const db = new SMTMemDB();
        const rollupDB = await RollupDB(db);

        const [account1, account2] = await initBlock(rollupDB);

        /// Block 2
        const txPool = await TxPool(rollupDB, conversion, {executableSlots: 1, nonExecutableSlots: 1, maxSlots: 10});

        const txs = [];
        txs[0] = { toAx: account2.ax, toAy: account2.ay, toEthAddr: account2.ethAddress, coin: 0, amount: eth(3), nonce: 0, fee: Constants.fee["0.001%"]};
        txs[1] = { toAx: account1.ax, toAy: account1.ay, toEthAddr: account1.ethAddress, coin: 0, amount: eth(2), nonce: 0, fee: Constants.fee["0.002%"]};
        txs[2] = { toAx: account2.ax, toAy: account2.ay, toEthAddr: account2.ethAddress, coin: 1, amount: dai(4), nonce: 0, fee: Constants.fee["0.2%"]};
        txs[3] = { toAx: account2.ax, toAy: account2.ay, toEthAddr: account2.ethAddress, coin: 1, amount: dai(2), nonce: 1, fee: Constants.fee["1%"]};
        txs[4] = { toAx: account1.ax, toAy: account1.ay, toEthAddr: account1.ethAddress, coin: 1, amount: dai(5), nonce: 0, fee: Constants.fee["2%"]};
        txs[5] = { toAx: account1.ax, toAy: account1.ay, toEthAddr: account1.ethAddress, coin: 1, amount: dai(3), nonce: 0, fee: Constants.fee["2%"]};

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
        txs[0] = { toAx: account2.ax, toAy: account2.ay, toEthAddr: account2.ethAddress, coin: 0, amount: eth(3), nonce: 0, fee: Constants.fee["0.001%"]}; // from: unexistent leaf
        txs[1] = { toAx: account3.ax, toAy: account3.ay, toEthAddr: account3.ethAddress, coin: 0, amount: eth(3), nonce: 0, fee: Constants.fee["0.001%"]}; // to: unexistent leaf
        txs[2] = { toAx: account2.ax, toAy: account2.ay, toEthAddr: account2.ethAddress, coin: 3, amount: dai(4), nonce: 0, fee: Constants.fee["0.05%"]}; // coin does not match
        txs[3] = { toAx: account2.ax, toAy: account2.ay, toEthAddr: account2.ethAddress, coin: 1, amount: dai(1000), nonce: 0, fee: Constants.fee["0.01%"]}; // insufficient funds
        txs[4] = { toAx: account2.ax, toAy: account2.ay, toEthAddr: account2.ethAddress, coin: 1, amount: dai(2), nonce: 10, fee: Constants.fee["0.01%"]}; // invalid nonce 
        txs[5] = { toAx: account2.ax, toAy: account2.ay, toEthAddr: account2.ethAddress, coin: 0, amount: eth(70), nonce: 0, fee: Constants.fee["50%"]}; // insufficient fee funds
        txs[6] = { toAx: account2.ax, toAy: account2.ay, toEthAddr: account2.ethAddress, coin: 0, amount: eth(2), nonce: 0, fee: Constants.fee["0.01%"], onChain : true}; // onChain should be false
        txs[7] = { toAx: account2.ax, toAy: account2.ay, toEthAddr: account2.ethAddress, coin: 0, amount: eth(2), nonce: 0, fee: Constants.fee["0.01%"]}; // invalid signature

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
                amount: gwei(1),
                nonce: i,
                fee: Constants.fee["1%"],
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
