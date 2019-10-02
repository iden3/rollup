
/* This circuit will check there is enough balance in the oldStAmount to transfer
   the amount and the fee. newAmount is the amount remaining into the state.
   effectiveAmount is the amount that actually is transfered.

   In an onChain Transaction, no errors are allowed, so in case it is not enough money,
   it will do a 0 transfer.

   In case of an offChan TX the system does not allow it.

   It also checks overflow of < 2^192
*/

include "../node_modules/circomlib/circuits/bitify.circom";
include "../node_modules/circomlib/circuits/comparators.circom";

template BalancesUpdater() {
    signal input oldStAmountSender;
    signal input oldStAmountRecieiver;
    signal input amount;
    signal input loadAmount;
    signal input userFee;
    signal input operatorFee;
    signal input onChain;
    signal input nop;
    signal input countersIn;
    signal input countersBase;

    signal output newStAmountSender;
    signal output newStAmountReceiver;
    signal output countersOut;
    signal output update2;

    signal feeApplies;      // 1 If fee applies (offChain) 0 if not applies (onChain)
    signal appliedFee;      // amount of fee that needs to be discounted

    signal limitsOk;        // 1 if from is >0 and <2**192
    signal feeOk;           // If userFee > operatorFee
    signal txOk;            // If both are ok.

    signal effectiveAmount1;
    signal effectiveAmount2;
    signal effectiveLoadAmount;

    component n2bSender = Num2Bits(193);
    component feeGE = GreaterEqThan(128);
    component effectiveAmountIsZero = IsZero();

    feeApplies <== (1-onChain)*(1-nop);  // Fee applies only on onChainTx and is not a NOP

    appliedFee <== operatorFee*feeApplies;

    effectiveLoadAmount <== loadAmount*onChain;
    effectiveAmount1 <== amount*(1-nop);

    // Check limits and fees on limits
    n2bSender.in <== (1<<192) + oldStAmountSender + effectiveLoadAmount - effectiveAmount1 - appliedFee;

    // Fee offered by the user must be greater that the operators demanded
    feeGE.in[0] <== userFee;
    feeGE.in[1] <== operatorFee;

    feeOk <== feeGE.out + (1-feeApplies) - feeGE.out*(1-feeApplies);     // Is greater or does not apply
    limitsOk <== n2bSender.out[192];

    txOk <== feeOk * limitsOk;

    // if not onChain and not txOk => error
    (1-txOk)*(1-onChain) === 0;

    effectiveAmount2 <== txOk*effectiveAmount1;

    effectiveAmountIsZero.in <== effectiveAmount2;

    // if !txOk then return 0;
    newStAmountSender <== oldStAmountSender + effectiveLoadAmount - effectiveAmount2 - appliedFee;
    newStAmountReceiver <== oldStAmountRecieiver + effectiveAmount2

    // Counters
    countersOut <== countersIn + countersBase*feeApplies;
    update2 <== 1-effectiveAmountIsZero.out;

}
