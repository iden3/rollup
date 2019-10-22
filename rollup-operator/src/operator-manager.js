const Web3 = require("web3");

class OperatorManager {
    constructor(nodeUrl, contractAddress, abi){
        this.wallet = undefined;
        this.nodeUrl = nodeUrl;
        this.posAddress = contractAddress;
        this.web3 = new Web3(new Web3.providers.HttpProvider(this.nodeUrl));
        this.rollupPoS = new this.web3.eth.Contract(abi, this.posAddress);
        this.gasLimit = 5000000;
    }

    async loadWallet(wallet) {
        this.wallet = wallet;
    }

    async register(rndHash, stakeValue, url) {
        if (this.wallet == undefined) throw new Error("No wallet has been loaded");
        const tx = {
            from:  this.wallet.address,
            to: this.posAddress,
            gasLimit: this.gasLimit,
            value: this.web3.utils.toHex(this.web3.utils.toWei(stakeValue.toString(), "ether")),
            data: this.rollupPoS.methods.addOperator(rndHash, url).encodeABI()
        };
        const txSign = await this.web3.eth.accounts.signTransaction(tx, this.wallet.privateKey);
        return await this.web3.eth.sendSignedTransaction(txSign.rawTransaction);
    }

    async unregister(opId) {
        if (this.wallet == undefined) throw new Error("No wallet has been loaded");
        const tx = {
            from:  this.wallet.address,
            to: this.posAddress,
            gasLimit: this.gasLimit,
            data: this.rollupPoS.methods.removeOperator(opId.toString()).encodeABI()
        };
        const txSign = await this.web3.eth.accounts.signTransaction(tx, this.wallet.privateKey);
        return await this.web3.eth.sendSignedTransaction(txSign.rawTransaction);
    }

    async withdraw(opId) {
        if (this.wallet == undefined) throw new Error("No wallet has been loaded");
        const tx = {
            from:  this.wallet.address,
            to: this.posAddress,
            gasLimit: this.gasLimit,
            data: this.rollupPoS.methods.withdraw(opId.toString()).encodeABI()
        };
        const txSign = await this.web3.eth.accounts.signTransaction(tx, this.wallet.privateKey);
        return await this.web3.eth.sendSignedTransaction(txSign.rawTransaction);
    }

    async commit(prevHash, compressedTx) {
        if (this.wallet == undefined) throw new Error("No wallet has been loaded");
        const tx = {
            from:  this.wallet.address,
            to: this.posAddress,
            gasLimit: this.gasLimit,
            data: this.rollupPoS.methods.commitBatch(prevHash, compressedTx).encodeABI()
        };
        const txSign = await this.web3.eth.accounts.signTransaction(tx, this.wallet.privateKey);
        return await this.web3.eth.sendSignedTransaction(txSign.rawTransaction);
    }

    async forge(proofA, proofB, proofC, input) {
        if (this.wallet == undefined) throw new Error("No wallet has been loaded");
        const tx = {
            from:  this.wallet.address,
            to: this.posAddress,
            gasLimit: this.gasLimit,
            data: this.rollupPoS.methods.forgeCommittedBatch(proofA, proofB, proofC, input).encodeABI()
        };
        const txSign = await this.web3.eth.accounts.signTransaction(tx, this.wallet.privateKey);
        return await this.web3.eth.sendSignedTransaction(txSign.rawTransaction);
    }

    async commitAndForge(prevHash, compressedTx, proofA, proofB, proofC, input) {
        if (this.wallet == undefined) throw new Error("No wallet has been loaded");
        const tx = {
            from:  this.wallet.address,
            to: this.posAddress,
            gasLimit: this.gasLimit,
            data: this.rollupPoS.methods.commitAndForge(prevHash, compressedTx, 
                proofA, proofB, proofC, input).encodeABI()
        };
        const txSign = await this.web3.eth.accounts.signTransaction(tx, this.wallet.privateKey);
        return await this.web3.eth.sendSignedTransaction(txSign.rawTransaction);
    }
}

module.exports = OperatorManager;