const chai = require('chai');
const deposit= require('./deposit.js');
const walletEthPathDefault="../../ethWallet.json"
const walletBabyjubPathDefault="../../babyjubWallet.json"
const { expect } = chai;
const rollupabi = require ('./rollupabi.js');
const ethers = require('ethers');
const fs = require('fs');


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
    let walletEth;

  const tokenInitialAmount = 100;
  const {
      0: owner,
      1: id1,
      2: withdrawAddress,
      3: tokenList,
      4: beneficiary,
      5: onAddress,
      6: providerfunds,
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

      walletEth = await ethers.Wallet.fromEncryptedJson(fs.readFileSync(walletEthPathDefault, "utf8"), "foo");
      

  });

  it("Distribute token rollup", async () => {
    await insTokenRollup.transfer(walletEth.address, 50, { from: id1 });
  });

  it("Rollup token listing", async () => {
  // Check balances token
      const resWalletEth = await insTokenRollup.balanceOf(walletEth.address);
      const resId1 = await insTokenRollup.balanceOf(id1);
      expect(resWalletEth.toString()).to.be.equal("50");
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
        
        const password = "foo";
        // const Ax = BigInt(30890499764467592830739030727222305800976141688008169211302);
        // const Ay = BigInt(19826930437678088398923647454327426275321075228766562806246);
        // const babyjubJson = [Ax.toString(), Ay.toString()];
        const babyjubJson= fs.readFileSync(walletBabyjubPathDefault, "utf8")
        const abi = rollupabi.ABI
        const addressSC =insRollupTest.address;

        const depositAmount = 10;
        const tokenId = 0;
    
        web3.eth.sendTransaction({to:walletEth.address, from:providerfunds, value: web3.utils.toWei("5", "ether")})//provide funds to our account
        
        //const resApprove = await insTokenRollup.approve(insRollupTest.address, depositAmount, { from: walletEth.address });
        const tx = {
            from:  walletEth.address, 
            // target address, this could be a smart contract address
            gasLimit: web3.utils.toHex(800000), // Raise the gas limit to a much higher amount
            gasPrice: web3.utils.toHex(web3.utils.toWei('10', 'gwei')),
            to: insTokenRollup.address, 
            // optional if you want to specify the gas limit 
            data: insTokenRollup.contract.methods.approve(insRollupTest.address, depositAmount).encodeABI() 
          };

    
        let signPromise = await web3.eth.accounts.signTransaction(tx, walletEth.privateKey);
        const sentTx = await web3.eth.sendSignedTransaction(signPromise.rawTransaction).on('receipt', console.log);;

       
        //expect(sentTx.logs[0].event).to.be.equal("Approval");

        

        // const resDeposit = await insRollupTest.deposit(depositAmount, tokenId, [Ax.toString(), Ay.toString()],
        //     withdrawAddress, { from: owner, value: web3.utils.toWei("1", "ether") });

     
        let resDeposit= await deposit.deposit(web3.currentProvider.host, addressSC, depositAmount, tokenId, fs.readFileSync(walletEthPathDefault, "utf8"), babyjubJson,password, abi)


       // console.log({resDeposit})


        //devuelve el from


        //expect(resDeposit.logs[0].event).to.be.equal("Deposit");

        // Check token balances for id1 and rollup smart contract
        const resRollup = await insTokenRollup.balanceOf(insRollupTest.address);
        const resWalletEth = await insTokenRollup.balanceOf(walletEth.address);
        expect(resRollup.toString()).to.be.equal("10");
        expect(resWalletEth.toString()).to.be.equal("40");
        

        // create balance tree and add leaf
     
    });
});
