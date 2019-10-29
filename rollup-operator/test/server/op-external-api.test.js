/* global artifacts */
/* global contract */
/* global web3 */

const chai = require("chai");
const { expect } = chai;
const { addBlocks } = require("../../../test/contracts/helpers/timeTravel");
const ethers = require("ethers");
const TokenRollup = artifacts.require("../contracts/test/TokenRollup");
const Rollup = artifacts.require("../contracts/test/Rollup");
const RollupPoS = artifacts.require("../contracts/RollupPoS");
const fs = require("fs");
const path = require("path");
const { timeout } = require("../../src/utils");
const configTestPath = path.join(__dirname, "../config/test.json");

const CliAdminOp = require("../../src/cli-admin-operator");
const CliExternalOp = require("../../src/cli-external-operator");
const { Wallet } = require("../../../rollup-cli/src/wallet");
const cliDeposit = require("../../../rollup-cli/src/actions/onchain/deposit");
const cliSendOffChainTx = require("../../../rollup-cli/src/actions/offchain/send");

// test timeouts
const timeoutSynch = 20000;
const timeoutBlocks = 5000;
const timeoutLoop = 10000;


// This test assumes 'server-proof' is running locally on port 10001
// This test assumes 'operator' api-admin is running locally on port 9000
// This test assumes 'operator' api-external is running locally on port 9001

contract("Operator", (accounts) => {

    async function getEtherBalance(address) {
        let balance = await web3.eth.getBalance(address);
        balance = web3.utils.fromWei(balance, "ether");
        return Number(balance);
    }

    const {
        0: owner,
        1: tokenId,
    } = accounts;

    // Clients
    let cliAdminOp;
    let cliExternalOp;

    // Url
    const urlAdminOp = "http://127.0.0.1:9000";
    const urlExternalOp = "http://127.0.0.1:9001";

    // Constants to move to a specific era
    const slotPerEra = 20;
    const blocksPerSlot = 100;
    const blockPerEra = slotPerEra * blocksPerSlot;

    // Operator wallet
    const passphrase = "passphrase";
    let walletOp;
    let walletOpEnc;

    // Rollup wallet
    const mnemonic = "maximum direct solution mushroom before meat public bean board frown announce lawn";
    const pass = "pass";
    let rollupWallet;
    let walletEth;
    let walletBaby;
    let encryptedWallet;

    // Contract instances
    let insTokenRollup;
    let insRollup;

    before(async () => {
        // Load test configuration
        const configTest = JSON.parse(fs.readFileSync(configTestPath));
        // Load TokenRollup
        insTokenRollup = await TokenRollup.at(configTest.tokenAddress);
        // Load Rollup
        insRollup = await Rollup.at(configTest.rollupAddress);
        // Load rollup PoS
        await RollupPoS.at(configTest.posAddress);

        // Load clients
        cliAdminOp = new CliAdminOp(urlAdminOp);
        cliExternalOp = new CliExternalOp(urlExternalOp);

        // load operator wallet with funds
        let privateKey = "0x0123456789012345678901234567890123456789012345678901234567890123";
        walletOp = new ethers.Wallet(privateKey);
        const initBalance = 1000;
        await web3.eth.sendTransaction({to: walletOp.address, from: owner,
            value: web3.utils.toWei(initBalance.toString(), "ether")});
        walletOpEnc = await walletOp.encrypt(passphrase);

        // load rollup user wallet
        rollupWallet = await Wallet.fromMnemonic(mnemonic);
        walletEth = rollupWallet.ethWallet.wallet;
        walletBaby = rollupWallet.babyjubWallet;
        encryptedWallet = await rollupWallet.toEncryptedJson(pass);
    });

    it("manage rollup token and fill funds to rollup user", async () => { 
        const fillTokens = 25;
        const fillEth = 100;
        // Send ether to rollup user
        await web3.eth.sendTransaction({to: walletEth.address, from: owner,
            value: web3.utils.toWei(fillEth.toString(), "ether")});
        
        // Check ether balance
        const bal = await getEtherBalance(walletEth.address);
        expect(bal).to.be.equal(fillEth);

        // transfer tokens to rollup user
        await insTokenRollup.transfer(walletEth.address, fillTokens, { from: tokenId });
        // Send approve tx from rollup user
        const tx = {
            from:  walletEth.address, 
            gasLimit: web3.utils.toHex(800000),
            gasPrice: web3.utils.toHex(web3.utils.toWei("10", "gwei")),
            to: insTokenRollup.address, 
            data: insTokenRollup.contract.methods.approve(insRollup.address, fillTokens).encodeABI()
        };
        let signPromise = await web3.eth.accounts.signTransaction(tx, walletEth.privateKey);
        await web3.eth.sendSignedTransaction(signPromise.rawTransaction);

        // Check token balance
        const resWalletEth = await insTokenRollup.balanceOf(walletEth.address);
        expect(resWalletEth.toString()).to.be.equal(fillTokens.toString());
    });

    it("Should get empty operator list", async () => { 
        const res = await cliExternalOp.getOperatorsList();
        expect(Object.keys(res.data).length).to.be.equal(0);
    });

    it("Should load and register operator", async () => {
        const stake = 2;
        const url = urlExternalOp;
        const seed = "rollup";

        await cliAdminOp.loadWallet(walletOpEnc, passphrase); 
        await cliAdminOp.register(stake, url, seed);
    });

    it("Should add two deposits", async () => {
        const token = 0;
        const amountDeposit = 10;

        // account idx = 1
        let resDeposit = await cliDeposit.deposit(web3.currentProvider.host, insRollup.address, amountDeposit, token, 
            encryptedWallet, pass, Rollup.abi);
        await resDeposit.wait();
        // account idx = 2
        resDeposit = await cliDeposit.deposit(web3.currentProvider.host, insRollup.address, amountDeposit, token, 
            encryptedWallet, pass, Rollup.abi);
        await resDeposit.wait();
    });

    it("Should get general information", async () => { 
        const res = await cliExternalOp.getGeneralInfo();
        expect(res.data).to.not.be.equal(undefined);

        const blockGenesis = res.data.posSynch.genesisBlock;
        const currentBlock = res.data.currentBlock;
        await addBlocks(blockGenesis - currentBlock + 1); // move to era 0
        await timeout(timeoutSynch); // time to synch
    });

    it("Should get one operator", async () => { 
        const res = await cliExternalOp.getOperatorsList();
        const listOperators = res.data;
        let found = false;
        for (const opInfo of Object.values(listOperators)){
            if (opInfo.controllerAddress == walletOp.address.toString()){
                found = true;
                break;
            }
        }
        expect(found).to.be.equal(true);
    });

    it("Should move to era 2", async () => {
        await addBlocks(blockPerEra); // move to era 1
        await timeout(timeoutBlocks); // wait time to add all blocks
        await addBlocks(blockPerEra); // move to era 2
        await timeout(timeoutBlocks); // wait time to add all blocks
    });

    it("Should forge genesis and on-chain transaction", async () => {
        let batchForged = false;
        let counter = 0;
        while(!batchForged && counter < 10) {
            const res = await cliExternalOp.getGeneralInfo();
            const info = res.data;
            if (info.rollupSynch.lastBatchSynched > 0) {
                batchForged = true;
                break;
            } 
            await timeout(timeoutLoop);
            counter += 1;
        }
        expect(batchForged).to.be.equal(true);
    });

    it("Should set pool conversion table", async () => {
        const conversion = {
            0: {
                token: "ROLL",
                price: 20,
                decimals: 18
            }
        };
        const res = await cliAdminOp.setConversion(conversion);
        expect(res.status).to.be.equal(200);
    });

    it("Should add off-chain transaction to the pool", async () => {
        // Retrieve operator url
        const res = await cliExternalOp.getOperatorsList();
        const listOperators = res.data;
        const urlOp = listOperators[0].url;
        // config transaction
        const configTx = {
            from: 1,
            to: 2,
            token: 0,
            amount: 3,
            userFee: 2, 
        };
        // send transaction with client
        await cliSendOffChainTx.send(urlOp, configTx.to, configTx.amount, encryptedWallet,
            pass, configTx.token, configTx.userFee, configTx.from);
    });

    it("Should forge off-chain transaction", async () => {
        let batchForged = false;
        let counter = 0;
        while(!batchForged && counter < 10) {
            const res = await cliExternalOp.getGeneralInfo();
            const info = res.data;
            if (info.rollupSynch.lastBatchSynched > 3) {
                batchForged = true;
                break;
            } 
            await timeout(timeoutLoop);
            counter += 1;
        }
        expect(batchForged).to.be.equal(true);
    });

    it("Should add withdraw off-chain transaction to the pool", async () => {
        // Retrieve operator url
        const res = await cliExternalOp.getOperatorsList();
        const listOperators = res.data;
        const urlOp = listOperators[0].url;
        // config transaction
        const configTx = {
            from: 2,
            to: 0,
            token: 0,
            amount: 3,
            nonce: 0,
            userFee: 1, 
        };
        // send transaction with client
        await cliSendOffChainTx.send(urlOp, configTx.to, configTx.amount, encryptedWallet,
            pass, configTx.token, configTx.userFee, configTx.from);
    });
    
    it("Should forge withdraw off-chain transaction", async () => {
        let batchForged = false;
        let counter = 0;
        while(!batchForged && counter < 10) {
            const res = await cliExternalOp.getGeneralInfo();
            const info = res.data;
            if (info.rollupSynch.lastBatchSynched > 6) {
                batchForged = true;
                break;
            } 
            await timeout(timeoutLoop);
            counter += 1;
        }
        expect(batchForged).to.be.equal(true);
    });

    it("Should create leaf on exit tree", async () => {
        const id = 2;
        let infoLeaf;
        for (let i = 1; i < 7; i++) {
            const res = await cliExternalOp.getExitInfo(i, id);
            infoLeaf = res.data;
            if (infoLeaf.found) break;
        }
        expect(infoLeaf.state.idx).to.be.equal(id);
    });

    it("Should check balances", async () => {
        // Theoretical balances overview:
        // deposits: id1 --> 10, id2 --> 10
        // off-chain tx: id1 --> 5, id2 --> 13 (from: id1, to: id2, amount:3, fee: 2)
        // off-chain tx: id1 --> 5, ide2 --> 9 (from: id2, to: 0, amount:3, fee: 1)

        const id1 = 1;
        const id2 = 2;
        const amountId1 = 5;
        const amountId2 = 9;

        const resId1 = await cliExternalOp.getInfoByIdx(id1);
        const resId2 = await cliExternalOp.getInfoByIdx(id2);

        expect(resId1.data.amount).to.be.equal(amountId1.toString());
        expect(resId2.data.amount).to.be.equal(amountId2.toString());
    });

    describe("Should retrieve leaf information", async () => {
        let id;
        let walletAx;
        let walletAy;

        it("by Ax, Ay", async () => { 
            walletAx = walletBaby.publicKey[0].toString(16);
            walletAy = walletBaby.publicKey[1].toString(16);
            const resAxAy = await cliExternalOp.getInfoByAxAy(walletAx, walletAy);
            id = resAxAy.data[0].idx;
        });

        it("by Id", async () => { 
            const resId = await cliExternalOp.getInfoByIdx(id);
            expect(resId.data.ax).to.be.equal(walletAx);
            expect(resId.data.ay).to.be.equal(walletAy);
        });

        it("by EthAddress", async () => { 
            const walletEthAddress = walletEth.address.toString();
            const resAthAddress = await cliExternalOp.getInfoByEthAddr(walletEthAddress);
            expect(resAthAddress.data[0].idx).to.be.equal(id);
        });
    });
});