//import { describe, it } from 'mocha';

const axios = require("axios");
const chai = require('chai');
const { expect } = chai;

describe('test client post', () => {
    it('send post', async () => {
        let tx = {
            from: "0x63F6B50a2cbAbA54Ec6426065223B652b8b39133",
            to: "0xc81b6E645D1799d5Ea248ecC9C22c8B6535f690d",
            amount: 10000 
        }
        const ret = await axios.post('http://localhost:9000/offchain/send', tx);
        expect(ret.status).to.be.equal(200);
    });
});