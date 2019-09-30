const ethers = require("ethers");
const Web3 = require("web3");
const fs = require("fs");
const { timeout } = require("../src/utils");

// globsal vars
const TIMEOUT_ERROR = 5000;
const TIMEOUT_NEXT_LOOP = 5000;



class OperatorManager {
    constructor(nodeUrl, contractAddress, abi){
        this.wallet = undefined;
        this.opId = undefined;
        this.flagForge = false;
        this.nodeUrl = nodeUrl;
        this.posAddress = contractAddress;
        this.web3 = new Web3(new Web3.providers.HttpProvider(this.nodeUrl));
        this.rollupPoS = new this.web3.eth.Contract(abi, this.posAddress);
    }

    async loadWallet(walletPath, pass) {
        const walletJson = JSON.parse(fs.readFileSync(walletPath));
        this.wallet = await ethers.Wallet.fromEncryptedJson(walletJson, pass);
    }

    async register(rndHash, stakeValue) {
        if (this.wallet == undefined) throw new Error("No wallet has been loaded");    
        const tx = {
            from:  this.wallet.address,
            to: this.rollupPoS.address,
            value: this.web3.utils.toHex(this.web3.utils.toWei(stakeValue.toString(), "ether")),
            data: this.rollupPoS.methods.addOperator(rndHash).encodeABI()
        };
        const txSign = await this.web3.eth.accounts.signTransaction(tx, this.wallet.privateKey);
        this.idOp = await this.web3.eth.sendSignedTransaction(txSign.rawTransaction);
    }

    async unregister() {
        if (this.opId == undefined) throw new Error("Operator not registered");
        const tx = {
            from:  this.wallet.address,
            to: this.rollupPoS.address,
            data: this.rollupPoS.methods.removeOperator().encodeABI()
        };
        const txSign = await this.web3.eth.accounts.signTransaction(tx, this.wallet.privateKey);
        await this.web3.eth.sendSignedTransaction(txSign.rawTransaction);
    }

    async withdraw() {
        if (this.opId == undefined) throw new Error("Operator not registered");
        const tx = {
            from:  this.wallet.address,
            to: this.rollupPoS.address,
            data: this.rollupPoS.methods.withdraw(this.opId).encodeABI()
        };
        const txSign = await this.web3.eth.accounts.signTransaction(tx, this.wallet.privateKey);
        await this.web3.eth.sendSignedTransaction(txSign.rawTransaction);
    }

    async commit(prevHash, compressedTx) {
        if (this.opId == undefined) throw new Error("Operator not registered");
        const tx = {
            from:  this.wallet.address,
            to: this.rollupPoS.address,
            data: this.rollupPoS.methods.commitBatch(prevHash, compressedTx).encodeABI()
        };
        const txSign = await this.web3.eth.accounts.signTransaction(tx, this.wallet.privateKey);
        await this.web3.eth.sendSignedTransaction(txSign.rawTransaction);
    }

    async forge(proofA, proofB, proofC, input) {
        if (this.opId == undefined) throw new Error("Operator not registered");
        const tx = {
            from:  this.wallet.address,
            to: this.rollupPoS.address,
            data: this.rollupPoS.methods.forgeCommittedBatch(proofA, proofB, proofC, input).encodeABI()
        };
        const txSign = await this.web3.eth.accounts.signTransaction(tx, this.wallet.privateKey);
        await this.web3.eth.sendSignedTransaction(txSign.rawTransaction);
    }

    async getRaffleWinner(numSlot){
        const winner = await this.rollupPoS.methods.getRaffleWinner(numSlot)
            .call({from: this.wallet.address});
        return winner;
    }

    async isOpRegister(){
        if (this.idOp) {
            return true;
        }
        return false;
    }

    async opManagerLoop() {
        // eslint-disable-next-line no-constant-condition
        while(true) {
            try {
                if( this.idOp ) {
                    const currentSlot = await this.rollupPoS.methods.currentSlot()
                        .call({from: this.wallet.address});
                
                    const winner = await this.getRaffleWinner(currentSlot);
                    if (winner == this.idOp){
                        this.flagForge = true;
                    }
                }
                await timeout(TIMEOUT_NEXT_LOOP);
            } catch(e) {
                console.error(`Message error: ${e.message}`);
                console.error(`Error in loop: ${e.stack}`);
                await timeout(TIMEOUT_ERROR);
            }
        }
    }
}

module.exports = OperatorManager;