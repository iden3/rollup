/* eslint-disable no-return-await */
/* global BigInt */
const { smt } = require("circomlib");
const { stringifyBigInts, unstringifyBigInts } = require("snarkjs");
const { newLevelDbEmptyTree } = require("./smt-leveldb");
const LeafMemDb = require("./mem-db");
const LeafLevelDb = require("./level-db");
const utils = require("./rollup-tree-utils");

class RollupTree {
    constructor(_leafDb, _smt) {
        this.leafDb = _leafDb; // Store last key - value of the balance tree
        this.smt = _smt; // Store sparse merkle tree balance tree
    }

    _toString(val) {
        return JSON.stringify(stringifyBigInts(val));
    }

    _fromString(val) {
        return unstringifyBigInts(JSON.parse(val));
    }

    async addId(id, balance, tokenId, Ax, Ay, ethAddress, nonce) {
        const resDeposit = utils.hashStateTree(balance, tokenId, Ax, Ay, ethAddress, nonce);
        await this.leafDb.insert(resDeposit.hash, this._toString(resDeposit.leafObj));
        const resInsert = await this.smt.insert(id, resDeposit.hash);
        return { hashValue: resDeposit.hash, proof: resInsert };
    }

    async addIdExit(id, amount, tokenId, ethAddress) {
        const resExit = utils.hashStateTree(id, amount, tokenId, ethAddress);
        await this.leafDb.insert(resExit.hash, this._toString(resExit.leafObj));
        const resInsert = await this.smt.insert(id, resExit.hash);
        return { hashValue: resExit.hash, proof: resInsert };
    }

    async getIdInfo(id) {
        const resFind = await this.smt.find(id);
        if (resFind.found) {
            resFind.foundObject = this._fromString(await this.leafDb.get(resFind.foundValue));
        }
        return resFind;
    }

    async getRoot() {
        return await this.smt.root;
    }

    async updateId(id, balance) {
        const resFind = await this.getIdInfo(id);
        if (!resFind.found) {
            throw new Error("Id does not exist");
        }
        const leafValues = resFind.foundObject;

        const resDeposit = utils.hashStateTree(balance, leafValues.tokenId,
            leafValues.Ax, leafValues.Ay, leafValues.ethAddress, leafValues.nonce + BigInt(1));
        await this.leafDb.insert(resDeposit.hash, this._toString(resDeposit.leafObj));
        const resUpdate = await this.smt.update(id, resDeposit.hash);
        return { hashValue: resDeposit.hash, proof: resUpdate };
    }
}

async function newMemRollupTree() {
    const lastTreeDb = new LeafMemDb();
    const tree = await smt.newMemEmptyTrie();
    const rollupTree = new RollupTree(lastTreeDb, tree);
    return rollupTree;
}

async function newLevelDbRollupTree(path, prefix) {
    const lastTreeDb = new LeafLevelDb(`${path}-leafs`, prefix);
    const tree = await newLevelDbEmptyTree(`${path}-tree`, prefix);
    const rollupTree = new RollupTree(lastTreeDb, tree);
    return rollupTree;
}

module.exports = {
    newLevelDbRollupTree,
    newMemRollupTree,
    RollupTree,
};
