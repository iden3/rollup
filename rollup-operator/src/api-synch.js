const axios = require("axios");

class SynchServer {

    constructor(url) {
        this.url = url;
    }

    getInfoById(id) {
        return axios.get(`${this.url}/info/${id}`);
    }

    /**
     * Get user information from 
     * @param {String} AxAy Public key into a string coded as [Ax,Ay] 
     */
    getInfoByAxAy(AxAy) {
        return axios.get(`${this.url}/info/${AxAy}`);
    }
	
    getState() {
        return axios.get(`${this.url}/state`);
    }

    sendTx(tx) {
        return axios.post(`${this.url}/offchain/send`,{tx});
    }
}

module.exports = SynchServer;
