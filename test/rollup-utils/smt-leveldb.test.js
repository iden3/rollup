const chai = require('chai');
const process = require('child_process');
const { newLevelDbEmptyTree } = require('../../rollup-utils/smt-leveldb');

const { expect } = chai;

describe('Smt level Db', () => {
  const pathDb = `${__dirname}/tmp`;
  let tree;
  it('Create smt with levelDb database', async () => {
    tree = await newLevelDbEmptyTree(`${__dirname}/tmp`);
    expect(tree.root.toString()).to.be.equal('0');
  });

  it('test all smt functions', async () => {
    const key1 = BigInt(111);
    const value1 = BigInt(222);
    const key2 = BigInt(333);
    const value2 = BigInt(444);
    const value3 = BigInt(555);

    await tree.insert(key1, value1);
    await tree.insert(key2, value2);
    let resValue1 = await tree.find(key1);
    expect(resValue1.foundValue.toString()).to.be.equal(value1.toString());
    const resValue2 = await tree.find(key2);
    expect(resValue2.foundValue.toString()).to.be.equal(value2.toString());
    await tree.delete(key2);
    try {
      await tree.find(key2);
    } catch (error) {
      expect((error.message).includes('Key not found in database')).to.be.equal(true);
    }
    await tree.update(key1, value3);
    resValue1 = await tree.find(key1);
    expect(resValue1.foundValue.toString()).to.be.equal(value3.toString());
  });

  after(async () => {
    process.exec(`rm -rf ${pathDb}`);
  });
});
