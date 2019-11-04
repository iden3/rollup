/* eslint-disable no-console */
const chai = require('chai');

const { expect } = chai;
const { createCodeError } = require('./walletsSend');

// Create code errors randomly, this test just comprobes that the probabilities are the good ones.
describe('Create properly the code errors', () => {
    let counter0 = 0;
    let counter1 = 0;
    let counter2 = 0;
    let counter3 = 0;
    let counter4 = 0;
    let counter5 = 0;
    let counter6 = 0;
    let counter7 = 0;
    let counter8 = 0;
    let counter9 = 0;
    let counter10 = 0;
    let counter11 = 0;
    const iterations = 100000;

    it('Should create error codes', async () => {
        for (let i = 0; i < iterations; i++) {
            switch (createCodeError()) {
            case 0:
                counter0 += 1;
                break;
            case 1:
                counter1 += 1;
                break;
            case 2:
                counter2 += 1;
                break;
            case 3:
                counter3 += 1;
                break;
            case 4:
                counter4 += 1;
                break;
            case 5:
                counter5 += 1;
                break;
            case 6:
                counter6 += 1;
                break;
            case 7:
                counter7 += 1;
                break;
            case 8:
                counter8 += 1;
                break;
            case 9:
                counter9 += 1;
                break;
            case 10:
                counter10 += 1;
                break;
            case 11:
                counter11 += 1;
                break;
            default:
                throw Error('unexpected error Code');
            }
        }
        expect(counter0 / iterations).to.be.at.least(0.4); // should be 0.45
        expect(counter1 / iterations).to.be.at.least(0.04);// should be 0.05
        expect(counter2 / iterations).to.be.at.least(0.04);
        expect(counter3 / iterations).to.be.at.least(0.04);
        expect(counter4 / iterations).to.be.at.least(0.04);
        expect(counter5 / iterations).to.be.at.least(0.04);
        expect(counter6 / iterations).to.be.at.least(0.04);
        expect(counter7 / iterations).to.be.at.least(0.04);
        expect(counter8 / iterations).to.be.at.least(0.04);
        expect(counter9 / iterations).to.be.at.least(0.04);
        expect(counter10 / iterations).to.be.at.least(0.04);
        expect(counter11 / iterations).to.be.at.least(0.04);
    });
});
