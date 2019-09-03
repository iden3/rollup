/* eslint-disable no-underscore-dangle */
/* eslint-disable no-await-in-loop */
/* global artifacts */
/* global contract */
/* global web3 */

const chai = require('chai');

const { expect } = chai;
const RollupPoS = artifacts.require('../contracts/test/RollupPoSTest');

async function getEtherBalance(address) {
  let balance = await web3.eth.getBalance(address);
  balance = web3.utils.fromWei(balance, 'ether');
  return Number(balance);
}

// async function getTxGasSpent(resTx) {
//   const infoTx = await web3.eth.getTransaction(resTx.tx);
//   const { gasPrice } = infoTx;
//   const gasSpent = gasPrice * resTx.receipt.gasUsed;
//   return Number(web3.utils.fromWei(gasSpent.toString(), 'ether'));
// }

contract('RollupPoS', (accounts) => {
  const {
    6: relayStaker,
    7: beneficiaryAddress,
  } = accounts;

  let insRollupPoS;

  const addressRollupTest = '0x0000000000000000000000000000000000000001';
  const operators = [];
  const eraBlock = [];
  const eraSlot = [];
  const hashChain = [];
  const blockPerEra = 2000;
  const slotPerEra = 20;
  const amountToStake = 2;

  const initialMsg = 'rollup';
  hashChain.push(web3.utils.keccak256(initialMsg));
  for (let i = 1; i < 10; i++) {
    hashChain.push(web3.utils.keccak256(hashChain[i - 1]));
  }

  before(async () => {
    // Deploy token test
    insRollupPoS = await RollupPoS.new(addressRollupTest);
    // Initialization
    // fill with first block of each era
    const genesisBlockNum = await insRollupPoS.genesisBlock();
    for (let i = 0; i < 20; i++) {
      eraBlock.push(i * blockPerEra + Number(genesisBlockNum) + 1);
      eraSlot.push(i * slotPerEra + 1);
    }
    // fill 5 addresses for operators
    for (let i = 1; i < 6; i++) {
      operators.push({ address: accounts[i], idOp: (i - 1).toString() });
    }
    // set first era block
    await insRollupPoS.setBlockNumber(eraBlock[0]);
  });

  describe('functionalities', () => {
    it('add operator', async () => {
      let initBalOp = await getEtherBalance(operators[0].address);
      // add operator 0 with eStake = 4
      await insRollupPoS.addOperator(hashChain[9],
        { from: operators[0].address, value: web3.utils.toWei(amountToStake.toString(), 'ether') });
      const balOpAdd = await getEtherBalance(operators[0].address);
      expect(Math.ceil(balOpAdd)).to.be.equal(Math.ceil(initBalOp) - 2);
      // get back stake
      await insRollupPoS.setBlockNumber(eraBlock[3]);
      // try to get back stake from different operator
      try {
        await insRollupPoS.removeOperator(operators[0].idOp, { from: operators[1].address });
      } catch (error) {
        expect((error.message).includes('Sender does not match with operator controller')).to.be.equal(true);
      }
      initBalOp = await getEtherBalance(operators[0].address);
      await insRollupPoS.removeOperator(operators[0].idOp, { from: operators[0].address });

      // Era to remove operator
      await insRollupPoS.setBlockNumber(eraBlock[4]);
      try {
        await insRollupPoS.withdraw(0);
      } catch (error) {
        expect((error.message).includes('Era to withdraw after current era')).to.be.equal(true);
      }
      // Era to remove operator
      await insRollupPoS.setBlockNumber(eraBlock[5]);
      await insRollupPoS.withdraw(0);

      const balOpWithdraw = await getEtherBalance(operators[0].address);
      expect(Math.ceil(initBalOp)).to.be.equal(Math.ceil(balOpWithdraw) - 2);
    });

    it('add operator with different benefiacry address', async () => {
      const initBalance = await getEtherBalance(beneficiaryAddress);
      await insRollupPoS.setBlockNumber(eraBlock[5]);
      // add operator 1 with eStake = 4
      await insRollupPoS.addOperatorWithDifferentBeneficiary(beneficiaryAddress, hashChain[9],
        { from: operators[1].address, value: web3.utils.toWei(amountToStake.toString(), 'ether') });
      await insRollupPoS.setBlockNumber(eraBlock[6]);
      await insRollupPoS.removeOperator(1, { from: operators[1].address });
      await insRollupPoS.setBlockNumber(eraBlock[8]);
      await insRollupPoS.withdraw(1);
      // Check balance beneficiary Address
      const balance = await getEtherBalance(beneficiaryAddress);
      expect(initBalance + 2).to.be.equal(balance);
    });

    it('add operator with different benefiacry address and relay staker', async () => {
      const initBalanceRelay = await getEtherBalance(relayStaker);
      const initBalOp = await getEtherBalance(operators[2].address);
      const initBalBeneficiary = await getEtherBalance(beneficiaryAddress);
      await insRollupPoS.setBlockNumber(eraBlock[8]);
      // add operator 2 with stakerAddress commiting 2 ether
      await insRollupPoS.addOperatorRelay(operators[2].address, beneficiaryAddress, hashChain[9],
        { from: relayStaker, value: web3.utils.toWei(amountToStake.toString(), 'ether') });

      const balanceRelay0 = await getEtherBalance(relayStaker);
      const balOp0 = await getEtherBalance(operators[2].address);
      const balBeneficiary0 = await getEtherBalance(beneficiaryAddress);
      // check balances of all addresses
      expect(Math.ceil(initBalanceRelay) - 2).to.be.equal(Math.ceil(balanceRelay0));
      expect(initBalOp).to.be.equal(balOp0);
      expect(initBalBeneficiary).to.be.equal(balBeneficiary0);
      // sign ethereum message and build signature
      const hashMsg = web3.utils.soliditySha3('RollupPoS', 'remove', { type: 'uint32', value: operators[2].idOp });
      const sigOp = await web3.eth.sign(hashMsg, operators[2].address);
      const r = sigOp.substring(0, 66);
      const s = `0x${sigOp.substring(66, 130)}`;
      const v = Number(sigOp.substring(130, 132)) + 27;
      // remove operator and withdraw
      await insRollupPoS.setBlockNumber(eraBlock[7]);
      await insRollupPoS.removeOperatorRelay(operators[2].idOp, r, s, v.toString());
      await insRollupPoS.setBlockNumber(eraBlock[9]);
      await insRollupPoS.withdraw(operators[2].idOp);
      // check
      const balanceRelay1 = await getEtherBalance(relayStaker);
      const balOp1 = await getEtherBalance(operators[2].address);
      const balBeneficiary1 = await getEtherBalance(beneficiaryAddress);
      expect(balanceRelay0).to.be.equal(balanceRelay1);
      expect(balOp1).to.be.equal(balOp1);
      expect(balBeneficiary0 + 2).to.be.equal(balBeneficiary1);
    });
  });
});
