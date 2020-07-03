include "../node_modules/circomlib/circuits/bitify.circom";
include "../node_modules/circomlib/circuits/pointbits.circom";

template Test(){

    signal input compressedPoint;
    signal input element2;

    signal output ax;
    signal output ay;

    // toBits element 1
    component n2bElement1 = Num2Bits(254);
    n2bElement1.in <== compressedPoint;

    // decode element 2
        // ethAddress 0..159
        // sign       160 
    component n2bElement2 = Num2Bits(161);
    n2bElement2.in <== element2;

    signal sign;
    sign <== n2bElement2.out[160];

    component toPoint = Bits2Point_Strict();

    // insert compressed
    var i;

    for (i = 0; i < 254; i++) {
        toPoint.in[i] <== n2bElement1.out[i];
    }
    
    toPoint.in[254] <== 0;
    toPoint.in[255] <== sign;

    toPoint.out[0] ==> ax;
    toPoint.out[1] ==> ay;
}