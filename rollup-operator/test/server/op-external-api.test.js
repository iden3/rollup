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
const process = require("child_process");
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

    async function initRollupWallet(rollupWallet) {
        const fillTokens = 25;
        const fillEth = 100;

        const walletEth = rollupWallet.ethWallet.wallet;

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

    // Rollup wallets
    const pass = "pass";
    const rollupWallets = [];
    const rollupEncWallets = [];

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
    });

    it("manage rollup token and fill funds to rollup user", async () => { 
        // Init first rollup wallet
        let mnemonic = "maximum direct solution mushroom before meat public bean board frown announce lawn";
        const wallet0 = await Wallet.fromMnemonic(mnemonic);
        rollupWallets.push(wallet0);
        let encryptedWallet = await wallet0.toEncryptedJson(pass);
        rollupEncWallets.push(encryptedWallet);
        await initRollupWallet(wallet0);
        
        // Init second rollup wallet
        mnemonic = "enjoy alter satoshi squirrel special spend crop link race rally two eye";
        const wallet1 = await Wallet.fromMnemonic(mnemonic);
        rollupWallets.push(wallet1);
        encryptedWallet = await wallet1.toEncryptedJson(pass);
        rollupEncWallets.push(encryptedWallet);
        await initRollupWallet(wallet1);
    });

    it("Should get empty operator list", async () => { 
        const res = await cliExternalOp.getOperators();
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
        const ethAddress = undefined;

        // account idx = 1
        let resDeposit = await cliDeposit.deposit(web3.currentProvider.host, insRollup.address, amountDeposit, token, 
            rollupEncWallets[0], pass, ethAddress, Rollup.abi);
        await resDeposit.wait();
        // account idx = 2
        resDeposit = await cliDeposit.deposit(web3.currentProvider.host, insRollup.address, amountDeposit, token, 
            rollupEncWallets[1], pass, ethAddress, Rollup.abi);
        await resDeposit.wait();
    });

    it("Should get general information", async () => { 
        const res = await cliExternalOp.getState();
        expect(res.data).to.not.be.equal(undefined);

        const blockGenesis = res.data.posSynch.genesisBlock;
        const currentBlock = res.data.currentBlock;
        await addBlocks(blockGenesis - currentBlock + 1); // move to era 0
        await timeout(timeoutSynch); // time to synch
    });

    it("Should get one operator", async () => { 
        const res = await cliExternalOp.getOperators();
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
            const res = await cliExternalOp.getState();
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
        const res = await cliExternalOp.getOperators();
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
        await cliSendOffChainTx.send(urlOp, configTx.to, configTx.amount, rollupEncWallets[0],
            pass, configTx.token, configTx.userFee, configTx.from);
    });

    it("Should forge off-chain transaction", async () => {
        let batchForged = false;
        let counter = 0;
        while(!batchForged && counter < 10) {
            const res = await cliExternalOp.getState();
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
        const res = await cliExternalOp.getOperators();
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
        await cliSendOffChainTx.send(urlOp, configTx.to, configTx.amount, rollupEncWallets[1],
            pass, configTx.token, configTx.userFee, configTx.from);
    });
    
    it("Should forge withdraw off-chain transaction", async () => {
        let batchForged = false;
        let counter = 0;
        while(!batchForged && counter < 10) {
            const res = await cliExternalOp.getState();
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

    it("Should check exit batches and get its information", async () => {
        const id = 2;
        
        const res = await cliExternalOp.getExits(id);
        expect(res.status).to.be.equal(200);
        const exitsNumBatches = res.data;
        expect(exitsNumBatches.length).to.not.be.equal(0);

        for (const numBatch of exitsNumBatches){
            const res = await cliExternalOp.getExitInfo(id, numBatch);
            const infoExit = res.data;
            expect(infoExit.state.idx).to.be.equal(id);
        }
    });

    it("Should check account balances", async () => {
        // Theoretical balances overview:
        // deposits: id1 --> 10, id2 --> 10
        // off-chain tx: id1 --> 5, id2 --> 13 (from: id1, to: id2, amount:3, fee: 2)
        // off-chain tx: id1 --> 5, ide2 --> 9 (from: id2, to: 0, amount:3, fee: 1)

        const id1 = 1;
        const id2 = 2;
        const amountId1 = 5;
        const amountId2 = 9;

        const resId1 = await cliExternalOp.getAccountByIdx(id1);
        const resId2 = await cliExternalOp.getAccountByIdx(id2);

        expect(resId1.data.amount).to.be.equal(amountId1.toString());
        expect(resId2.data.amount).to.be.equal(amountId2.toString());
    });

    it("Should retrieve account information", async () => {
        
        const id0 = 1;
        const walletEth0 = rollupWallets[0].ethWallet.wallet;
        const walletEthAddress0 = walletEth0.address.toString();
        const walletAx0 = rollupWallets[0].babyjubWallet.publicKey[0].toString(16);
        const walletAy0 = rollupWallets[0].babyjubWallet.publicKey[1].toString(16);

        const id1 = 2;
        const walletEth1 = rollupWallets[1].ethWallet.wallet;
        const walletEthAddress1 = walletEth1.address.toString();
        const walletAx1 = rollupWallets[1].babyjubWallet.publicKey[0].toString(16);
        const walletAy1 = rollupWallets[1].babyjubWallet.publicKey[1].toString(16);

        it("by Id", async () => {
            const resId0 = await cliExternalOp.getAccountByIdx(id0);
            expect(resId0.data.ax).to.be.equal(walletAx0);
            expect(resId0.data.ay).to.be.equal(walletAy0);
            expect(resId0.data.ethAddress).to.be.equal(walletEthAddress0);

            const resId1 = await cliExternalOp.getAccountByIdx(id1);
            expect(resId1.data.ax).to.be.equal(walletAx1);
            expect(resId1.data.ay).to.be.equal(walletAy1);
            expect(resId1.data.ethAddress).to.be.equal(walletEthAddress1);
        });
        
        it("filter by Ax, Ay", async () => { 
            let filters;
            let account;

            filters = {
                ax: walletAx0,
                ay: walletAy0,
            };

            const resAxAy0 = await cliExternalOp.getAccounts(filters);
            const listAccounts0 = resAxAy0.data; 
            expect(listAccounts0.length).to.be.equal(1);
            
            account = listAccounts0[0];
            expect(account.ax).to.be.equal(walletAx0);
            expect(account.ay).to.be.equal(walletAy0);
            expect(account.ethAddress).to.be.equal(walletEthAddress0);

            filters = {
                ax: walletAx1,
                ay: walletAy1,
            };

            const resAxAy1 = await cliExternalOp.getAccounts(filters);
            const listAccounts1 = resAxAy1.data; 
            expect(listAccounts1.length).to.be.equal(1);

            account = listAccounts1[0];
            expect(account.ax).to.be.equal(walletAx1);
            expect(account.ay).to.be.equal(walletAy1);
            expect(account.ethAddress).to.be.equal(walletEthAddress1);
        });

        it("filter by EthAddress", async () => { 
            let filters;
            let account;

            filters = {
                ethAddr: walletEthAddress0,
            };

            const resEth0 = await cliExternalOp.getAccounts(filters);
            const listAccounts0 = resEth0.data;
            expect(listAccounts0.length).to.be.equal(1);

            account = listAccounts0[0];
            expect(account.ax).to.be.equal(walletAx0);
            expect(account.ay).to.be.equal(walletAy0);
            expect(account.ethAddress).to.be.equal(walletEthAddress0);

            filters = {
                ethAddr: walletEthAddress1,
            };

            const resEth1 = await cliExternalOp.getAccounts(filters);
            const listAccounts1 = resEth1.data;
            expect(listAccounts1.length).to.be.equal(1);

            account = listAccounts1[0];
            expect(account.ax).to.be.equal(walletAx1);
            expect(account.ay).to.be.equal(walletAy1);
            expect(account.ethAddress).to.be.equal(walletEthAddress1);
        });

        it("filter both babyjubjub and address", async () => { 
            let filters;
            let account;

            filters = {
                ax: walletAx0,
                ay: walletAy0,
                ethAddr: walletEthAddress0,
            };

            const res0 = await cliExternalOp.getAccounts(filters);
            const listAccounts0 = res0.data;
            expect(listAccounts0.length).to.be.equal(1);

            account = listAccounts0[0];
            expect(account.ax).to.be.equal(walletAx0);
            expect(account.ay).to.be.equal(walletAy0);
            expect(account.ethAddress).to.be.equal(walletEthAddress0);

            filters = {
                ax: walletAx0,
                ay: walletAy0,
                ethAddr: walletEthAddress1,
            };

            try {
                await cliExternalOp.getAccounts(filters);
            } catch (error) {
                expect((error.response.data).includes("No account has been found")).to.be.equal(true);
            }
        });
    });

    after(async () => {
        process.exec("find . -depth -type d -name 'tmp-*' -prune -exec rm -rf {} +");
    });
});