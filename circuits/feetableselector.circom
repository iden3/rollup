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
        0,          // Floor(0       * 2**32)
        42949,      // Floor(0.00001 * 2**32)
        85899,      // Floor(0.00002 * 2**32)
        214748,     // Floor(0.00005 * 2**32)
        429496,     // Floor(0.0001  * 2**32)
        858993,     // Floor(0.0002  * 2**32)
        2147483,    // Floor(0.0005  * 2**32)
        4294967,    // Floor(0.001   * 2**32)
        8589934,    // Floor(0.002   * 2**32)
        21474836,   // Floor(0.005   * 2**32)
        42949672,   // Floor(0.01    * 2**32)
        85899345,   // Floor(0.02    * 2**32)
        214748364,  // Floor(0.05    * 2**32)
        429496729,  // Floor(0.1     * 2**32) 
        858993459,  // Floor(0.2     * 2**32)
        2147483648  // Floor(0.5     * 2**32)
    ]; 

  return out;
}
