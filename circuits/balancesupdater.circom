
/* This circuit will check there is enough balance in the oldStAmount to transfer
   the amount and the fee. newAmount is the amount remaining into the state.
   effectiveAmount is the amount that actually is transfered.

   In an onChain Transaction, no errors are allowed, so in case it is not enough money,
   it will do a 0 transfer.

   In case of an offChain TX the system does not allow it.

   Overflow of < 2^192 is not feasible since deposits amounts can not be above 2^128
*/

include "../node_modules/circomlib/circuits/bitify.circom";
include "../node_modules/circomlib/circuits/comparators.circom";
include "./feetableselector.circom";

template BalancesUpdater() {
    signal input oldStAmountSender;
    signal input oldStAmountReceiver;
    signal input amount;
    signal input loadAmount;
    signal input fee;
    signal input onChain;
    signal input nop;

    signal output newStAmountSender;
    signal output newStAmountReceiver;
    signal output update2;
    signal output fee2Charge; // amount of fee that needs to be discounted

    signal feeApplies;        // 1 If fee applies (offChain), 0 if not applies (onChain)      

    signal limitsOk;        // 1 if from is > 0
    signal txOk;            // If both are ok.

    signal effectiveAmount1;
    signal effectiveAmount2;
    signal effectiveLoadAmount;

    component n2bSender = Num2Bits(193);
    component effectiveAmountIsZero = IsZero();

    component n2bFee = Num2Bits(193 + 32);

    feeApplies <== (1-onChain)*(1-nop);  // Fee applies only on offChainTx and is not a NOP
 
    component feeTableSelector = FeeTableSelector();
    feeTableSelector.feeSel <== fee*feeApplies;

    n2bFee.in <== amount * feeTableSelector.feeOut;

    component b2nFee = Bits2Num(193);
    for (var i = 0; i < 193; i++) {
        b2nFee.in[i] <== n2bFee.out[i + 32];
    }
    b2nFee.out ==> fee2Charge;

    effectiveLoadAmount <== loadAmount*onChain;
    effectiveAmount1 <== amount*(1-nop);

    // Check limits and fees on limits
    n2bSender.in <== (1<<192) + oldStAmountSender + effectiveLoadAmount - effectiveAmount1 - fee2Charge;

    limitsOk <== n2bSender.out[192];

    txOk <== limitsOk;

    // if not onChain and not txOk => error
    (1-txOk)*(1-onChain) === 0;

    effectiveAmount2 <== txOk*effectiveAmount1;

    effectiveAmountIsZero.in <== effectiveAmount2;

    // if !txOk then return 0;
    newStAmountSender <== oldStAmountSender + effectiveLoadAmount - effectiveAmount2 - fee2Charge;
    newStAmountReceiver <== oldStAmountReceiver + effectiveAmount2

    update2 <== 1-effectiveAmountIsZero.out;
}
