const Scalar = require("ffjavascript").Scalar;
const poseidon = require("circomlib").poseidon;

const utils = require("./utils");

class RollupState {

    constructor(idx, state){
        // Key leaf
        this.idx = Scalar.e(idx);
        // idleaf
        this.coin = Scalar.e(state.coin);
        this.nonce = Scalar.e(state.nonce);
        this.amount = Scalar.e(state.amount);
        this.ax = Scalar.fromString(state.ax);
        this.ay = Scalar.fromString(state.ay);
        this.ethAddr = Scalar.e(state.ethAddr);
    }

    static newFromArray(id, stateArray){
        const state = {};
        state.coin = Scalar.toNumber(utils.extract(stateArray[0], 0, 32));
        state.nonce = Scalar.toNumber(utils.extract(stateArray[0], 32, 48));
        state.amount = bigInt(stateArray[1]);
        state.ax = Scalar.e(stateArray[2]).toString(16);
        state.ay = Scalar.e(stateArray[3]).toString(16);
        state.ethAddress = "0x" + padZeros(Scalar.e(stateArray[4]).toString(16), 40);
        return new RollupState(id, state);
    }

    toArray(){
        const data = Scalar.add(this.coin, Scalar.shl(this.nonce, 32));
        return [
            data,
            this.amount,
            this.ax,
            this.ay,
            this.ethAddress,
        ];
    }

    getHash(){
        const hash = poseidon.createHash(6, 8, 57);
        return hash(this.toArray());
    }

    getUniqueId(){
        const hash = poseidon.createHash(6, 8, 57);
        return hash([this.idx, this.ax, this.ay]);
    }
}

module.exports = RollupState;