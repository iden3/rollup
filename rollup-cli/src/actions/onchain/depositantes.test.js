const chai = require('chai');
const deposit= require('./deposit.js');
const walletEthPathDefault="../../ethWallet.json"
const { expect } = chai;
const rollupabi = require ('./rollupabi.js');
const ethers = require('ethers');

const poseidonUnit = require("../../../../node_modules/circomlib/src/poseidon_gencontract.js");
const Verifier = artifacts.require("../../../../contracts/test/VerifierHelper");
const RollupTest = artifacts.require("../../../../contracts/test/RollupTest");
const TokenRollup = artifacts.require('../../../../contracts/test/TokenRollup');
/* global artifacts */
/* global contract */

contract("Rollup", async (accounts) => {

    let insPoseidonUnit;
    let insTokenRollup;
    let insRollupTest;
    let insVerifier;

  const tokenInitialAmount = 100;
  const {
      0: owner,
      1: id1,
      2: withdrawAddress,
      3: tokenList,
      4: beneficiary,
      5: onAddress,
  } = accounts;


  before(async () => {
  // Deploy poseidon
      const C = new web3.eth.Contract(poseidonUnit.abi);
      insPoseidonUnit = await C.deploy({ data: poseidonUnit.createCode() })
          .send({ gas: 2500000, from: owner });

      // Deploy TokenRollup
      insTokenRollup = await TokenRollup.new(id1, tokenInitialAmount);

      // Deploy Verifier
      insVerifier = await Verifier.new();

      // Deploy Rollup test
      insRollupTest = await RollupTest.new(insVerifier.address, insPoseidonUnit._address);

      
  });

  it("Distribute token rollup", async () => {
    await insTokenRollup.transfer(owner, 50, { from: id1 });
  });

  it("Rollup token listing", async () => {
  // Check balances token
      const resOwner = await insTokenRollup.balanceOf(owner);
      const resId1 = await insTokenRollup.balanceOf(id1);
      expect(resOwner.toString()).to.be.equal("50");
      expect(resId1.toString()).to.be.equal("50");

      // Add token to rollup token list
      const resAddToken = await insRollupTest.addToken(insTokenRollup.address,
          { from: tokenList, value: web3.utils.toWei("1", "ether") });

      expect(resAddToken.logs[0].event).to.be.equal("AddToken");
      expect(resAddToken.logs[0].args.tokenAddress).to.be.equal(insTokenRollup.address);
      expect(resAddToken.logs[0].args.tokenId.toString()).to.be.equal("0");
  });

  it("Deposit balance tree", async () => {
    // Steps:
    // - Transaction to deposit 'TokenRollup' from 'id1' to 'rollup smart contract'(owner)
    // - Check 'tokenRollup' balances
    // - Get event data
    // - Add leaf to balance tree
    // - Check 'filling on-chain' hash
    
        const addressSC =insRollupTest.address;
        //const balance = 10;
        //const tokenId = 0;
        const walletEth = await new ethers.Wallet("c5c70b480bcbecb6f43fba946fb7d989e280ca408ad3aa173c1512bcc2d08ebc") //of owner

        const password = "123";
        const Ax = BigInt(30890499764467592830739030727222305800976141688008169211302);
        const Ay = BigInt(19826930437678088398923647454327426275321075228766562806246);
        const babyjubpublic = [Ax.toString(), Ay.toString()];
        const abi = rollupabi.ABI


    
        const depositAmount = 10;
        const tokenId = 0;

        const resApprove = await insTokenRollup.approve(insRollupTest.address, depositAmount, { from: owner });
        expect(resApprove.logs[0].event).to.be.equal("Approval");

        // const resDeposit = await insRollupTest.deposit(depositAmount, tokenId, [Ax.toString(), Ay.toString()],
        //     withdrawAddress, { from: owner, value: web3.utils.toWei("1", "ether") });

     
        let resDeposit= await deposit.deposit(web3.currentProvider.host, addressSC, depositAmount, tokenId, walletEth, password, babyjubpublic, abi)

        console.log({resDeposit})
        //expect(resDeposit.logs[0].event).to.be.equal("Deposit");

        // Check token balances for id1 and rollup smart contract
        const resRollup = await insTokenRollup.balanceOf(insRollupTest.address);
        const resowner = await insTokenRollup.balanceOf(owner);
        expect(resRollup.toString()).to.be.equal("10");
        expect(resowner.toString()).to.be.equal("40");
        

        // create balance tree and add leaf
     
    });
});
