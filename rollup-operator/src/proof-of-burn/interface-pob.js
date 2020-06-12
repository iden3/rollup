const Web3 = require("web3");
const Scalar = require("ffjavascript").Scalar;

/**
 * Interface to interact with rollup PoB contract
 */
class InterfacePoB {
    /**
     * Initilize operator manager
     * @param {String} nodeUrl - ethereum node url 
     * @param {String} contractAddress - Rollup PoB address
     * @param {Object} abi - Rollup PoB interface
     * @param {Object} wallet - wallet to sign transactions
     * @param {Number} gasMul - gas multiplier
     * @param {Number} gasLimit - gas limit
     */
    constructor(nodeUrl, contractAddress, abi, wallet, gasMul, gasLimit){
        this.wallet = wallet;
        this.nodeUrl = nodeUrl;
        this.pobAddress = contractAddress;
        this.web3 = new Web3(new Web3.providers.HttpProvider(this.nodeUrl));
        this.rollupPoB = new this.web3.eth.Contract(abi, this.pobAddress);
        this.gasMul = Scalar.e(gasMul);
        this.gasLimit = (gasLimit === "default") ? (0): gasLimit;
    }

    /**
     * Get gas price to use when sending a transaction
     * @returns {String} - BigInt encoded as string
     */
    async _getGasPrice(){
        const strAvgGas = await this.web3.eth.getGasPrice();
        const avgGas = Scalar.e(strAvgGas);
        return Scalar.mul(avgGas, this.gasMul).toString();
    }

    /**
     * Add bid to Rollup PoB
     * @param {Number} slot - slot 
     * @param {Number} bidValue - value to bid measured in ether
     * @returns {Object} - transaction signed
     */
    async getTxBid(slot, url, bidValue) {
        const tx = {
            from:  this.wallet.address,
            to: this.pobAddress,
            gasPrice: await this._getGasPrice(),
            value: this.web3.utils.toHex(this.web3.utils.toWei(bidValue.toFixed(18), "ether")),
            data: this.rollupPoB.methods.bid(slot, url).encodeABI()
        };
        const txSign = await this.signTransaction(tx);
        return [txSign, tx];
    }

    /**
     * Add bid to Rollup PoB
     * @param {Number} slot - slot 
     * @param {Number} bidValue - value to bid measured in ether
     * @param {String} beneficiaryAddress - beneficiary Address
     * @returns {Object} - transaction signed
     */
    async getTxBidWithDifferentBeneficiary(slot, url, bidValue, beneficiaryAddress) {
        const tx = {
            from:  this.wallet.address,
            to: this.pobAddress,
            gasPrice: await this._getGasPrice(),
            value: this.web3.utils.toHex(this.web3.utils.toWei(bidValue.toFixed(18), "ether")),
            data: this.rollupPoB.methods.bidWithDifferentBeneficiary(slot, url, beneficiaryAddress).encodeABI()
        };
        const txSign = await this.signTransaction(tx);
        return [txSign, tx];
    }

    /**
     * Add bid to Rollup PoB
     * @param {Number} slot - slot 
     * @param {Number} bidValue - value to bid measured in ether
     * @param {String} beneficiaryAddress - beneficiary Address
     * @param {String} forgerAddress - forger Address
     * @returns {Object} - transaction signed
     */
    async getTxBidRelay(slot, url, bidValue, beneficiaryAddress, forgerAddress) {
        const tx = {
            from:  this.wallet.address,
            to: this.pobAddress,
            gasPrice: await this._getGasPrice(),
            value: this.web3.utils.toHex(this.web3.utils.toWei(bidValue.toFixed(18), "ether")),
            data: this.rollupPoB.methods.bidRelay(slot, url, beneficiaryAddress, forgerAddress).encodeABI()
        };
        const txSign = await this.signTransaction(tx);
        return [txSign, tx];
    }

    /**
     * Add bid to Rollup PoB
     * @param {Number} slot - slot 
     * @param {Number} bidValue - value to bid measured in ether
     * @param {String} beneficiaryAddress - beneficiary Address
     * @param {String} forgerAddress - forger Address
     * @param {String} withdrawAddress - withdraw Address
     * @returns {Object} - transaction signed
     */
    async getTxBidRelayAndWithdrawAddress(slot, url, bidValue, beneficiaryAddress, forgerAddress, withdrawAddress) {
        const tx = {
            from:  this.wallet.address,
            to: this.pobAddress,
            gasPrice: await this._getGasPrice(),
            value: this.web3.utils.toHex(this.web3.utils.toWei(bidValue.toFixed(18), "ether")),
            data: this.rollupPoB.methods.bidRelayAndWithdrawAddress(slot, url, beneficiaryAddress, forgerAddress, withdrawAddress).encodeABI()
        };
        const txSign = await this.signTransaction(tx);
        return [txSign, tx];
    }

    /**
     * Add bid to Rollup PoB
     * @param {Number} slot - slot 
     * @param {Number} bidValue - value to bid measured in ether
     * @param {String} beneficiaryAddress - beneficiary Address
     * @param {String} forgerAddress - forger Address
     * @param {String} withdrawAddress - withdraw Address
     * @param {String} bonusAddress - bonus Address
     * @param {Boolean} useBonus - use the bonus or not
     * @returns {Object} - transaction signed
     */
    async getTxBidWithDifferentAddresses(slot, url, bidValue, beneficiaryAddress, forgerAddress, withdrawAddress, bonusAddress, useBonus) {
        const tx = {
            from:  this.wallet.address,
            to: this.pobAddress,
            gasPrice: await this._getGasPrice(),
            value: this.web3.utils.toHex(this.web3.utils.toWei(bidValue.toFixed(18), "ether")),
            data: this.rollupPoB.methods.bidWithDifferentAddresses(slot, url, beneficiaryAddress, forgerAddress, withdrawAddress, bonusAddress, useBonus).encodeABI()
        };
        const txSign = await this.signTransaction(tx);
        return [txSign, tx];
    }

    /**
     * Withdraw amount bid already outbid from Rollup PoB
     * @returns {Object} - signed transaction 
     */
    async getTxWithdraw() {
        const tx = {
            from:  this.wallet.address,
            to: this.pobAddress,
            gasPrice: await this._getGasPrice(),
            data: this.rollupPoB.methods.withdraw().encodeABI()
        };
        return await this.signTransaction(tx);
    }

    /**
     * Commit and forge data
     * @param {String} compressedTx - off-chain data transactions
     * @param {Array} proofA - zkSnark proof 
     * @param {Array} proofB - zkSnark proof
     * @param {Array} proofC - zkSnark proof
     * @param {Array} input - zkSnark public inputs
     * @param {String} compressedOnChainTx - deposit off-chain deposits compressed data
     * @param {Number} value - value payed on transaction in ether
     * @returns {Object} - signed transactiontthis.gasMulhis.gasMul
     */
    async getTxCommitAndForge(compressedTx, proofA, proofB, proofC, input,
        compressedOnChainTx, value) {
        const tx = {
            from:  this.wallet.address,
            to: this.pobAddress,
            gasPrice: await this._getGasPrice(),
            value: this.web3.utils.toHex(this.web3.utils.toWei(value.toFixed(18), "ether")), // js don't express decimals with full accuracy.
            data: this.rollupPoB.methods.commitAndForge(compressedTx, 
                proofA, proofB, proofC, input, compressedOnChainTx).encodeABI()
        };
        const txSign = await this.signTransaction(tx);
        return [txSign, tx];
    }

    /**
     * Commit and forge data
     * @param {String} compressedTx - off-chain data transactions
     * @param {Array} proofA - zkSnark proof 
     * @param {Array} proofB - zkSnark proof
     * @param {Array} proofC - zkSnark proof
     * @param {Array} input - zkSnark public inputs
     * @param {String} compressedOnChainTx - deposit off-chain deposits compressed data
     * @param {Number} value - value payed on transaction in ether
     * @returns {Object} - signed transactiontthis.gasMulhis.gasMul
     */
    async getTxCommitAndForgeDeadline(compressedTx, proofA, proofB, proofC, input,
        compressedOnChainTx, value) {
        const tx = {
            from:  this.wallet.address,
            to: this.pobAddress,
            gasPrice: await this._getGasPrice(),
            value: this.web3.utils.toHex(this.web3.utils.toWei(value.toFixed(18), "ether")),
            data: this.rollupPoB.methods.commitAndForgeDeadline(compressedTx, 
                proofA, proofB, proofC, input, compressedOnChainTx).encodeABI()
        };
        const txSign = await this.signTransaction(tx);
        return [txSign, tx];
    }
    
    /**
 * Sign ethereum transaction
 * @param {Object} tx - Raw ethreum transaction
 * @returns {Objject} - signed transaction 
 */
    async signTransaction(tx) {
        let resGasLimit;
        if (this.gasLimit === 0){
            try {
                const gasEstimated = await this.web3.eth.estimateGas(tx);
                // add a +30% for safety
                resGasLimit = Math.floor(gasEstimated*1.3);
            } catch (error){
                return { error: error.message };
            }
        } else {
            resGasLimit = this.gasLimit;
        }
        Object.assign(tx, {gasLimit: resGasLimit});
        return await this.web3.eth.accounts.signTransaction(tx, this.wallet.privateKey);
    }
}

module.exports = InterfacePoB;