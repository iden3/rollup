/* eslint-disable no-return-await */
const { smt } = require("circomlib");
const { stringifyBigInts, unstringifyBigInts } = require("ffjavascript").utils;
const Scalar = require("ffjavascript").Scalar;

const { newLevelDbEmptyTree } = require("./smt-leveldb");
const LeafMemDb = require("./mem-db");
const LeafLevelDb = require("./level-db");
const utils = require("./rollup-tree-utils");

/**
 * Class representing a rollup account tree databse
 */
class RollupTree {
    /**
     * Initialize rollup tree
     * @param {Object} _leafDb - databse to store raw leafs 
     * @param {Object} _smt - databse to store hash-value as merkle tree structured
     */
    constructor(_leafDb, _smt) {
        this.leafDb = _leafDb; // Store last key - value of the balance tree
        this.smt = _smt; // Store sparse merkle tree balance tree
    }

    /**
     * Convert to string
     * normally used in order to add it to database
     * @param {Any} - any input parameter
     * @returns {String}
     */
    _toString(val) {
        return JSON.stringify(stringifyBigInts(val));
    }

    /**
     * Get from string
     * normally used ti get from database
     * @param {String} - string to parse
     * @returns {Any} 
     */
    _fromString(val) {
        return unstringifyBigInts(JSON.parse(val));
    }

    /**
     * Add new leaf to tree and to leaf database
     * @param {BigInt} id - account tree identifier 
     * @param {BigInt} balance - leaf balance
     * @param {BigInt} tokenId - token identifier
     * @param {BigInt} Ax - point X babyjubjub 
     * @param {BigInt} Ay - point Y babyjubjub
     * @param {BigInt} ethAddress - ethereum adress
     * @param {BigInt} nonce - nonce
     * @returns {Object} - Contains has leaf value and merkle tree proof
     */
    async addId(id, balance, tokenId, Ax, Ay, ethAddress, nonce) {
        const resDeposit = utils.hashStateTree(balance, tokenId, Ax, Ay, ethAddress, nonce);
        await this.leafDb.insert(resDeposit.hash, this._toString(resDeposit.leafObj));
        const resInsert = await this.smt.insert(id, resDeposit.hash);
        return { hashValue: resDeposit.hash, proof: resInsert };
    }

    /**
     * Add new leaf to exit tree
     * @param {BigInt} id - account identifier
     * @param {BigInt} amount - amount leaf
     * @param {BigInt} tokenId - token identifier
     * @param {BigInt} ethAddress - ethereum address
     * @returns {Object} - Contains has leaf value and merkle tree proof
     */
    async addIdExit(id, amount, tokenId, ethAddress) {
        const resExit = utils.hashStateTree(id, amount, tokenId, ethAddress);
        await this.leafDb.insert(resExit.hash, this._toString(resExit.leafObj));
        const resInsert = await this.smt.insert(id, resExit.hash);
        return { hashValue: resExit.hash, proof: resInsert };
    }

    /**
     * Retrieve leaf information for a given identifier
     * @param {BigInt} id - account identifier
     * @returns {Object} - raw account state
     */
    async getIdInfo(id) {
        const resFind = await this.smt.find(id);
        if (resFind.found) {
            resFind.foundObject = this._fromString(await this.leafDb.get(resFind.foundValue));
        }
        return resFind;
    }

    /**
     * Get rollup merkle tree root
     * @returns {BigInt} - merkle tree root
     */
    async getRoot() {
        return await this.smt.root;
    }

    /**
     * Update account leaf
     * @param {BigInt} id - account identifier
     * @param {BigInt} balance - account balance
     * @returns {Object} - Contains has leaf value and merkle tree proof  
     */
    async updateId(id, balance) {
        const resFind = await this.getIdInfo(id);
        if (!resFind.found) {
            throw new Error("Id does not exist");
        }
        const leafValues = resFind.foundObject;

        const resDeposit = utils.hashStateTree(balance, leafValues.tokenId,
            leafValues.Ax, leafValues.Ay, leafValues.ethAddress, leafValues.nonce + Scalar.e(1));
        await this.leafDb.insert(resDeposit.hash, this._toString(resDeposit.leafObj));
        const resUpdate = await this.smt.update(id, resDeposit.hash);
        return { hashValue: resDeposit.hash, proof: resUpdate };
    }
}

/**
 * Create new memory rollup tree
 * @returns {RollupTree} - rollup tree class
 */
async function newMemRollupTree() {
    const lastTreeDb = new LeafMemDb();
    const tree = await smt.newMemEmptyTrie();
    const rollupTree = new RollupTree(lastTreeDb, tree);
    return rollupTree;
}

/**
 * Create new levelDb rollup tree
 * @returns {RollupTree} - rollup tree class
 */
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
