/* global artifacts */
/* global contract */
/* global web3 */

const { expect } = require("chai");
const ethers = require("ethers");
const fs = require("fs");
const process = require("child_process");
const path = require("path");
const Scalar = require("ffjavascript").Scalar;

const TokenRollup = artifacts.require("../contracts/test/TokenRollup");
const Rollup = artifacts.require("../contracts/test/Rollup");
const RollupPoB = artifacts.require("../contracts/RollupPoB");

const { addBlocks } = require("../../../../test/contracts/helpers/timeTravel");
const CliExternalOp = require("../../../src/cli-external-operator");
const { Wallet } = require("../../../../rollup-cli/src/utils/wallet");

const { depositTx, sendTx, withdrawOffChainTx } = require("../../../../rollup-cli/src/utils/cli-utils");
const { timeout } = require("../../../src/utils");
const testUtils = require("../helpers/utils-test");
const Constants = require("../../../../js/constants");

const configTestPath = path.join(__dirname, "../../config/test-pob.json");
// test timeouts
const timeoutSynch = 20000;
const timeoutBlocks = 10000;
const timeoutLoop = 5000;

function to18(e) {
    return Scalar.mul(e, Scalar.pow(10, 18));
}

// This test assumes 'server-proof' is running locally on port 10001
// This test assumes 'operator' api-external is running locally on port 9000

contract("Operator", (accounts) => {

    async function getEtherBalance(address) {
        let balance = await web3.eth.getBalance(address);
        balance = web3.utils.fromWei(balance, "ether");
        return Number(balance);
    }

    async function initRollupWallet(rollupWallet) {
        const fillTokens = to18(800);
        const fillEth = 100;

        const walletEth = rollupWallet.ethWallet.wallet;

        // Send ether to rollup user
        await web3.eth.sendTransaction({to: walletEth.address, from: owner,
            value: web3.utils.toWei(fillEth.toString(), "ether")});

        // Check ether balance
        const bal = await getEtherBalance(walletEth.address);
        expect(bal).to.be.equal(fillEth);

        // transfer tokens to rollup user
        await insTokenRollup.transfer(walletEth.address, fillTokens.toString(), { from: tokenId });
        // Send approve tx from rollup user
        const tx = {
            from:  walletEth.address, 
            gasLimit: web3.utils.toHex(800000),
            gasPrice: web3.utils.toHex(web3.utils.toWei("10", "gwei")),
            to: insTokenRollup.address, 
            data: insTokenRollup.contract.methods.approve(insRollup.address, fillTokens.toString()).encodeABI()
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
    let cliExternalOp;

    // Url
    const urlExternalOp = "http://127.0.0.1:9000";

    // Constants to move to a specific slot
    const blocksPerSlot = 100;

    // Operator wallet
    const passOp = "passTest";
    let walletOp;

    // Rollup wallets
    const pass = "pass";
    const rollupWallets = [];
    const rollupEncWallets = [];

    // Contract instances
    let insTokenRollup;
    let insRollup;
    let insRollupPoB;
    let pobAddress;

    before(async () => {
        // Load test configuration
        const configTest = JSON.parse(fs.readFileSync(configTestPath));
        // Load TokenRollup
        insTokenRollup = await TokenRollup.at(configTest.tokenAddress);
        // Load Rollup
        insRollup = await Rollup.at(configTest.rollupAddress);
        // Load rollup PoB
        insRollupPoB = await RollupPoB.at(configTest.pobAddress);

        // Load clients
        cliExternalOp = new CliExternalOp(urlExternalOp);

        pobAddress = configTest.pobAddress;
    });

    after(async () => {
        process.exec("find . -depth -type d -name 'tmp-*' -prune -exec rm -rf {} +");
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

        // Init third rollup wallet
        mnemonic = "witness ethics route excite episode differ guide deer into shoulder eternal tone";
        const wallet2 = await Wallet.fromMnemonic(mnemonic);
        rollupWallets.push(wallet2);
        encryptedWallet = await wallet2.toEncryptedJson(pass);
        rollupEncWallets.push(encryptedWallet);
    });

    it("Should get empty operator list", async () => { 
        const res = await cliExternalOp.getOperators();
        const defaultOperator = await insRollupPoB.opDefault();
        let length = 0;
        for (let i = 0; i < res.data.length; i++) {
            if(res.data[i].forger !== defaultOperator.forgerAddress) {
                length++;
            }
        }
        expect(length).to.be.equal(0);
    });

    it("Should load operator wallet", async () => { 
        const walletOpPath = path.join(__dirname, "../../config/wallet-pob-test.json");

        const readOpWallet = fs.readFileSync(walletOpPath, "utf8");
        walletOp = await ethers.Wallet.fromEncryptedJson(readOpWallet, passOp);
    });

    it("Should register operator in 2 slots", async () => {
        const bidValue = await insRollupPoB.MIN_BID();
        const slot = Number( await insRollupPoB.currentSlot()) + 2;

        const tx = {
            from:  walletOp.address,
            to: pobAddress,
            gasLimit: web3.utils.toHex(800000),
            gasPrice: web3.utils.toHex(web3.utils.toWei("10", "gwei")),
            value: web3.utils.toHex(bidValue.toString()),
            data: insRollupPoB.contract.methods.bid(slot, urlExternalOp).encodeABI()
        };
        const txSign = await web3.eth.accounts.signTransaction(tx, walletOp.signingKey.privateKey);
        
        const resRegister = await web3.eth.sendSignedTransaction(txSign.rawTransaction);
        expect(resRegister.status).to.be.equal(true);

    });

    it("Should add two deposits", async () => {
        const token = 0;
        const amountDeposit = to18(350);
        const ethAddress = undefined;

        // account idx = 1
        let resDeposit = await depositTx(web3.currentProvider.host, insRollup.address, amountDeposit.toString(), token, 
            rollupEncWallets[0], pass, ethAddress, Rollup.abi);
        await resDeposit.wait();
        // account idx = 2
        resDeposit = await depositTx(web3.currentProvider.host, insRollup.address, amountDeposit.toString(), token, 
            rollupEncWallets[1], pass, ethAddress, Rollup.abi);
        await resDeposit.wait();
    });

    it("Should get general information", async () => { 
        const res = await cliExternalOp.getState();
        expect(res.data).to.not.be.equal(undefined);

        const blockGenesis = res.data.pobSynch.genesisBlock;
        const currentBlock = res.data.currentBlock;
        await addBlocks(blockGenesis - currentBlock + 1); // move to slot 0
        await timeout(timeoutSynch); // time to synch
    });

    it("Should move to slot 2 and get operator", async () => {
        await addBlocks(blocksPerSlot); // move to slot 1
        await timeout(timeoutBlocks); // wait time to add all blocks
        await addBlocks(blocksPerSlot); // move to slot 2
        await timeout(timeoutBlocks); // wait time to add all blocks

        const res = await cliExternalOp.getOperators();
        const listOperators = res.data;
        let found = false;
        for (const opInfo of Object.values(listOperators)){
            if (opInfo.forger === walletOp.address.toString()){
                found = true;
                break;
            }
        }
        expect(found).to.be.equal(true);
    });

    it("Should forge genesis and on-chain transaction", async () => {
        // Account |  0  |  1  |  2  |
        // Amount  | 350 | 350 | Nan |

        // Check forge batch
        await testUtils.assertForgeBatch(cliExternalOp, 1, timeoutLoop);

        // Check Balances
        await testUtils.assertBalances(cliExternalOp, rollupWallets, [to18(350), to18(350), null]);
    });

    it("Should add off-chain transaction to the pool", async () => {
        // Retrieve operator url
        const res = await cliExternalOp.getOperators();
        const listOperators = res.data;
        const urlOp = listOperators[0].url;
        
        // config transaction
        const tx = {
            coin: 0,
            amount: to18(4),
            nonce: 0,
            fee: Constants.fee["50%"],
        };
        // send transaction with client
        await sendTx(urlOp, rollupEncWallets[1].babyjubWallet.publicCompressed, tx.amount, rollupEncWallets[0],
            pass, tx.coin, tx.fee);
    });

    it("Should forge off-chain transaction", async () => {
        // Account |  0  |  1  |  2  |
        // Amount  | 344 | 354 | Nan |

        const res = await cliExternalOp.getState();
        const lastBatch = res.data.rollupSynch.lastBatchSynched; 

        // Check forge batch
        await testUtils.assertForgeBatch(cliExternalOp, lastBatch + 1, timeoutLoop);

        // Check Balances
        await testUtils.assertBalances(cliExternalOp, rollupWallets, [to18(344), to18(354), null]);
    });

    it("Should add withdraw off-chain transaction to the pool", async () => {
        // Retrieve operator url
        const res = await cliExternalOp.getOperators();
        const listOperators = res.data;
        const urlOp = listOperators[0].url;
        
        // config transaction
        const tx = {
            coin: 0,
            amount: to18(4),
            nonce: 0,
            fee: Constants.fee["50%"],
        };

        // send transaction with client
        await withdrawOffChainTx(urlOp, tx.amount, rollupEncWallets[1],
            pass, tx.coin, tx.fee);
    });
    
    it("Should forge withdraw off-chain transaction", async () => {
        // Account |  0  |  1  |  2  |
        // Amount  | 344 | 348 | Nan |

        const res = await cliExternalOp.getState();
        const lastBatch = res.data.rollupSynch.lastBatchSynched; 

        // Check forge batch
        await testUtils.assertForgeBatch(cliExternalOp, lastBatch + 1, timeoutLoop);

        // Check Balances
        await testUtils.assertBalances(cliExternalOp, rollupWallets, [to18(344), to18(348), null]);
    });

    it("Should add deposit off-chain transaction to the pool", async () => {
        // Retrieve operator url
        const res = await cliExternalOp.getOperators();
        const listOperators = res.data;
        const urlOp = listOperators[0].url;
        
        // config transaction
        const tx = {
            coin: 0,
            amount: to18(300),
            nonce: 0,
            fee: Constants.fee["10%"],
        };

        // send transaction with client
        await sendTx(urlOp, rollupEncWallets[2].babyjubWallet.publicCompressed, tx.amount, rollupEncWallets[1],
            pass, tx.coin, tx.fee, undefined, undefined, rollupWallets[2].ethWallet.wallet.address.toString());
    });

    it("Should forge deposit off-chain transaction", async () => {
        // Account |  0  |  1  |  2  |
        // Amount  | 345 |  18 | 300 |

        const res = await cliExternalOp.getState();
        const lastBatch = res.data.rollupSynch.lastBatchSynched;


        // Check forge batch
        await testUtils.assertForgeBatch(cliExternalOp, lastBatch + 1, timeoutLoop);

        // Check Balances
        // Check Balances
        await testUtils.assertBalances(cliExternalOp, rollupWallets,
            [to18(344), Scalar.fromString("18000000041909515858"), to18(300)]);
    });

    it("Should check exit batches and get its information", async () => {
        const coin = 0;
        const ax = rollupWallets[1].babyjubWallet.publicKey[0].toString(16);
        const ay = rollupWallets[1].babyjubWallet.publicKey[1].toString(16);
        
        const res = await cliExternalOp.getExits(coin, ax, ay);
        expect(res.status).to.be.equal(200);
        const exitsNumBatches = res.data;
        expect(exitsNumBatches.length).to.not.be.equal(0);

        for (const numBatch of exitsNumBatches){
            const res = await cliExternalOp.getExitInfo(coin, ax, ay, numBatch);
            const infoExit = res.data;
            expect(infoExit.found).to.be.equal(true);
            expect(infoExit.state.ax).to.be.equal(ax);
            expect(infoExit.state.ay).to.be.equal(ay);
            expect(infoExit.state.coin).to.be.equal(coin);
        }
    });

    it("Should check fee and tokens added", async () => {
        const tokenId = 0;
        const resTokensList = await cliExternalOp.getTokensList();
        const resFeeTokens = await cliExternalOp.getFeeTokens();
        const smFeeTokens = await insRollup.feeAddToken(); 

        expect(insTokenRollup.address).to.be.equal(resTokensList.data[tokenId]);
        expect(smFeeTokens.toString()).to.be.equal(resFeeTokens.data);
    });

    it("Should retrieve account information", async () => {

        const walletEth0 = rollupWallets[0].ethWallet.wallet;
        const walletEthAddress0 = walletEth0.address.toString();
        const walletAx0 = rollupWallets[0].babyjubWallet.publicKey[0].toString(16);
        const walletAy0 = rollupWallets[0].babyjubWallet.publicKey[1].toString(16);

        const walletEth1 = rollupWallets[1].ethWallet.wallet;
        const walletEthAddress1 = walletEth1.address.toString();
        const walletAx1 = rollupWallets[1].babyjubWallet.publicKey[0].toString(16);
        const walletAy1 = rollupWallets[1].babyjubWallet.publicKey[1].toString(16);

        const walletEth2 = rollupWallets[2].ethWallet.wallet;
        const walletEthAddress2 = walletEth2.address.toString();
        const walletAx2 = rollupWallets[2].babyjubWallet.publicKey[0].toString(16);
        const walletAy2 = rollupWallets[2].babyjubWallet.publicKey[1].toString(16);

        const coin = 0;

        // By Public key Babyjubjub
        let filters;
        let account;

        filters = {
            ax: walletAx0,
            ay: walletAy0,
        };

        const resAxAy0 = await cliExternalOp.getAccounts(filters);
        let listAccounts0 = resAxAy0.data;
        expect(listAccounts0.length).to.be.equal(1);
            
        account = listAccounts0[0];
        expect(account.ax).to.be.equal(walletAx0);
        expect(account.ay).to.be.equal(walletAy0);
        expect(account.ethAddress.toLowerCase()).to.be.equal(walletEthAddress0.toLowerCase());

        filters = {
            ax: walletAx1,
            ay: walletAy1,
        };

        const resAxAy1 = await cliExternalOp.getAccounts(filters);
        let listAccounts1 = resAxAy1.data;
        expect(listAccounts1.length).to.be.equal(1);

        account = listAccounts1[0];
        expect(account.ax).to.be.equal(walletAx1);
        expect(account.ay).to.be.equal(walletAy1);
        expect(account.ethAddress.toLowerCase()).to.be.equal(walletEthAddress1.toLowerCase());

        filters = {
            ax: walletAx2,
            ay: walletAy2,
        };

        const resAxAy2 = await cliExternalOp.getAccounts(filters);
        let listAccounts2 = resAxAy2.data;
        expect(listAccounts2.length).to.be.equal(1);

        account = listAccounts2[0];
        expect(account.ax).to.be.equal(walletAx2);
        expect(account.ay).to.be.equal(walletAy2);
        expect(account.ethAddress.toLowerCase()).to.be.equal(walletEthAddress2.toLowerCase());

        // By Ethereum Address
        filters = {
            ethAddr: walletEthAddress0,
        };

        const resEth0 = await cliExternalOp.getAccounts(filters);
        listAccounts0 = resEth0.data;
        expect(listAccounts0.length).to.be.equal(1);

        account = listAccounts0[0];
        expect(account.ax).to.be.equal(walletAx0);
        expect(account.ay).to.be.equal(walletAy0);
        expect(account.ethAddress.toLowerCase()).to.be.equal(walletEthAddress0.toLowerCase());

        filters = {
            ethAddr: walletEthAddress1,
        };

        const resEth1 = await cliExternalOp.getAccounts(filters);
        listAccounts1 = resEth1.data;
        expect(listAccounts1.length).to.be.equal(1);

        account = listAccounts1[0];
        expect(account.ax).to.be.equal(walletAx1);
        expect(account.ay).to.be.equal(walletAy1);
        expect(account.ethAddress.toLowerCase()).to.be.equal(walletEthAddress1.toLowerCase());

        filters = {
            ethAddr: walletEthAddress2,
        };

        const resEth2 = await cliExternalOp.getAccounts(filters);
        listAccounts2 = resEth2.data;
        expect(listAccounts2.length).to.be.equal(1);

        account = listAccounts2[0];
        expect(account.ax).to.be.equal(walletAx2);
        expect(account.ay).to.be.equal(walletAy2);
        expect(account.ethAddress.toLowerCase()).to.be.equal(walletEthAddress2.toLowerCase());

        // By both Public key Babyjubjub and Ethereum Address
        filters = {
            ax: walletAx0,
            ay: walletAy0,
            ethAddr: walletEthAddress0,
        };

        const res0 = await cliExternalOp.getAccounts(filters);
        listAccounts0 = res0.data;
        expect(listAccounts0.length).to.be.equal(1);

        account = listAccounts0[0];
        expect(account.ax).to.be.equal(walletAx0);
        expect(account.ay).to.be.equal(walletAy0);
        expect(account.ethAddress.toLowerCase()).to.be.equal(walletEthAddress0.toLowerCase());

        filters = {
            ax: walletAx0,
            ay: walletAy0,
            ethAddr: walletEthAddress1,
        };

        try {
            await cliExternalOp.getAccounts(filters);
            expect(true).to.be.equal(false);
        } catch (error) {
            expect(error.response.status).to.be.equal(404);
            expect(error.response.data).to.be.equal("Accounts not found");
        }

        // By rollup address (babyjubjub compressed)
        const resState = await cliExternalOp.getStateAccount(0, walletAx0, walletAy0);
        const state = resState.data;

        const rollupAddress = state.rollupAddress;

        const resStateB = await cliExternalOp.getStateAccountByAddress(coin, rollupAddress);
        const stateB = resStateB.data;
        
        const resStateC = await cliExternalOp.getAccountsByAddress(rollupAddress);
        const stateC = resStateC.data[0];

        expect(state.coin).to.be.equal(stateB.coin);
        expect(stateB.coin).to.be.equal(stateC.coin);

        expect(state.nonce).to.be.equal(stateB.nonce);
        expect(stateB.nonce).to.be.equal(stateC.nonce);

        expect(state.amount).to.be.equal(stateB.amount);
        expect(stateB.amount).to.be.equal(stateC.amount);

        expect(state.ax).to.be.equal(stateB.ax);
        expect(stateB.ax).to.be.equal(stateC.ax);

        expect(state.ay).to.be.equal(stateB.ay);
        expect(stateB.ay).to.be.equal(stateC.ay);

        expect(state.ethAddress).to.be.equal(stateB.ethAddress);
        expect(stateB.ethAddress).to.be.equal(stateC.ethAddress);

        expect(state.idx).to.be.equal(stateB.idx);
        expect(stateB.idx).to.be.equal(stateC.idx);

        expect(state.rollupAddress).to.be.equal(stateB.rollupAddress);
        expect(stateB.rollupAddress).to.be.equal(stateC.rollupAddress);
    });

    it("Should check batch transactions", async () => {
        // Wait to synchronize all batches
        let res = await cliExternalOp.getState();
        let isSynched = res.data.rollupSynch.isSynched;
        while (!isSynched){
            await timeout(timeoutLoop);
            const res = await cliExternalOp.getState();
            isSynched = res.data.rollupSynch.isSynched;
        }
        
        // find transactions on batches
        res = await cliExternalOp.getState();
        const currentNumBatch = res.data.rollupSynch.lastBatchSynched;
        for (let i = 0; i < currentNumBatch + 1; i++){
            try {
                const res = await cliExternalOp.getBatchTx(i);
                expect(i).to.be.above(0);
                expect(res.data).to.not.be.equal(undefined);
            } catch (error){
                expect(error.response.status).to.be.equal(404);
                expect(error.response.data).to.be.equal("Batch not found");
            }
        }
    });
    
});