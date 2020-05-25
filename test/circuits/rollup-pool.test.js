const { assert } = require("chai");
const path = require("path");
const Scalar = require("ffjavascript").Scalar;
const tester = require("circom").tester;
const SMTMemDB = require("circomlib").SMTMemDB;

const RollupAccount = require("../../js/rollupaccount");
const RollupDB = require("../../js/rollupdb");
const TxPool = require("../../js/txpool");
const Constants = require("../../js/constants");
const checkBatch = require("./helpers/checkbatch");

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
const dai = (e) => Scalar.mul(e, Scalar.pow(10, 18));

const beneficiaryAddress = "0x123456789abcdef123456789abcdef123456789a";

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

describe("Rollup circuit integration with tramsaction pool test", function () {

    this.timeout(150000);

    let circuit;

    before( async() => {
        circuit = await tester(path.join(__dirname, "circuits-test", "rollup_pool_test.circom"), {reduceConstraints:false});

        // const testerAux = require("circom").testerAux;
        // const pathTmp = "/tmp/circom_70740E7ND3Z1t3Vf";
        // circuit = await testerAux(pathTmp, path.join(__dirname, "circuits", "rollup_pool_test.circom"), {reduceConstraints:false});
    });

    it("Should extract 4 tx from pool", async () => {
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
        txs[4] = { toAx: account1.ax, toAy: account1.ay, toEthAddr: account1.ethAddress, coin: 1, amount: dai(5), nonce: 0, fee: Constants.fee["2%"]}; // can't be mined
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
        bb.addBeneficiaryAddress(beneficiaryAddress);
        
        await txPool.fillBatch(bb);

        const calcSlots = bb.offChainTxs.map((tx) => tx.slot);
        const expectedSlots = [ 2, 5, 3, 0 ];

        assert.deepEqual(calcSlots, expectedSlots);

        const input = bb.getInput();

        const w = await circuit.calculateWitness(input, {logTrigger:false, logOutput: false, logSet: false});
        
        await checkBatch(circuit, w, bb);

        await rollupDB.consolidate(bb);

        await txPool.purge();

        assert.equal(txPool.txs.length, 1);
    });
});
