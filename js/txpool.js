const bigInt = require("snarkjs").bigInt;
const utils = require("utils").bigInt;
const Constants = require("./constants");

class TXPool {

    /*
        cfg = {
            maxSlots,               // Absolute maximum number of TXs in the pool
            purgeThreasholdUp,      // The purge process is triggered when this num is reached
            purgeThreasholdDown     // The purge will aintain this number of TXs.
        }


     */

    contructor(rollupDB, cfg) {

        this.txs = [];
        this.cfg = cfg;
        this.MaxSlots (cfg.size);
        this.slotsMap = Array( Math.floor((cfg.maxSlots-1)/32) +1).fill(0);
        this.updateSlotsPending = false;
        this.conversion = {};
    }

    setConversion(conversion) {
        this.conversion = conversion;
    }

    _tx2Array(tx) {
        return [
            buildTxData(tx),
            tx.rqTxData,
            bigInt(tx.timestamp).shl(32).add(bigInt(tx.slot))
        ];
    }

    _array2Tx(arr) {
        const res = {};
        const d0 = bigInt(arr[0]);
        res.fromIdx = extract(d0, 0, 64);
        res.toIdx = extract(d0, 64, 64);
        res.amount = float2fix(extract(d0, 128, 16));
        res.coin = float2fix(extract(d0, 144, 16));
        res.nonce = extract(d0, 176, 16);
        res.userFee = float2fix(extract(d0, 224, 16));
        res.rqOffset = extract(d0, 240, 3);
        res.onChain = extract(d0, 243, 1);
        res.newAccount = extract(d0, 244, 1);

        res.rqTxData = bigInt(arr[1]);

        const d2 = bigInt(arr[2]);
        res.slot = extract(d2, 0, 32).toJSNumber();
        res.timestamp = extract(d2, 32, 64).toJSNumber();

        function extract(n, o, s) {
            const mask = bigInt(1).shl(s).sub(bigInt(1));
            return n.shr(0).and(mask);
        }
    }

    async addTx(tx) {
        tx.slot=this._allocateFreeSlot();
        if (tx.slot == -1) {
            await this.purge();
            tx.slot=this._allocateFreeSlot();
            if (tx.slot == -1) {
                console.log("TX Pool Full");
                return;  // If all slots are full, just ignore the TX.
            }
        }
        tx.timestamp = (new Date()).getTime();
        this.txs.push(tx);

        this.updateSlotsPending = true;
        await this.rollupDB.multiIns(
            [Constants.DB_Tx.add(bigInt(tx.slot)), this.tx2Array(tx)]
        )
        await this._updateSlotsIfPending();
    }

    _allocateFreeSlot() {
        let i = 0;
        for (i=0; i<this.slotsMap.length; i++) {
            if (this.slotsMap[i] != 0xFFFFFFFF) {
                let r = 0;
                let s = this.slotsMap;
                while (s & 1) {
                    s = s >> 1;
                    r ++
                }
                this.slotsMap[i] = this.slotsMap[i] | (1 << r);
                return i*32+r;
            }
        }
        return -1;
    }

    async _updateSlotsIfPending() {
        if (!this.updateSlotsPending) return;
        this.updateSlotsPending = false;
        await this.rollupDB.multiIns(
            [Constants.DB_TxPoolSlotsMap, this.slotsMap]
        )
    }


    _classifyTxs() {

        this._calculateNormalizedFees();

        const tmpState = new TmpState(this.rollupDB);

        // Arrange the TX by Index and by Nonce
        const byIdx = {};
        for (let i=0; i<this.txs.length; i++) {
            const tx = this.txs[i];
            const st = tmpState.getState(tx.idxFrom);
            if (tx.nonce < st.nonce) {
                tx.removed = true;
                continue;
            }
            tx.adjustedFee = tx.normalizedFee;
            byIdx[tx.idxFrom] = byIdx[tx.idxFrom] || {};
            byIdx[tx.idxFrom][tx.nonce] = byIdx[tx.idxFrom][tx.nonce] || [];
            tx.jump = false;
            byIdx[tx.idxFrom][tx.nonce].push(tx);
        }

        // Split the TXs between indexes and Nonces
        const notAvTxs ={};
        const avTxs = {};
        for (let i in byIdx) {
            tmpState.reset();
            const st = tmpState.getState(tx.idxFrom);
            nonces = Object.keys(byIdx[i]);
            nonces.sort((a,b) => (a-b)) ;
            let curNonce = st.nonce;
            let brokenSequence = false;
            for (let n in nonces) {
                if ((curNonce == n)&&(!brokenSequence)) {
                    const possibleTxs = [];
                    for (let t in byIdx[i][n]) {
                        const tx = byIdx[i][n][t];
                        if (tmpState.canProces(tx)) {
                            possibleTxs.push(tx);
                        } else{
                            notAvTx[i] = notAvTx[i] || [];
                            notAvTx[i][n] = notAvTx[i][n] || [];
                            tx.queue = "NAV";
                            notAvTx[i][n].push(tx);
                        }
                    }
                    if (possibleTxs.length>0) {
                        possibleTxs.sort( (a,b) => (a.normalizedFee));
                        avTxs[i] = avTxs[i] || [];
                        avTxs[i][n]=possibleTxs.pop();
                        avTxs[i][n].queue = "AV";
                        // Pick the best ones and remove the others.
                        for (let t in possibleTxs) possibleTxs[t].removed=true;
                        // Remove not available txs with lower fee
                        if ((notAvTx[i] != "undefined")&&(notAvTx[i][n] != "undefined")) {
                            for (let t in notAvTx[i][n]) {
                                if (notAvTx[i][n][t].normalizedFee <= avTxs[i][n].normalizedFee) {
                                    notAvTx[i][n][t].removed = true;
                                }
                            }
                        }
                        tmpState.process(avTxs[i][n]);
                        const af = avTxs[i][n].adjustedFee / (n - st.nonce +1);
                        for (let t in avTxs[i]) {
                            if (avTxs[t].adjustedFee < af) avTxs[t].adjustedFee = af;
                            avTxs[t].adjustedFe = 0;
                        }
                    } else {
                        brokenSequence = true;
                    }
                } else {
                    brokenSequence = true;
                }
            }
        }

        for (let i=this.txs.length; i>=0; i--) {
            if (this.txs[i].removed) {
                _freeSlot(this.txs[i].slot);
                txs.splice(i, 1);
                this.updateSlotsPending = true;
            }
        }
        this._updateSlotsIfPending();
    }

    async purge() {
        if (this.purging) return;
        this.purging = true;


        await this._updateSlotsIfPending();
        this.purging = false;
    }

    _calculateNormalizedFees() {
        for (let i=0; i<this.txs.length; i++) {
            const tx = this.txs[i];
            const convRate = this.conversion[tx.coin];

            if (convRate) {
                if (typeof(tx.userFeeF) == "undefined") {
                    tx.userFeeF = utils.float2fix(tx.userFee);
                }
                const num = tx.userFeeF.mul(bigInt(Math.floor(convRate.price*2**64)));
                const den = bigInt(10).pow(bigInt(convRate.decimals));

                tx.normalizedFee = (num.div(den)).toJSNumber() / 2**64;
            } else {
                tx.normalizedFee = 0;
            }
        }
    }


    /* Example of conversion
    {
        0: {   // Coin 1
            token: "ETH"
            price: 210.21
            decimals: 18
        },
        1: {
            token: "DAI"
            price: 1
            decimals: 18
        }

    }
    */

    async fillBatch(bb, conversion, _MaxCoins) {
        const txs = this.txs;
        const futureTxs = [];
        const txsByCoin = {};

        const MaxCoins = _MaxCoins || 16;
        const NSlots = bb.maxNTx - bb.onChainTxs.length;

        this._classifyTxs();

        const availableTxs = [];
        for (let i=0; i<this.txs.length; i++) {
            if (!this.txs[i].removed) {
                availableTxs.push(this.txs[i]);
            }
        }

        const fnSort = (a,b) => { return a.adjustedFee - b.adjustedFee; }

        // Sort the TXs reverse normalized Fee (First is the most profitable)
        availableTxs.sort(fnSort);

        const tmpState = new TmpState(this.rollupDB);
        for (let i=0; i<txs.length; i++) {
            tx = availableTxs.pop();
            res = tmpState.canProces(tx);
            if (res = "YES") {
                tmpState.processTx(tx)
                if (!table[tx.coin]) table[tx.coin] = [];
                txsByCoin[coin].push(tx);
                const ftxFrom = popFuture(tx.idxFrom, tx.nonce+1);
                const stTo = tmpState.getState(tx.idxTo);
                const ftxTo = popFuture(tx.idxTo, stTo.nonce);
                if ((ftxFrom.length>0) || (ftxTo.length>0)) {
                    availableTxs = [availableTxs, ...ftxFrom, ...ftxTo];
                    availableTxs.sort(fnSort);
                }
            } else (res = "NOT_NOW") {
                addFuture(tx);
            } else {
                tx.removed = true;
            }
        }

        const incTable = {};
        for (let coin in txsByCoin) {
            incTable[coin] = [];

            // Accumulated values
            let nNonZero = 0;
            let fee = undefined;
            let normalizedFee = 2**30; // Infinity
            let accValue = 0;
            let nTx = 0;

            // Best values
            let bestAccValue = 0;
            let bestNTx = 0;

            for (let i=0; i<txsByCoin[coin].length; i++) {
                const tx = txsByCoin[coin][i];

                nTx ++;
                if ( tx.normalizedFee > 0 ) nNonZero++;
                if (( tx.normalizedFee < normalizedFee )&&
                    ( tx.normalizedFee > 0 ))
                {
                    fee = tx.fee;
                    normalizedFee = tx.normalizedFee;
                }

                accValue = nNonZero * normalizedFee;

                if (accValue > bestAccValue) {
                    incTable[coin].push({
                        nTx: nTx,
                        incTx: nTx - bestNTx,
                        accValue: accValue,
                        marginalFeeValue: (accValue - bestAccValue) / (nTx - bestNTx),
                        fee: fee,
                        normalizedFee: normalizedFee,
                    });
                    bestAccValue = accValue;
                    bestNTx = NTx;
                }
            }
        }

        let forgedTxs = [];
        const PTable = {};

        fillTx(forgedTxs, NSlots, incTable, PTable);

        const usedCoins = Object.keys(PTable);

        usedCoins.sort((a,b) => {
            return incTable[b][ PTable[b] ].accValue -
                   incTable[a][ PTable[a] ].accValue;
        });

        const removedCoins = [];
        while (usedCoins.length>MaxCoins) {
            const coin = usedCoins.pop();
            removedCoins.push(coin);
            delete incTable[coin];
        }

        removeTxCoins(forgedTxs, removedCoins);

        // removeNotAvailableTxs(forgedTxs);

        fillTx(forgedTxs, NSlots-forgedTxs.length, incTable, PTable);

        for (c in usedCoins) {
            bb.addCoin(c, incTable[coin][ incTable[coin].p ].fee);
        }

        for (i=0; i<forgedTxs.length; i++) {
            bb.addTx(forgedTxs[i]);
        }

        bb.build();

        function fillTx(n) {

            let totalTx =0;
            let end = false;
            while (!end) {
                let bestCoin = -1;
                let bestMarginalValue = 0;
                for (let coin in incTable) {
                    const p = (PTable[coin] == "undefined") ? 0 : PTable[coin]+1;
                    if ((incTable[coin][p].marginalValue > bestMarginalValue)&&
                        (incTable[coin][p].incTx + totalTx <=  n))
                    {
                        bestCoin = coin;
                        bestMarginalValue = incTable[coin][p].marginalValue;
                    }
                }

                if (bestCoin >= 0) {
                    const firstT = (PTable[coin] == "undefined") ? 0 : incTable[coin][PTable[coin]].nTx;
                    PTable[coin] = (PTable[coin] == "undefined") ? 0 : PTable[coin]+1;
                    const lastT = incTable[coin][PTable[coin]].nTx;
                    totalTx += table[bestCoin].incTable[p].incTx;
                    for (let i=firstT; i<lastT; i++) {
                        forgedTxs.push(txsByCoin[bestCoin][i]);
                    }
                } else {
                    end = true;
                }
            }
            return totalTx;
        }

        function removeTxsOfCoins(txs, coins) {
            const res = [];
            for (i=txs.length-1; i>=0; i--) {
                if (coins.indexOf(txs[i].coin) >= 0) {
                    txs.splice(i, 1);
                }
            }
        }

    }



}


module.exports = async function InstantiateTxPool(db) {

};
