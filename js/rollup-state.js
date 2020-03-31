const { bigInt } = require("snarkjs");
const utils = require("./utils");
const { poseidon } = require("circomlib");

class RollupState {

    constructor(idx, state){
        // Key leaf
        this.idx = bigInt(idx);
        // idleaf
        this.coin = bigInt(state.coin);
        this.nonce = bigInt(state.nonce);
        this.amount = bigInt(state.amount);
        this.ax = bigInt("0x" + state.ax);
        this.ay = bigInt("0x" + state.ay);
        this.ethAddr = bigInt(state.ethAddr);
    }

    static newFromArray(id, stateArray){
        const state = {};
        state.coin = parseInt(bigInt(stateArray[0]).and(bigInt(1).shl(32).sub(bigInt(1))).toString(), 10);
        state.nonce = parseInt(bigInt(stateArray[0]).shr(32).and(bigInt(1).shl(32).sub(bigInt(1))).toString(), 10);
        state.amount = bigInt(stateArray[1]);
        state.ax = bigInt(stateArray[2]).toString(16);
        state.ay = bigInt(stateArray[3]).toString(16);
        state.ethAddress = "0x" + utils.padZeros(bigInt(stateArray[4]).toString(16), 40);
        return new RollupState(id, state);
    }

    toArray(){
        const data = this.coin.add(this.nonce.shl(32));
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