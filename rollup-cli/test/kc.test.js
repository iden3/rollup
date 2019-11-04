const chai = require('chai');
const Db = require('../src/db');
const KeyContainer = require('../src/kc');

const { expect } = chai;

describe('[key-container] Test single functions', () => {
    let dataBase;
    let keyContainer;

    before('Create key container with database', () => {
        dataBase = new Db();
        keyContainer = new KeyContainer(dataBase);
    });

    after('lock', () => {
        keyContainer.lock();
    });

    it('Key container unocked', () => {
        keyContainer.deleteAll();
        const mnemonic = 'enjoy alter satoshi squirrel special spend crop link race rally two eye';
        expect(() => { keyContainer.setMasterSeed(mnemonic); }).to.throw('Key Container is locked');
    });

    it('Delete all functionality', () => {
        const PrivKey1 = '0x53c2e48632c87932663beff7a1f6deb692cc61b041262ae8f310203d0f5ff578';

        dataBase.insert('key0', 'value0');
        keyContainer.unlock('pass');
        const keysAdded = keyContainer.importKey(PrivKey1);

        // Check all keys are in database
        expect(dataBase.get('key0')).to.be.not.equal(null);
        expect(dataBase.get(`kc/eth-addr/${keysAdded.address}`)).to.be.not.equal(null);
        expect(dataBase.get(`kc/eth-pk/${keysAdded.publicKey}`)).to.be.not.equal(null);

        keyContainer.deleteAll();
        // Check only key container keys have been removed
        expect(dataBase.get('key0')).to.be.not.equal(null);
        expect(dataBase.get(`kc/eth-addr/${keysAdded.address}`)).to.be.equal(null);
        expect(dataBase.get(`kc/eth-pk/${keysAdded.publicKey}`)).to.be.equal(null);
    });

    it('Generate random master seed and retrieve it from key container', () => {
        keyContainer.deleteAll();
        keyContainer.unlock('pass');
        keyContainer.setMasterSeed();
        const mnemonic = keyContainer.getMasterSeed();
        keyContainer.lock();
        expect(mnemonic).to.be.not.equal(undefined);
    });

    it('Save a known master seed and retrieve it from key container', () => {
        keyContainer.deleteAll();
        const mnemonic = 'enjoy alter satoshi squirrel special spend crop link race rally two eye';
        keyContainer.unlock('pass');
        keyContainer.setMasterSeed(mnemonic);
        const seedDb = keyContainer.getMasterSeed();
        keyContainer.lock();
        expect(mnemonic).to.be.equal(seedDb);
    });

    it('Generate known master seed, save it and access with different passphrase', () => {
        const mnemonic = 'enjoy alter satoshi squirrel special spend crop link race rally two eye';
        keyContainer.unlock('pass');
        keyContainer.setMasterSeed(mnemonic);

        keyContainer.lock();
        keyContainer.unlock('passwrong');
        expect(() => { keyContainer.getMasterSeed(); }).to.throw('Could not decrypt message');
        keyContainer.lock();
    });

    it('Generate keys', () => {
        keyContainer.deleteAll();
        const mnemonic = 'enjoy alter satoshi squirrel special spend crop link race rally two eye';
        keyContainer.unlock('pass');
        keyContainer.setMasterSeed(mnemonic);
        const keys = keyContainer.createKeys();
        expect(keys.ethAddress).to.be.equal('9dc4c7edcdd222c795fa374c8e09e21c932cfa8c');
        expect(keys.kBabyJub).to.be.equal('29db65bba0848fcd2030c88bd4500c353971ec953182bf78083f138ae9c62580');
    });
});
