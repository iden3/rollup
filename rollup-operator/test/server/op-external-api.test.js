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
const { BabyJubWallet } = require("../../../rollup-utils/babyjub-wallet");
const { timeout } = require("../../src/utils");
const configTestPath = path.join(__dirname, "../config/test.json");

const CliAdminOp = require("../../src/cli-admin-operator");
const CliExternalOp = require("../../src/cli-external-operator");
const { Wallet } = require("../../../rollup-cli/src/wallet");
const cliDeposit = require("../../../rollup-cli/src/actions/onchain/deposit");

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
    let insRollupPoS;

    before(async () => {
        // Load test configuration
        const configTest = JSON.parse(fs.readFileSync(configTestPath));
        // Load TokenRollup
        insTokenRollup = await TokenRollup.at(configTest.tokenAddress);
        // Load Rollup
        insRollup = await Rollup.at(configTest.rollupAddress);
        // Load rollup PoS
        insRollupPoS = await RollupPoS.at(configTest.posAddress);

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

        // load client wallet
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

    it("Should do a deposit", async () => {
        const tokenId = 0;
        const amountDeposit = 10;
        let resDeposit= await cliDeposit.deposit(web3.currentProvider.host, insRollup.address, amountDeposit, tokenId, 
            encryptedWallet, pass, Rollup.abi);

        await resDeposit.wait();
    });

    it("Should get general information", async () => { 
        const res = await cliExternalOp.getGeneralInfo();
        expect(res.data).to.not.be.equal(undefined);

        const blockGenesis = res.data.posSynch.genesisBlock;
        const currentBlock = res.data.currentBlock;
        await addBlocks(blockGenesis - currentBlock + 1); // move to era 0
        await timeout(20000); // time to synch
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
        await timeout(5000); // wait time to add all blocks
        await addBlocks(blockPerEra); // move to era 2
        await timeout(5000); // wait time to add all blocks
    });

    it("Should forge genesis and deposit", async () => {
        let batchForged = false;
        let counter = 0;
        while(!batchForged && counter < 10) {
            const res = await cliExternalOp.getGeneralInfo();
            const info = res.data;
            if (info.rollupSynch.lastBatchSynched > 1) {
                batchForged = true;
                break;
            } 
            await timeout(10000);
            counter += 1;
        }
        expect(batchForged).to.be.equal(true);
    });


    it("Should retrieve leaf information by Id", async () => { 
        const idBalanceTree = 0;
        const res = await cliExternalOp.getInfoByIdx(idBalanceTree);
    });

    // it("Should retrieve leaf information by Ax, Ay", async () => { 
        
    // });

    // it("Should retrieve leaf information by EthAddress", async () => { 
        
    // });
});