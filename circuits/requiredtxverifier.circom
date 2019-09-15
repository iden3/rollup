/*

RqTxVerifier
============


                           ┌─────────────┐
               rqOffset    │             │
               ───────────▶│   num2bin   │
                           │             │
                           └──┬─┬─┬──────┘
                              │ │ │
                           ╲  │ │ │
               TxData -1    ╲ │ │ │
               ──────────▶   ╲▼ │ │
               TxData -2      ╲ │ │
               ──────────▶     ╲▼ │
               TxData -3        ╲ │
               ──────────▶       ╲▼
               TxData -4          ╲
               ──────────▶         ╲
               TxData +3      Mux3  ──────────┐
               ──────────▶         ╱          │
               TxData +2          ╱           │          ┌────────┐
               ──────────▶       ╱            │          │        │
               TxData +1        ╱             └─────────▶│        │
               ──────────▶     ╱                         │  ===   │
                   0          ╱                          │        │
               ──────────▶   ╱     ┌────────────────────▶│        │
                            ╱      │                     └────────┘
                           ╱       │
                                   │
               rqTxData            │
               ────────────────────┘

 */

include "../node_modules/circomlib/circuits/bitify.circom";
include "../node_modules/circomlib/circuits/mux3.circom";

template RequiredTxVerifier() {
    signal input pastTxData[4];
    signal input futureTxData[3];
    signal input rqTxData;
    signal input rqTxOffset;

    component mux = Mux3();

    mux.c[0] <== 0;
    mux.c[1] <== futureTxData[0];
    mux.c[2] <== futureTxData[1];
    mux.c[3] <== futureTxData[2];
    mux.c[4] <== pastTxData[3];
    mux.c[5] <== pastTxData[2];
    mux.c[6] <== pastTxData[1];
    mux.c[7] <== pastTxData[0];

    component n2b = Num2Bits(3);

    n2b.in <== rqTxOffset;
    n2b.out[0] ==> mux.s[0];
    n2b.out[1] ==> mux.s[1];
    n2b.out[2] ==> mux.s[2];

    mux.out === rqTxData;
}
