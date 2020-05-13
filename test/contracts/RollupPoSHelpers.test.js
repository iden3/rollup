/* eslint-disable no-underscore-dangle */
/* global artifacts */
/* global contract */
/* global web3 */

const { expect } = require("chai");
const SMTMemDB = require("circomlib/src/smt_memdb");

const HelpersPoSTest = artifacts.require("../contracts/test/RollupPoSHelpersTest");
const RollupDB = require("../../js/rollupdb");
const { BabyJubWallet } = require("../../rollup-utils/babyjub-wallet");
const { exitAx, exitAy, exitEthAddr} = require("../../js/constants");

async function checkHashOffChain(bb, insPoS, maxTx) {
    await bb.build();
    const data = await bb.getDataAvailableSM();
    const hashOffChain = await bb.getOffChainHash();
    const res = await insPoS.hashOffChainTxTest(data, maxTx);
    expect(hashOffChain.toString()).to.be.equal(res.toString());
}

contract("RollupPoSHelpers functions", (accounts) => {

    const {
        1: id1
    } = accounts;

    let insPoSHelpers;
    const nLevels = 24;
    let db;
    let rollupDB;

    const wallets = [];
    for (let i = 0; i<10; i++) {
        wallets.push(BabyJubWallet.createRandom());
    }

    before(async () => {
        // Deploy rollup helpers test
        insPoSHelpers = await HelpersPoSTest.new();
        // Init rollup Db
        db = new SMTMemDB();
        rollupDB = await RollupDB(db);
    });

    it("Should init rollup Db with two deposits", async () => {
        const maxTx = 10;
        const bb = await rollupDB.buildBatch(maxTx, nLevels);
        bb.addTx({
            loadAmount: 1000,
            coin: 0,
            fromAx: wallets[1].publicKey[0].toString(16),
            fromAy:  wallets[1].publicKey[1].toString(16),
            fromEthAddr: id1,
            toAx: exitAx,
            toAy: exitAy,
            toEthAddr: exitEthAddr,
            onChain: true
        });

        bb.addTx({
            loadAmount: 2000,
            coin: 0,
            fromAx: wallets[2].publicKey[0].toString(16),
            fromAy:  wallets[2].publicKey[1].toString(16),
            fromEthAddr: id1,
            toAx: exitAx,
            toAy: exitAy,
            toEthAddr: exitEthAddr,
            onChain: true
        });
        await bb.build();
        await rollupDB.consolidate(bb);
    });

    it("Should Hash off chain data", async () => {
        let maxTx = 10;
        // empty off-chain tx with 10 txMax
        const bb = await rollupDB.buildBatch(maxTx, nLevels);
        await checkHashOffChain(bb, insPoSHelpers, maxTx);

        // non-empty off-chain tx with 8 txMax
        const tx = { // coin is 0
            fromAx: wallets[1].publicKey[0].toString(16),
            fromAy:  wallets[1].publicKey[1].toString(16),
            fromEthAddr: id1,
            toAx: wallets[2].publicKey[0].toString(16),
            toAy:  wallets[2].publicKey[1].toString(16),
            toEthAddr: id1,
            amount: 50,
            coin: 0,
            fee: 15,
        };
        maxTx = 8;
        const bb2 = await rollupDB.buildBatch(maxTx, nLevels);
        await bb2.addTx(tx);
        await checkHashOffChain(bb2, insPoSHelpers, maxTx);

        // full off-chain data with 34 txMax
        const tx2 = {
            fromAx: wallets[2].publicKey[0].toString(16),
            fromAy:  wallets[2].publicKey[1].toString(16),
            fromEthAddr: id1,
            toAx: wallets[1].publicKey[0].toString(16),
            toAy:  wallets[1].publicKey[1].toString(16),
            toEthAddr: id1,
            amount: 50,
            coin: 0,
            fee: 15,
        };
        maxTx = 34;
        const bb3 = await rollupDB.buildBatch(maxTx, nLevels);
        for (let i = 0; i < maxTx; i++) {
            const txToAdd = (i%2) ? tx : tx2;
            await bb3.addTx(txToAdd);
        }
        await checkHashOffChain(bb3, insPoSHelpers, maxTx);

        // empty off-chain tx with 255 txMax
        maxTx = 255;
        const bb4 = await rollupDB.buildBatch(maxTx, nLevels);
        await checkHashOffChain(bb4, insPoSHelpers, maxTx);

        // empty off-chain tx with 256 txMax
        maxTx = 256;
        const bb5 = await rollupDB.buildBatch(maxTx, nLevels);
        await checkHashOffChain(bb5, insPoSHelpers, maxTx);

        // empty off-chain tx with 257 txMax
        maxTx = 257;
        const bb6 = await rollupDB.buildBatch(maxTx, nLevels);
        await checkHashOffChain(bb6, insPoSHelpers, maxTx);
    });    

    it("Should calculate effective stake for amount < 1 finney", async () => {
        let input = web3.utils.toWei("0.5", "finney");
        let resStake = await insPoSHelpers.effectiveStakeTest(input);
        expect(parseInt((resStake).toString())).to.be.equal(0);
    });

    it("Should calculate effective stake with very low relative error", async () => {
        for (let i = 0; i < 10; i++){
            for (let j = 1; j < 8; j++){ 
                for (let k = 0; k < 11; k++){ 
                    // test from 0.001 ether to 10000 ethers
                    let input = web3.utils.toWei((k+j*10**i).toString(), "finney");
                    let resStake = await insPoSHelpers.effectiveStakeTest(input);
                    let result = parseInt((resStake).toString());
                    let expected = Math.floor(Math.pow(parseInt(input)/1e+15,1.25));
                    // bigger the input, lower the relative error
                    expect(Math.abs((result-expected)/result)).to.be.below(0.0015);
                }
            }
        }
    });
});
