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
               TxHash -1    ╲ │ │ │
               ──────────▶   ╲▼ │ │
               TxHash -2      ╲ │ │
               ──────────▶     ╲▼ │
               TxHash -3        ╲ │
               ──────────▶       ╲▼
               TxHash -4          ╲
               ──────────▶         ╲
               TxHash +3      Mux3  ──────────┐
               ──────────▶         ╱          │
               TxHash +2          ╱           │          ┌────────┐
               ──────────▶       ╱            │          │        │
               TxHash +1        ╱             └─────────▶│        │
               ──────────▶     ╱                         │  ===   │
                   0          ╱                          │        │
               ──────────▶   ╱     ┌────────────────────▶│        │
                            ╱      │                     └────────┘
                           ╱       │
                                   │
               rqHash              │
               ────────────────────┘

 */

include "../node_modules/circomlib/circuits/bitify.circom";
include "../node_modules/circomlib/circuits/mux3.circom";

template RequiredTxVerifier() {
    signal input pastTxHash[4];
    signal input futureTxHash[3];
    signal input rqTxHash;
    signal input rqTxOffset;

    component mux = Mux3();

    mux.c[0] <== 0;
    mux.c[1] <== futureTxHash[0];
    mux.c[2] <== futureTxHash[1];
    mux.c[3] <== futureTxHash[2];
    mux.c[4] <== pastTxHash[3];
    mux.c[5] <== pastTxHash[2];
    mux.c[6] <== pastTxHash[1];
    mux.c[7] <== pastTxHash[0];

    component n2b = Num2Bits(3);

    n2b.in <== rqTxOffset;
    n2b.out[0] ==> mux.s[0];
    n2b.out[1] ==> mux.s[1];
    n2b.out[2] ==> mux.s[2];

    mux.out === rqTxHash;
}
