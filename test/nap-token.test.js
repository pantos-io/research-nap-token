const {
    BN,           // Big Number support
    constants,    // Common constants, like the zero address and largest integers
    expectEvent,  // Assertions for emitted events
    expectRevert, // Assertions for transactions that should fail
    ether,
} = require('@openzeppelin/test-helpers');
const {expect} = require('chai');
const {createRLPHeader, createRlpReceipt} = require('../utils');

const NapToken = artifacts.require('NapToken');
const TestRelay = artifacts.require('TestRelay');

contract('NapToken', (accounts) => {
   let sourceNapToken;
   let destinationNapToken;
   let relayContract;

   beforeEach(async () => {
      relayContract = await TestRelay.deployed();
      sourceNapToken = await NapToken.new(relayContract.address);
      destinationNapToken = await NapToken.new(relayContract.address);
      await sourceNapToken.registerContract(destinationNapToken.address);
      await destinationNapToken.registerContract(sourceNapToken.address);
   });

   it('should deploy the source and destination contracts correctly', async () => {
      let balance;
      balance = await sourceNapToken.balanceOf(accounts[0]);
      expect(balance).to.be.bignumber.equal(ether('1'));

      balance = await destinationNapToken.balanceOf(accounts[0]);
      expect(balance).to.be.bignumber.equal(ether('1'));
   });

   it('should burn tokens correctly', async () => {
      const sender = accounts[0];
      const value = '1000';
      const recipient = accounts[0];
      const result = await sourceNapToken.transferToChain(recipient, destinationNapToken.address, value, {
         from: sender
      });
      const balance = await sourceNapToken.balanceOf(sender);
      expect(balance).to.be.bignumber.equal(ether('0.999999999999999000'));
      expectEvent(result.receipt, 'Transfer', {
         from: sender,
         to: constants.ZERO_ADDRESS,
         value: value,
      });
      expectEvent(result.receipt, 'ChainTransfer', {
         source: sourceNapToken.address,
         destination: destinationNapToken.address,
         recipient: recipient
      });
   });

   it('should not burn tokens if user has not enough tokens', async () => {
      await expectRevert(sourceNapToken.transferToChain(accounts[0], destinationNapToken.address, web3.utils.toWei('2', 'ether')), 'ERC20: burn amount exceeds balance');
      const balance = await sourceNapToken.balanceOf(accounts[0]);
      expect(balance).to.be.bignumber.equal(ether('1'));
   });

   it('should not burn tokens if destination chain is zero address', async () => {
      await expectRevert(sourceNapToken.transferToChain(accounts[0], constants.ZERO_ADDRESS, web3.utils.toWei('2', 'ether')), 'contract address must not be zero address');
      const balance = await sourceNapToken.balanceOf(accounts[0]);
      expect(balance).to.be.bignumber.equal(ether('1'));
   });

   it('should not burn tokens if destination chain does not exist', async () => {
      await expectRevert(sourceNapToken.transferToChain(accounts[0], sourceNapToken.address, web3.utils.toWei('2', 'ether')), 'contract address is not registered');
      const balance = await sourceNapToken.balanceOf(accounts[0]);
      expect(balance).to.be.bignumber.equal(ether('1'));
   });

   it('should claim tokens correctly', async () => {
      const sender = accounts[0];
      const value = '1000';
      const recipient = accounts[0];

      const burnResult = await sourceNapToken.transferToChain(recipient, destinationNapToken.address, value, {
         from: sender
      });

      const block = await web3.eth.getBlock(burnResult.receipt.blockHash);
      const rlpHeader = createRLPHeader(block);
      const tx = await web3.eth.getTransaction(burnResult.tx);
      const rlpEncodedTx = await createRlpEncodedTx(tx);
      const rlpEncodedReceipt = createRlpReceipt(burnResult.receipt);

      // let rlpEncodedTx, rlpEncodedReceipt, rlpEncodedTxNodes, rlpEncodedReceiptNodes, path;
      const claimResult = await destinationNapToken.transferFromChain(rlpHeader, rlpEncodedTx, rlpEncodedReceipt);//, rlpEncodedTxNodes, rlpEncodedReceiptNodes, path);
      expectEvent(claimResult.receipt, 'Transfer', {
         from: constants.ZERO_ADDRESS,
         to: recipient,
         value: value,
      });
      expectEvent(claimResult.receipt, 'ChainTransfer', {
         source: sourceNapToken.address,
         destination: destinationNapToken.address,
         recipient: recipient
      });

      let balance;
      balance = await sourceNapToken.balanceOf(accounts[0]);
      expect(balance).to.be.bignumber.equal(ether('0.999999999999999000'));

      balance = await destinationNapToken.balanceOf(accounts[0]);
      expect(balance).to.be.bignumber.equal(ether('1.000000000000001000'));
   });

   it('should not claim tokens if the contract that burnt the tokens does not exist', async () => {
      const sender = accounts[0];
      const value = '1000';
      const recipient = accounts[0];

      const burnResult = await sourceNapToken.transferToChain(recipient, destinationNapToken.address, value, {
         from: sender
      });

      const block = await web3.eth.getBlock(burnResult.receipt.blockHash);
      const tx = await web3.eth.getTransaction(burnResult.tx);
      const modifiedTx = {
         ...tx,
         to: destinationNapToken.address
      };
      const rlpEncodedTx = await createRlpEncodedTx(modifiedTx);
      const rlpHeader = createRLPHeader(block);
      const rlpEncodedReceipt = createRlpReceipt(burnResult.receipt);

      // let rlpEncodedTx, rlpEncodedReceipt, rlpEncodedTxNodes, rlpEncodedReceiptNodes, path;
      await expectRevert(destinationNapToken.transferFromChain(rlpHeader, rlpEncodedTx, rlpEncodedReceipt/*, rlpEncodedTxNodes, rlpEncodedReceiptNodes, path*/),
          'contract address is not registered');

      let balance;
      balance = await sourceNapToken.balanceOf(accounts[0]);
      expect(balance).to.be.bignumber.equal(ether('0.999999999999999000'));

      balance = await destinationNapToken.balanceOf(accounts[0]);
      expect(balance).to.be.bignumber.equal(ether('1.000000000000000000'));
   });

   it('should not claim tokens if burn transaction was not successful', async () => {
      const sender = accounts[0];
      const value = '1000';
      const recipient = accounts[0];

      const burnResult = await sourceNapToken.transferToChain(recipient, destinationNapToken.address, value, {
         from: sender
      });

      const block = await web3.eth.getBlock(burnResult.receipt.blockHash);
      const tx = await web3.eth.getTransaction(burnResult.tx);
      const rlpEncodedTx = await createRlpEncodedTx(tx);
      const rlpHeader = createRLPHeader(block);
      const modifiedReceipt = {
         ...burnResult.receipt,
         status: false
      };
      const rlpEncodedReceipt = createRlpReceipt(modifiedReceipt);

      // let rlpEncodedTx, rlpEncodedReceipt, rlpEncodedTxNodes, rlpEncodedReceiptNodes, path;
      await expectRevert(destinationNapToken.transferFromChain(rlpHeader, rlpEncodedTx, rlpEncodedReceipt/*, rlpEncodedTxNodes, rlpEncodedReceiptNodes, path*/),
          'burn transaction was not successful');

      let balance;
      balance = await sourceNapToken.balanceOf(accounts[0]);
      expect(balance).to.be.bignumber.equal(ether('0.999999999999999000'));

      balance = await destinationNapToken.balanceOf(accounts[0]);
      expect(balance).to.be.bignumber.equal(ether('1.000000000000000000'));
   });

   it('should not claim tokens if burn transaction is not included in source blockchain', async () => {
      const sender = accounts[0];
      const value = '1000';
      const recipient = accounts[0];

      const burnResult = await sourceNapToken.transferToChain(recipient, destinationNapToken.address, value, {
         from: sender
      });

      const block = await web3.eth.getBlock(burnResult.receipt.blockHash);
      const tx = await web3.eth.getTransaction(burnResult.tx);
      const rlpEncodedTx = await createRlpEncodedTx(tx);
      const rlpHeader = createRLPHeader(block);
      const rlpEncodedReceipt = createRlpReceipt(burnResult.receipt);

      // let rlpEncodedTx, rlpEncodedReceipt, rlpEncodedTxNodes, rlpEncodedReceiptNodes, path;
      await expectRevert(destinationNapToken.transferFromChain(rlpHeader, rlpEncodedTx, rlpEncodedReceipt/*, rlpEncodedTxNodes, rlpEncodedReceiptNodes, path*/),
          'burn transaction does not exist');

      let balance;
      balance = await sourceNapToken.balanceOf(accounts[0]);
      expect(balance).to.be.bignumber.equal(ether('0.999999999999999000'));

      balance = await destinationNapToken.balanceOf(accounts[0]);
      expect(balance).to.be.bignumber.equal(ether('1.000000000000000000'));
   });

   it('should not claim tokens if receipt of burn transaction is not included in source blockchain', async () => {
      const sender = accounts[0];
      const value = '1000';
      const recipient = accounts[0];

      const burnResult = await sourceNapToken.transferToChain(recipient, destinationNapToken.address, value, {
         from: sender
      });

      const block = await web3.eth.getBlock(burnResult.receipt.blockHash);
      const tx = await web3.eth.getTransaction(burnResult.tx);
      const rlpEncodedTx = await createRlpEncodedTx(tx);
      const rlpHeader = createRLPHeader(block);
      const rlpEncodedReceipt = createRlpReceipt(burnResult.receipt);

      // let rlpEncodedTx, rlpEncodedReceipt, rlpEncodedTxNodes, rlpEncodedReceiptNodes, path;
      await expectRevert(destinationNapToken.transferFromChain(rlpHeader, rlpEncodedTx, rlpEncodedReceipt/*, rlpEncodedTxNodes, rlpEncodedReceiptNodes, path*/),
          'burn receipt does not exist');

      let balance;
      balance = await sourceNapToken.balanceOf(accounts[0]);
      expect(balance).to.be.bignumber.equal(ether('0.999999999999999000'));

      balance = await destinationNapToken.balanceOf(accounts[0]);
      expect(balance).to.be.bignumber.equal(ether('1.000000000000000000'));
   });

   const createRlpEncodedTx = async (tx) => {
      const signedTransaction = await web3.eth.accounts.signTransaction({
         nonce: tx.nonce,
         gasPrice: tx.gasPrice,
         gas: tx.gas,
         to: tx.to,
         value: tx.value,
         input: tx.input
      }, '0x4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362311');  // private key can be anything if the transaction is not sent
      return web3.utils.hexToBytes(signedTransaction.rawTransaction);
   };

});
