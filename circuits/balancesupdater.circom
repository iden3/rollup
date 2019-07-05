
/* This circuit will check there is enough balance in the oldStAmount to transfer
   the amount and the fee. newAmount is the amount remaining into the state.
   effectiveAmount is the amount that actually is transfered.

   In an inChain Transaction, no errors are allowed, so in case it is not enough money,
   it will do a 0 transfer.

   In case of an offChan TX the system does not allow it.

   It also checks overflow of < 2^126
*/

include "node_modules/circom/circuits/bitify.circom";

template BalancesUpdater() {
    signal input oldStAmountSender;
    signal input oldStAmountRecieiver;
    signal input amount;
    signal input fee;
    signal input inChain;

    signal output newStAmountSender;
    signal output newStAmountReceiver;

    signal txOk;

    component n2bSender = Num2Bits(127);
    component n2bReceiver = Num2Bits(127);

    n2bSender.in <== (1<<126) + oldStAmountSender - (amount + fee);

    n2bReceiver.in <== oldStAmountRecieiver + amount;

    txOk = (1-n2bSender.out[126]) * (1-n2bSender.out[126])

    // if inChain and not txOk => error
    (1-txOk)*(1-inChain) == 0

    // if !txOk then return 0;
    newStAmountSender <== oldStAmount - (fee + amount)*txOk;
    newStAmountReceiver <== oldStAmountRecieiver - amount
}
