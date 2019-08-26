/* global BigInt */
const LeafDb = require('./db');

const { smt } = require('../../../node_modules/circomlib/index');
const utils = require('./balance-tree-utils');


class BalanceTree {
  constructor(_leafDb, _smt) {
    this.leafDb = _leafDb; // Store last key - value of the baance tree
    this.smt = _smt; // Store sparse merkle tree balance tree
  }

  async addId(id, balance, tokenId, Ax, Ay, withdrawAddress, nonce) {
    const resDeposit = utils.hashLeafValue(balance, tokenId, Ax, Ay, withdrawAddress, nonce);
    this.leafDb.insert(resDeposit.hash, resDeposit.leafObj);
    const resInsert = await this.smt.insert(id, resDeposit.hash);
    return { hashValue: resDeposit.hash, proof: resInsert };
  }

  async addIdExit(id, amount, tokenId, withdrawAddress) {
    const resExit = utils.hashExitLeafValue(id, amount, tokenId, withdrawAddress);
    this.leafDb.insert(resExit.hash, resExit.leafObj);
    const resInsert = await this.smt.insert(id, resExit.hash);
    return { hashValue: resExit.hash, proof: resInsert };
  }

  async getIdInfo(id) {
    const resFind = await this.smt.find(id);
    if (resFind.found) {
      resFind.foundObject = this.leafDb.get(resFind.foundValue);
    }
    return resFind;
  }

  getRoot() {
    return this.smt.root;
  }

  async updateId(id, balance) {
    const resFind = await this.getIdInfo(id);
    if (!resFind.found) {
      throw new Error('Id does not exist');
    }
    const leafValues = resFind.foundObject;

    const resDeposit = utils.hashLeafValue(balance, leafValues.tokenId,
      leafValues.Ax, leafValues.Ay, leafValues.withdrawAddress, leafValues.nonce + BigInt(1));
    this.leafDb.insert(resDeposit.hash, resDeposit.leafObj);
    const resUpdate = await this.smt.update(id, resDeposit.hash);
    return { hashValue: resDeposit.hash, proof: resUpdate };
  }
}

async function newBalanceTree() {
  const lastTreeDb = new LeafDb();

  const tree = await smt.newMemEmptyTrie();

  const balanceTree = new BalanceTree(lastTreeDb, tree);
  return balanceTree;
}

module.exports = {
  newBalanceTree,
  BalanceTree,
};
