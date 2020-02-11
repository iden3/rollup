/*global BigInt*/
const Web3 = require("web3");

class OperatorManager {
    constructor(nodeUrl, contractAddress, abi, wallet, gasMul, gasLimit){
        this.wallet = wallet;
        this.nodeUrl = nodeUrl;
        this.posAddress = contractAddress;
        this.web3 = new Web3(new Web3.providers.HttpProvider(this.nodeUrl));
        this.rollupPoS = new this.web3.eth.Contract(abi, this.posAddress);
        this.gasMul = BigInt(gasMul);
        // Default is described in:
        // https://iden3.io/post/istanbul-zkrollup-ethereum-throughput-limits-analysis
        this.gasLimit = (gasLimit === "default") ? (2 * 616240): gasLimit;
    }

    async _getGasPrice(){
        const strAvgGas = await this.web3.eth.getGasPrice();
        const avgGas = BigInt(strAvgGas);
        return (avgGas * this.gasMul).toString();
    }

    async getTxRegister(rndHash, stakeValue, url) {
        const tx = {
            from:  this.wallet.address,
            to: this.posAddress,
            gasLimit: this.gasLimit,
            gasPrice: await this._getGasPrice(),
            value: this.web3.utils.toHex(this.web3.utils.toWei(stakeValue.toString(), "ether")),
            data: this.rollupPoS.methods.addOperator(rndHash, url).encodeABI()
        };
        return await this.signTransaction(tx);
    }

    async getTxUnregister(opId) {
        const tx = {
            from:  this.wallet.address,
            to: this.posAddress,
            gasLimit: this.gasLimit,
            gasPrice: await this._getGasPrice(),
            data: this.rollupPoS.methods.removeOperator(opId.toString()).encodeABI()
        };
        return await this.signTransaction(tx);
    }

    async getTxWithdraw(opId) {
        const tx = {
            from:  this.wallet.address,
            to: this.posAddress,
            gasLimit: this.gasLimit,
            gasPrice: await this._getGasPrice(),
            data: this.rollupPoS.methods.withdraw(opId.toString()).encodeABI()
        };
        return await this.signTransaction(tx);
    }


    async getTxCommit(prevHash, compressedTx) {
        const tx = {
            from:  this.wallet.address,
            to: this.posAddress,
            gasLimit: this.gasLimit,
            gasPrice: await this._getGasPrice(),
            data: this.rollupPoS.methods.commitBatch(prevHash, compressedTx).encodeABI()
        };
        return await this.signTransaction(tx);
    }

    async getTxForge(proofA, proofB, proofC, input) {
        const tx = {
            from:  this.wallet.address,
            to: this.posAddress,
            gasLimit: this.gasLimit,
            gasPrice: await this._getGasPrice(),
            data: this.rollupPoS.methods.forgeCommittedBatch(proofA, proofB, proofC, input).encodeABI()
        };
        return await this.signTransaction(tx);
    }

    async getTxCommitAndForge(prevHash, compressedTx, proofA, proofB, proofC, input) {
        const tx = {
            from:  this.wallet.address,
            to: this.posAddress,
            gasLimit: this.gasLimit,
            gasPrice: await this._getGasPrice(),
            data: this.rollupPoS.methods.commitAndForge(prevHash, compressedTx, 
                proofA, proofB, proofC, input).encodeABI()
        };
        const txSign = await this.signTransaction(tx);
        return [txSign, tx];
    }
    
    async signTransaction(tx) {
        return await this.web3.eth.accounts.signTransaction(tx, this.wallet.privateKey);
    }
}

module.exports = OperatorManager;