/* eslint-disable no-underscore-dangle */
/* global artifacts */
/* global contract */
/* global web3 */

const chai = require('chai');
const { smt } = require('../../node_modules/circomlib/index');
const { mimc7 } = require('../../node_modules/circomlib/index');

const { expect } = chai;
const poseidonUnit = require('../../node_modules/circomlib/src/poseidon_gencontract.js');
const poseidonJs = require('../../node_modules/circomlib/src/poseidon.js');

const HelpersTest = artifacts.require('../contracts/test/RollupHelpersTest');

function bytesToHex(buff) {
  return `0x${buff.toString('hex')}`;
}

function bigIntToBuffer(number) {
  const buff = Buffer.alloc(32);
  let pos = buff.length - 1;
  while (!number.isZero()) {
    buff[pos] = Number(number.and(BigInt(255)));
    number = number.shr(8);
    pos -= 1;
  }
  return buff;
}

function newEntry(arr) {
  return {
    hi: mimc7.multiHash(arr.slice(2)),
    hv: mimc7.multiHash(arr.slice(0, 2)),
  };
}

contract('RollupHelpers functions', (accounts) => {
  const {
    0: owner,
  } = accounts;

  let insHelpers;
  let insPoseidonUnit;

  before(async () => {
    // Deploy poseidon
    const C = new web3.eth.Contract(poseidonUnit.abi);
    insPoseidonUnit = await C.deploy({ data: poseidonUnit.createCode() })
      .send({ gas: 2500000, from: owner });

    // Deploy rollup helpers test
    insHelpers = await HelpersTest.new(insPoseidonUnit._address);
  });

  it('hash node generic', async () => {
    const hashJs = poseidonJs.createHash(6, 8, 57);
    const resJs = hashJs([1, 2, 3, 4, 5]);

    const resSm = await insHelpers.testHashGeneric([1, 2, 3, 4, 5]);
    expect(resJs.toString()).to.be.equal(resSm.toString());
  });

  it('hash node', async () => {
    const hashJs = poseidonJs.createHash(6, 8, 57);
    const resJs = hashJs([1, 2]);

    const resSm = await insHelpers.testHashNode(1, 2);
    expect(resJs.toString()).to.be.equal(resSm.toString());
  });

  it('hash final node', async () => {
    const hashJs = poseidonJs.createHash(6, 8, 57);
    const resJs = hashJs([1, 2, 1]);

    const resSm = await insHelpers.testHashFinalNode(1, 2);
    expect(resJs.toString()).to.be.equal(resSm.toString());
  });

  it('sparse merkle tree verifier: existence', async () => {
    const tree = await smt.newMemEmptyTrie();

    const oldKey = '0';
    const oldValue = '0';
    const isOld = false;
    const isNonExistence = false;

    const key1 = BigInt(7);
    const value1 = BigInt(77);
    const key2 = BigInt(8);
    const value2 = BigInt(88);
    const key3 = BigInt(32);
    const value3 = BigInt(3232);

    await tree.insert(key1, value1);
    await tree.insert(key2, value2);
    await tree.insert(key3, value3);

    let resProof;
    let siblings;
    const root = tree.root.toString();

    // Verify key1, value1
    resProof = await tree.find(key1);
    siblings = [];
    for (let i = 0; i < resProof.siblings.length; i++) {
      siblings.push(resProof.siblings[i].toString());
    }
    const resSm1 = await insHelpers.smtVerifierTest(root, siblings, key1.toString(), value1.toString(),
      oldKey, oldValue, isNonExistence, isOld);
    expect(resSm1).to.be.equal(true);

    // Verify key2, value2
    resProof = await tree.find(key2);
    siblings = [];
    for (let i = 0; i < resProof.siblings.length; i++) {
      siblings.push(resProof.siblings[i].toString());
    }
    const resSm2 = await insHelpers.smtVerifierTest(root, siblings, key2.toString(), value2.toString(),
      oldKey, oldValue, isNonExistence, isOld);
    expect(resSm2).to.be.equal(true);

    // Verify key3, value3
    resProof = await tree.find(key3);
    siblings = [];
    for (let i = 0; i < resProof.siblings.length; i++) {
      siblings.push(resProof.siblings[i].toString());
    }
    const resSm3 = await insHelpers.smtVerifierTest(root, siblings, key3.toString(), value3.toString(),
      oldKey, oldValue, isNonExistence, isOld);
    expect(resSm3).to.be.equal(true);

    // Trick proof: Verify key3, value1
    resProof = await tree.find(key3);
    siblings = [];
    for (let i = 0; i < resProof.siblings.length; i++) {
      siblings.push(resProof.siblings[i].toString());
    }
    const resSm4 = await insHelpers.smtVerifierTest(root, siblings, key3.toString(), value1.toString(),
      oldKey, oldValue, isNonExistence, isOld);
    expect(resSm4).to.be.equal(false);
  });
});
