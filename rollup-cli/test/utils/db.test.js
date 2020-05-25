const chai = require('chai');
const Db = require('../../src/utils/db');

const { expect } = chai;

describe('[memory database]', () => {
    let dataBase;

    it('Check databse key - values', () => {
        dataBase = new Db();
        for (let i = 0; i < 10; i++) {
            const key = `key-${i}`;
            const value = `value-${i}`;
            dataBase.insert(key, value);
        }

        for (let i = 0; i < 10; i++) {
            const key = `key-${i}`;
            const value = dataBase.get(key);
            expect(value).to.be.equal(`value-${i}`);
        }
    });

    it('export and import database', () => {
        const dbObj = dataBase.exportObj();

        const newdB = Db.newFromObj(dbObj);
        for (let i = 0; i < 10; i++) {
            const key = `key-${i}`;
            const valueOld = dataBase.get(key);
            const valueNew = newdB.get(key);
            expect(valueOld).to.be.equal(valueNew);
        }
    });

    it('Clear single key', () => {
        const singleKey = 'key-3';
        dataBase.delete(singleKey);
        const value = dataBase.get(singleKey);
        expect(value).to.be.equal(null);
    });

    it('Clear full database', () => {
        dataBase.deleteAll();
        for (let i = 0; i < 10; i++) {
            const key = `key-${i}`;
            const value = dataBase.get(key);
            expect(value).to.be.equal(null);
        }
    });
});
