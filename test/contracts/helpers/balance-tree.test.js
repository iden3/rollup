/* global BigInt */

const chai = require('chai');
const BalanceTree = require('./balance-tree.js');

const { expect } = chai;

describe('Balance tree', () => {
  let balanceTree;

  const id = BigInt(1);
  const amountDeposit = BigInt(2);
  const tokenId = BigInt(3);
  const Ax = BigInt(30890499764467592830739030727222305800976141688008169211302);
  const Ay = BigInt(19826930437678088398923647454327426275321075228766562806246);
  const withdrawAddress = BigInt('0xe0fbce58cfaa72812103f003adce3f284fe5fc7c');
  const nonce = BigInt(4);

  it('Create Balance tree and insert a deposit', async () => {
    balanceTree = await BalanceTree.newBalanceTree();
    const resAddId = await balanceTree.addId(id, amountDeposit, tokenId, Ax, Ay, withdrawAddress, nonce);

    const hexRollupHelpers = '24ea87c296b656522777264502eda198b285590e97e16e75e9d80758cb69e83';

    expect(resAddId.hashValue.toString('16')).to.be.equal(hexRollupHelpers);
  });

  it('Find key exist', async () => {
    const idToFind = BigInt(1);
    const resFind = await balanceTree.getIdInfo(idToFind);
    const leafValue = resFind.foundObject;

    expect(leafValue.id.toString()).to.be.equal(id.toString());
    expect(leafValue.balance.toString()).to.be.equal(amountDeposit.toString());
    expect(leafValue.tokenId.toString()).to.be.equal(tokenId.toString());
    expect(leafValue.Ax.toString()).to.be.equal(Ax.toString());
    expect(leafValue.Ay.toString()).to.be.equal(Ay.toString());
    expect(leafValue.withdrawAddress.toString()).to.be.equal(withdrawAddress.toString());
    expect(leafValue.nonce.toString()).to.be.equal(nonce.toString());
  });

  it('Find key non-exist', async () => {
    const idToFind = BigInt(2);
    const resFind = await balanceTree.getIdInfo(idToFind);
    // eslint-disable-next-line no-prototype-builtins
    const flagObject = resFind.hasOwnProperty('foundObject');

    expect(flagObject).to.be.equal(false);
    expect(resFind.found).to.be.equal(false);
  });

  it('Update leaf', async () => {
    const newBalance = BigInt(5);
    await balanceTree.updateId(id, newBalance);

    const idToFind = BigInt(1);
    const resFind = await balanceTree.getIdInfo(idToFind);
    const leafValue = resFind.foundObject;

    expect(leafValue.id.toString()).to.be.equal(id.toString());
    expect(leafValue.balance.toString()).to.be.equal(newBalance.toString());
    expect(leafValue.nonce.toString()).to.be.equal((nonce + BigInt(1)).toString());
  });
});