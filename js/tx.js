const utils = require("./utils");
const { bigInt } = require("snarkjs");
const poseidon = require("circomlib").poseidon;

class RollupTx {

    constructor(tx){
        this.loadAmount = bigInt(tx.loadAmount || 0);
        this.amount = bigInt(tx.amount || 0);
        this.coin = bigInt(tx.coin || 0);
        this.nonce = bigInt(tx.nonce || 0);
        this.userFee = bigInt(tx.userFee || 0);
        this.rqOffset = bigInt(tx.rqOffset || 0);
        this.onChain = bigInt(tx.onChain ? 1 : 0);
        this.newAccount = bigInt(tx.newAccount ? 1 : 0);

        this.rqTxData = bigInt(tx.rqTxData || 0);

        // parse toAccount
        if (typeof tx.toAx === "string") this.toAx = bigInt("0x" + tx.toAx);
        else this.toAx = bigInt(tx.toAx || 0);

        if (typeof tx.toAy === "string") this.toAy = bigInt("0x" + tx.toAy);
        else this.toAy = bigInt(tx.toAy || 0);

        this.toEthAddr = bigInt(tx.toEthAddr || 0);

        // parse fromAccount
        if (typeof tx.fromAx === "string") this.fromAx = bigInt("0x" + tx.fromAx);
        else this.fromAx = bigInt(tx.fromAx || 0);

        if (typeof tx.fromAy === "string") this.fromAy = bigInt("0x" + tx.fromAy);
        else this.fromAy = bigInt(tx.fromAy || 0);

        this.fromEthAddr = bigInt(tx.fromEthAddr || 0);

        this._roundValues();
    }

    _roundValues(){
        const amountF = utils.fix2float(this.amount);
        this.amount = utils.float2fix(amountF);
        const userFeeF = utils.fix2float(this.userFee);
        this.userFee = utils.float2fix(userFeeF);

        this.amountF = bigInt(amountF);
        this.userFeeF = bigInt(userFeeF);
    }

    getTxData() {
        const IDEN3_ROLLUP_TX = bigInt("4839017969649077913");
        let res = bigInt(0);
    
        res = res.add(IDEN3_ROLLUP_TX);
        res = res.add( this.amountF.shl(64) );
        res = res.add( this.coin.shl(80) );
        res = res.add( this.nonce.shl(112) );
        res = res.add( this.userFeeF.shl(160) );
        res = res.add( this.rqOffset.shl(176) );
        res = res.add( this.onChain.shl(179) );
        res = res.add( this.newAccount.shl(180) );
    
        return res;
    }

    getHashSignature(){
        const txData = this.getTxData();
        const hash = poseidon.createHash(6, 8, 57);

        const h = hash([
            txData,
            this.rqTxData,
            this.toAx,
            this.toAy,
            this.toEthAddr,
        ]);
        return h;
    }

    addSignature(signature, fromAx, fromAy){
        this.r8x = signature.R8[0];
        this.r8y = signature.R8[1];
        this.s = signature.S;

        if (typeof fromAx === "string")
            this.fromAx = bigInt("0x" + fromAx);
        else
            this.fromAx = bigInt(fromAx || 0);

        if (typeof fromAy === "string")
            this.fromAy = bigInt("0x" + fromAy);
        else
            this.fromAy = bigInt(fromAy || 0);
    }

    getOnChainHash(oldOnChainHash){
        const txData = this.getTxData();
        const hash = poseidon.createHash(6, 8, 57);

        const dataOnChain = hash([
            this.fromEthAddr,
            this.fromAx,
            this.fromAy,
            this.toEthAddr,
            this.toAx,
            this.toAy,
        ]);

        const h = hash([
            bigInt(oldOnChainHash || 0),
            txData,
            this.loadAmount,
            dataOnChain,
        ]);
        return h;
    }
}

module.exports = RollupTx;