const axios = require("axios");
const { stringifyBigInts } = require("ffjavascript").utils;

/**
 * Client to interact with operator API
 */
class CliExternalOperator {

    /**
     * Initilaize client
     * @param {String} url - operator url 
     */
    constructor(url) {
        this.url = url;
    }

    /**
     * Get account state
     * @param {Number} coin - coin identifier
     * @param {String} ax - Public X coordinate reprsented as an hex string
     * @param {String} ay - Public Y coordinate reprsented as an hex string
     * @returns {Object} - http response 
     */
    getStateAccount(coin, ax, ay) {
        return axios.get(`${this.url}/accounts/${ax}/${ay}/${coin}`);
    }

    /**
     * Get array of accounts depending on filters provided
     * @param {Object} filters
     * @returns {Object} - http response 
     */
    getAccounts(filters) {
        const axParam = filters.ax ? `ax=${filters.ax}&` : ""; 
        const ayParam = filters.ay ? `ay=${filters.ay}&` : "";
        const ethAddrParam = filters.ethAddr ? `ethAddr=${filters.ethAddr}&` : "";

        let urlParams = "?".concat(axParam, ayParam, ethAddrParam);
        urlParams = urlParams.substring(0, urlParams.length - 1);
        
        return axios.get(`${this.url}/accounts${urlParams}`);
    }

    /**
     * Get general operator status
     * @returns {Object} - http response
     */
    getState() {
        return axios.get(`${this.url}/state`);
    }

    /**
     * Get list of active operators
     * @returns {Object} - http response
     */
    getOperators() {
        return axios.get(`${this.url}/operators`);
    }

    /**
     * Get exit information for a rollup account
     * Useful to make a withdraw afterwards
     * @param {Number} coin - coin identifier
     * @param {String} ax - Public X coordinate reprsented as an hex string
     * @param {String} ay - Public Y coordinate reprsented as an hex string
     * @param {Number} numBatch - rollup batch number
     * @returns {Object} - http response
     */
    getExitInfo(coin, ax, ay, numBatch) {
        return axios.get(`${this.url}/exits/${ax}/${ay}/${coin}/${numBatch}`);
    }

    /**
     * Get array of batch numbers where rollup identifier
     * has performed a withdraw from rollup
     * @param {Number} coin - coin identifier
     * @param {String} ax - Public X coordinate reprsented as an hex string
     * @param {String} ay - Public Y coordinate reprsented as an hex string
     * @returns {Object} - http response
     */
    getExits(coin, ax, ay) {
        return axios.get(`${this.url}/exits/${ax}/${ay}/${coin}`);
    }

    /**
     * Get all tokens listed on Rollup
     * @returns {Object} - http response
     */
    getTokensList() {
        return axios.get(`${this.url}/tokens`);
    }

    /**
     * Get current fee to add a token into rollup
     * @returns {Object} - http response
     */
    getFeeTokens() {
        return axios.get(`${this.url}/feetokens`);
    }

    /**
     * Get transactions in an specific batch
     * - provide hash to retrieve off-chain transactions
     * - provide all on-chain transactions
     * - provide timestamp whwre the batch has been synchronized
     * @param {Number} - batch depth
     * @returns {Object} - http response
     */
    getBatchTx(batchId) {
        return axios.get(`${this.url}/batch/${batchId}`);
    }

    /**
     * Send off-chain transaction to the operator
     * @param {Object} tx - rollup transaction
     * @returns {Object} - http response 
     */
    sendTx(tx) {
        return axios.post(`${this.url}/pool`, stringifyBigInts(tx));
    }
}

module.exports = CliExternalOperator;
