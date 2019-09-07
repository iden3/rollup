
/* This circuit will check there is enough balance in the oldStAmount to transfer
   the amount and the fee. newAmount is the amount remaining into the state.
   effectiveAmount is the amount that actually is transfered.

   In an onChain Transaction, no errors are allowed, so in case it is not enough money,
   it will do a 0 transfer.

   In case of an offChan TX the system does not allow it.

   It also checks overflow of < 2^126
*/

include "../node_modules/circomlib/circuits/bitify.circom";
include "../node_modules/circomlib/circuits/comparators.circom";

template BalancesUpdater() {
    signal input oldStAmountSender;
    signal input oldStAmountRecieiver;
    signal input amount;
    signal input loadAmount;
    signal input maxFee;
    signal input minFee;
    signal input onChain;
    signal input countersIn;
    signal input countersBase;

    signal output newStAmountSender;
    signal output newStAmountReceiver;
    signal output countersOut;
    signal output update2;

    signal limitsOk;
    signal feeOk;
    signal txOk;

    component n2bSender = Num2Bits(127);
    component n2bReceiver = Num2Bits(127);
    component feeGE = GreaterEqThan(128);
    component amountIsZero = IsZero();

    amountIsZero.in <== amount;

    // Only apply fee if amount >0
    signal applyFee;
    applyFee <== minFee*(1- amountIsZero.out);

    n2bSender.in <== (1<<126) + oldStAmountSender + loadAmount - (amount + applyFee);
    n2bReceiver.in <== oldStAmountRecieiver + amount;

    feeGE.in[0] <== maxFee;
    feeGE.in[1] <== applyFee;

    feeOk <== feeGE.out;
    limitsOk <== (n2bSender.out[126])*(1-n2bReceiver.out[126]);

    txOk <== feeOk * limitsOk;

    // if not onChain and not txOk => error
    (1-txOk)*(1-onChain) === 0;

    // if !txOk then return 0;
    newStAmountSender <== oldStAmountSender + loadAmount - (applyFee + amount)*txOk;
    newStAmountReceiver <== oldStAmountRecieiver + amount*txOk

    // Counters
    countersOut <== countersIn + countersBase*(1- amountIsZero.out);
    update2 <== txOk * (1 - amountIsZero.out);

}
