/*
                                  +---------------------+
                                  |                     |
                     +----------> |                     |
                     |            |                     |
                     +----------> |                     |
                     |            |                     |
                     +----------> |                     |
                     |            |                     |
                     +----------> |                     |
                     |            |                     |
                     +----------> |                     |
                     |            |                     |
                     +----------> |                     |
                     |            |                     |
                     +----------> |                     |
                     |            |                     |
                     +----------> |                     |
  feeTable[16] +---->+            |     Fee Selector    | +-----> feeOut
                     +----------> |                     |
                     |            |                     |
                     +----------> |                     |
                     |            |                     |
                     +----------> |                     |
                     |            |                     |
                     +----------> |                     |
                     |            |                     |
                     +----------> |                     |
                     |            |                     |
                     +----------> |                     |
                     |            |                     |
                     +----------> |                     |
                     |            |                     |
                    ++----------> |                     |
                                  |                     |
                                  +---------------------+
                                     ^    ^    ^    ^
                                     |    |    |    |
                                     |    |    |    |
                                     +----+--+-+----+
                                             |
                                             |
                                             +

                                           feeSel
*/

include "../node_modules/circomlib/circuits/comparators.circom";
include "../node_modules/circomlib/circuits/mux4.circom";
include "../node_modules/circomlib/circuits/bitify.circom";
include "../node_modules/circomlib/circuits/mux1.circom";

template FeeTableSelector() {
    signal input feeSel;
    signal output feeOut;

    component n2bFeeSel = Num2Bits(4);
    n2bFeeSel.in <== feeSel;

    var table[16] = feeInvTable();

    component muxFee = Mux4();    
    
    // set multiplexer selectors 
    for (var i = 0; i < 4; i++) {
        muxFee.s[i] <== n2bFeeSel.out[i];
    }

    // set multiplexer inputs 
    for (var i = 0; i < 16; i++){
        muxFee.c[i] <== table[i];
    }

    muxFee.out ==> feeOut;
}

function feeInvTable() { 

    var out[16] = [ 
        0,
        100000,
        50000,
        20000,
        10000,
        5000,
        2000,
        1000,
        500,
        200,
        100,
        50,
        20,
        10,
        5,
        2 
    ];

  return out;
}
