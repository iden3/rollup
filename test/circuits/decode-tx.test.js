const { expect } = require("chai");
const path = require("path");
const tester = require("circom").tester;

const RollupAccount = require("../../js/rollupaccount");
const RollupTx = require("../../js/tx");
const { random } = require("./helpers/utils-circuit");

describe("Decode Tx test", function () {
    let circuit;

    this.timeout(10000);

    // Accounts
    const fromAcc = new RollupAccount(0);
    const toAcc = new RollupAccount(1);

    before( async() => {
        circuit = await tester(path.join(__dirname, "circuits-test", "decodetx_test.circom"));
        await circuit.loadConstraints();
        console.log("Constraints `decodetx.circom` circuit: " + circuit.constraints.length + "\n");
    });

    it("Should check decode txData", async () => {
        const tx = {
            amount: random(2**50),
            coin: random(2**32),
            nonce: random(2**48),
            fee: Math.floor(random(16)),
            rqOffset: random(2**3),
            onChain: 1,
            newAccount: 0,
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
            inIdx: 0,
        };

        const w = await circuit.calculateWitness(input, {logOutput: false});

        const checkOut = {
            amount: rollupTx.amount,
            coin: rollupTx.coin,
            nonce: rollupTx.nonce,
            fee: rollupTx.fee,
            rqOffset: rollupTx.rqOffset,
            onChain: rollupTx.onChain,
            newAccount: rollupTx.newAccount,
        };

        await circuit.assertOut(w, checkOut);
    });

    it("Should check signature off-chain", async () => {
        const tx = {
            amount: random(2**50),
            coin: random(2**32),
            nonce: random(2**48),
            fee: Math.floor(random(16)),
            rqOffset: random(2**3),
            onChain: 1,
            newAccount: 0,
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
            inIdx: 0,
        };

        const w = await circuit.calculateWitness(input, {logOutput: false});

        const checkOut = {
            sigOffChainHash: rollupTx.getHashSignature(), 
        };

        await circuit.assertOut(w, checkOut);
    });

    it("Should check on-chain hash", async () => {
        const oldOnChainHash = 0;

        const tx = {
            loadAmount: random(2**50),
            amount: random(2**50),
            coin: random(2**32),
            nonce: random(2**48),
            fee: Math.floor(random(16)),
            rqOffset: random(2**3),
            onChain: 1,
            newAccount: 0,
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
            inIdx: 0,
        };

        const w = await circuit.calculateWitness(input, {logOutput: false});

        const checkOut = {
            newOnChainHash: rollupTx.getOnChainHash(oldOnChainHash), 
        };

        await circuit.assertOut(w, checkOut);
    });

    it("Should check off-chain Vs on-chain order", async () => {
        /*
            Previous    Current     Allowed
            -------------------------------
            off-chain   off-chain   true
            off-chain   on-chain    false
            on-chain    off-chain   true         
            on-chain    on-chain    true       
        */

        const tx = {
            onChain: 0,
            newAccount: 0,
        };
    
        let rollupTx = new RollupTx(tx);

        const input = {
            previousOnChain: 0,
            oldOnChainHash: 0,
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
            inIdx: 0,
        };

        // off-chain --> off-chain
        await circuit.calculateWitness(input, {logOutput: false});

        // off-chain --> on-chain
        tx.onChain = 1;
        rollupTx = new RollupTx(tx);
        input.txData = rollupTx.getTxData();
        input.previousOnChain = 0;
        try {
            await circuit.calculateWitness(input, {logOutput: false});
            expect(true).to.be.equal(false);
        } catch (error) {
            expect(error.message.includes("Constraint doesn't match"))
                .equal(true);
        }

        // on-chain --> off-chain
        tx.onChain = 0;
        rollupTx = new RollupTx(tx);
        input.txData = rollupTx.getTxData();
        input.previousOnChain = 1;
        await circuit.calculateWitness(input, {logOutput: false});

        // on-chain --> on-chain
        tx.onChain = 1;
        rollupTx = new RollupTx(tx);
        input.txData = rollupTx.getTxData();
        input.previousOnChain = 1;
        await circuit.calculateWitness(input, {logOutput: false});
    });

    it("Should check incremental Idx", async () => {
        const tx = {
            onChain: 1,
            newAccount: 1,
            fromIdx: 3,
        };
    
        let rollupTx = new RollupTx(tx);

        const input = {
            previousOnChain: 1,
            oldOnChainHash: 0,
            txData: rollupTx.getTxData(),
            rqTxData: 0,
            loadAmount: rollupTx.loadAmount,
            fromAx: rollupTx.fromAx,
            fromAy: rollupTx.fromAy,
            fromEthAddr: rollupTx.fromEthAddr,
            toAx: rollupTx.toAx,
            toAy: rollupTx.toAy,
            toEthAddr: rollupTx.toEthAddr,
            fromIdx: rollupTx.fromIdx,
            toIdx: 0,
            inIdx: 2,
        };

        // correct incremental
        let w = await circuit.calculateWitness(input, {logOutput: false});

        let checkOut = {
            outIdx: input.inIdx + 1, 
        };

        await circuit.assertOut(w, checkOut);

        // incorrect incremental
        input.inIdx = 5;
        try {
            await circuit.calculateWitness(input, {logOutput: false});
            expect(true).to.be.equal(false);
        } catch(error){
            expect(error.message.includes("Constraint doesn't match"))
                .equal(true);    
        }

        // correct incremental
        tx.onChain = 1;
        tx.newAccount = 0;
        rollupTx = new RollupTx(tx);
        input.txData = rollupTx.getTxData();
        input.previousOnChain = 1;
        w = await circuit.calculateWitness(input, {logOutput: false});
        checkOut.outIdx = input.inIdx;
        
        await circuit.assertOut(w, checkOut);

        // correct incremental
        tx.onChain = 0;
        tx.newAccount = 0;
        rollupTx = new RollupTx(tx);
        input.txData = rollupTx.getTxData();
        input.previousOnChain = 1;
        w = await circuit.calculateWitness(input, {logOutput: false});
        checkOut.outIdx = input.inIdx;
        
        await circuit.assertOut(w, checkOut);
    });
});