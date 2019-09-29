const bigInt = require("snarkjs").bigInt;

class TXPool {

    contructor(db, rollupState, cfg) {

    }

    async addTx(tx) {

    }

    async removeMinedTxs(block) {

    }

    async isTxValid(tx) {

    }

    async canBeMined(db, stateRoot) {

    }

    async fillBlock(bb, NSlots, MaxCoins, conversion) {
        const txs = this.txs;
        const availableTx = [];
        const removeTxs = [];
        const futureTxs = {};
        const table = {};
        for (let i=0; i<txs.length; i++) {
            txs[i].operatorValue = this._getOperatorValue(txs[i], conversion);
        }
        txs.sort((a,b) => {return b.operatorValue - a.operatorValue; });
        for (let i=0; i<txs.length; i++) {
            txs[i].idx=i;
            const st = await bb.getState(txs[i].idxFrom);
            if (txs[i].nonce<st.nonce) {
                removeTxs.push(i);
            } else if (txs[i].nonce > st.nonce) {
                if (!futureTxs[txs[i].idxFrom]) futureTxs[txs[i].idxFrom] = {};
                const oldTx = futureTxs[txs[i].idxFrom][txs[i].nonce];
                if (oldTx) {
                    if ((txs[i].operatorValue > oldTx.operatorValue)) {
                        removeTxs.push(oldTx.idx);
                        futureTxs[txs[i].idxFrom][txs[i].nonce] = txs[i];
                    }
                } else {
                    futureTxs[txs[i].idxFrom][txs[i].nonce] = i;
                }
            } else {
                const coin = txs[i].coin;
                if (!table[coin]) table[coin] = {
                    state: new State(this.db),
                    txs: []
                };
                if (!table[coin].state.processTx(txs[i])) {
                    removeTxs.push[i];
                } else {
                    availableTx.push(txs[i]);
                    table[coin].txs.push(txs[i]);
                }
            }
        }

        // Calculate absValues and MarginalValues
        for (let coin in table) {
            table[coin].incTable = [];
            for (let i=0; i<table[coin].txs.length; i++) {
                const tx = table[coin].txs[i];

                const fee = (table[coin].incTable.length == 0) ?
                    tx.userFee :
                    bigInt.min( tx.userFee, table[coin].incTable[table[coin].length-1].fee );
                const feeValue = (table[coin].incTable.length == 0) ?
                    tx.feeValue :
                    Math.min( tx.userFeeValue, table[coin].incTable[table[coin].length-1].userFeeValue );

                const absValue = feeValue*i;

                if ((table[coin].incTable.length == 0) ||
                   (table[coin].incTable[table[coin].incTable.length-1].absValue < absValue))
                {
                    table[coin].incTable.push({
                        nTx: i,
                        incTx:
                            (table[coin].incTable.length == 0) ?
                                i :
                                (i - table[coin].incTable[table[coin].incTable.length-1].nTx),
                        absValue: absValue,
                        marginalFeeValue:
                            (table[coin].incTable.length == 0) ?
                                (absValue/i) :
                                ((absValue - table[coin].incTable[table[coin].incTable.length-1].absValue) /
                                    (i - table[coin].incTable[table[coin].incTable.length-1].nTx)),
                        fee: fee,
                        feeValue: feeValue
                    });
                }
            }
        }

        let filledTx = fillTx(NSlots);

        const usedCoins = Object.keys(table);
        usedCoins.sort((a,b) => {
            return table[b].incTable[ table[b].p ].absValue -
                   table[a].incTable[ table[a].p ].absValue;
        });
        while (usedCoins.length>MaxCoins) {
            const coin = usedCoins.length-1;
            filledTx -= table[coin].incTable[ table[coin].p ].nTx;
            delete table[coin];
            usedCoins.pop();
        }

        fillTx(NSlots-filledTx);



        const feePlan = usedCoins.map( (coin) => {
            return [coin, table[coin].incTable[ table[coin].p ].fee];
        });

        const resTx = [];
        const nTx = {};
        for (let coin in table) nTx[coin] = table[coin].incTable[ table[coin].p ].nTx;

        for (let i=0; i<availableTx.length; i++) {
            const tx = availableTx[i];
            if (nTx[tx.coin] > 0) {
                resTx.push(tx);
                nTx[tx.coin]--;
            }
        }

        function fillTx(n) {

            let totalTx =0;
            let end = false;
            while (!end) {
                let bestCoin = -1;
                let bestMarginalValue = 0;
                for (let coin in table) {
                    const p = (table[coin].p == "undefined") ? 0 : table[coin].p+1;
                    if ((table[coin].incTable[p].marginalValue > bestMarginalValue)&&
                        (table[coin].incTable[p].incTx + totalTx <=  n))
                    {
                        bestCoin = coin;
                        bestMarginalValue = table[coin].incTable[p].marginalValue;
                    }
                }

                if (bestCoin >= 0) {
                    const p = (table[bestCoin].p == "undefined") ? 0 : table[bestCoin].p+1;
                    table[bestCoin].p = p;
                    totalTx += table[bestCoin].incTable[p].incTx;
                } else {
                    end = true;
                }
            }
            return totalTx;
        }

        return {feePlan, resTx};
    }


}


module.exports = async function InstantiateTxPool(db) {

};
