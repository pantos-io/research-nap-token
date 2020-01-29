const {
    BN,           // Big Number support
    constants,    // Common constants, like the zero address and largest integers
    expectEvent,  // Assertions for emitted events
    expectRevert, // Assertions for transactions that should fail
    ether,
} = require('@openzeppelin/test-helpers');
const {
   asyncTrieProve,
   asyncTriePut,
   newTrie,
   createRLPHeader,
   createRLPTransaction,
   createRLPReceipt
} = require('../utils');
const {expect} = require('chai');
const RLP = require('rlp');

const NapToken = artifacts.require('NapToken');
const TestRelay = artifacts.require('TestRelay');

contract('NapToken', (accounts) => {
   let sourceNapToken;
   let destinationNapToken;
   let relayContract;

   beforeEach(async () => {
      await setupContracts(1, 1);
   });

   const setupContracts = async (verifyTxResult, verifyReceiptResult) => {
      relayContract = await TestRelay.new(verifyTxResult, verifyReceiptResult);
      sourceNapToken = await NapToken.new(relayContract.address);
      destinationNapToken = await NapToken.new(relayContract.address);
      await sourceNapToken.registerContract(destinationNapToken.address);
      await destinationNapToken.registerContract(sourceNapToken.address);
   };

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
      await expectRevert(sourceNapToken.transferToChain(accounts[0], constants.ZERO_ADDRESS, web3.utils.toWei('1', 'ether')), 'contract address is not registered');
      const balance = await sourceNapToken.balanceOf(accounts[0]);
      expect(balance).to.be.bignumber.equal(ether('1'));
   });

   it('should not burn tokens if destination chain does not exist', async () => {
      await expectRevert(sourceNapToken.transferToChain(accounts[0], sourceNapToken.address, web3.utils.toWei('1', 'ether')), 'contract address is not registered');
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

      const block             = await web3.eth.getBlock(burnResult.receipt.blockHash);
      const tx                = await web3.eth.getTransaction(burnResult.tx);
      const txReceipt         = await web3.eth.getTransactionReceipt(burnResult.tx);
      const rlpHeader         = createRLPHeader(block);
      const rlpEncodedTx      = createRLPTransaction(tx);
      const rlpEncodedReceipt = createRLPReceipt(txReceipt);

      const path = RLP.encode(tx.transactionIndex);
      const rlpEncodedTxNodes = await createTxMerkleProof(block, tx.transactionIndex);
      const rlpEncodedReceiptNodes = await createReceiptMerkleProof(block, tx.transactionIndex);

      const claimResult = await destinationNapToken.transferFromChain(rlpHeader, rlpEncodedTx, rlpEncodedReceipt, rlpEncodedTxNodes, rlpEncodedReceiptNodes, path);
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

      const block             = await web3.eth.getBlock(burnResult.receipt.blockHash);
      const tx                = await web3.eth.getTransaction(burnResult.tx);
      const txReceipt         = await web3.eth.getTransactionReceipt(burnResult.tx);
      const rlpHeader         = createRLPHeader(block);
      const rlpEncodedReceipt = createRLPReceipt(txReceipt);
      const modifiedTx = {
         ...tx,
         to: destinationNapToken.address
      };
      const rlpEncodedTx = createRLPTransaction(modifiedTx);

      const path = RLP.encode(tx.transactionIndex);
      const rlpEncodedTxNodes = await createTxMerkleProof(block, tx.transactionIndex);
      const rlpEncodedReceiptNodes = await createReceiptMerkleProof(block, tx.transactionIndex);

      await expectRevert(destinationNapToken.transferFromChain(rlpHeader, rlpEncodedTx, rlpEncodedReceipt, rlpEncodedTxNodes, rlpEncodedReceiptNodes, path),
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

      const block             = await web3.eth.getBlock(burnResult.receipt.blockHash);
      const tx                = await web3.eth.getTransaction(burnResult.tx);
      const txReceipt         = await web3.eth.getTransactionReceipt(burnResult.tx);
      const rlpHeader         = createRLPHeader(block);
      const rlpEncodedTx      = createRLPTransaction(tx);
      const modifiedReceipt = {
         ...txReceipt,
         status: false
      };
      const rlpEncodedReceipt = createRLPReceipt(modifiedReceipt);

      const path = RLP.encode(tx.transactionIndex);
      const rlpEncodedTxNodes = await createTxMerkleProof(block, tx.transactionIndex);
      const rlpEncodedReceiptNodes = await createReceiptMerkleProof(block, tx.transactionIndex);

      await expectRevert(destinationNapToken.transferFromChain(rlpHeader, rlpEncodedTx, rlpEncodedReceipt, rlpEncodedTxNodes, rlpEncodedReceiptNodes, path),
          'burn transaction was not successful');

      let balance;
      balance = await sourceNapToken.balanceOf(accounts[0]);
      expect(balance).to.be.bignumber.equal(ether('0.999999999999999000'));

      balance = await destinationNapToken.balanceOf(accounts[0]);
      expect(balance).to.be.bignumber.equal(ether('1.000000000000000000'));
   });

   it('should not claim tokens if burn transaction is not included in source blockchain', async () => {
      await setupContracts(0, 1);
      const sender = accounts[0];
      const value = '1000';
      const recipient = accounts[0];

      const burnResult = await sourceNapToken.transferToChain(recipient, destinationNapToken.address, value, {
         from: sender
      });

      const block             = await web3.eth.getBlock(burnResult.receipt.blockHash);
      const tx                = await web3.eth.getTransaction(burnResult.tx);
      const txReceipt         = await web3.eth.getTransactionReceipt(burnResult.tx);
      const rlpHeader         = createRLPHeader(block);
      const rlpEncodedTx      = createRLPTransaction(tx);
      const rlpEncodedReceipt = createRLPReceipt(txReceipt);

      const path = RLP.encode(tx.transactionIndex);
      const rlpEncodedTxNodes = await createTxMerkleProof(block, tx.transactionIndex);
      const rlpEncodedReceiptNodes = await createReceiptMerkleProof(block, tx.transactionIndex);

      await expectRevert(destinationNapToken.transferFromChain(rlpHeader, rlpEncodedTx, rlpEncodedReceipt, rlpEncodedTxNodes, rlpEncodedReceiptNodes, path),
          'burn transaction does not exist');

      let balance;
      balance = await sourceNapToken.balanceOf(accounts[0]);
      expect(balance).to.be.bignumber.equal(ether('0.999999999999999000'));

      balance = await destinationNapToken.balanceOf(accounts[0]);
      expect(balance).to.be.bignumber.equal(ether('1.000000000000000000'));
   });

   it('should not claim tokens if receipt of burn transaction is not included in source blockchain', async () => {
      await setupContracts(1, 0);
      const sender = accounts[0];
      const value = '1000';
      const recipient = accounts[0];

      const burnResult = await sourceNapToken.transferToChain(recipient, destinationNapToken.address, value, {
         from: sender
      });

      const block             = await web3.eth.getBlock(burnResult.receipt.blockHash);
      const tx                = await web3.eth.getTransaction(burnResult.tx);
      const txReceipt         = await web3.eth.getTransactionReceipt(burnResult.tx);
      const rlpHeader         = createRLPHeader(block);
      const rlpEncodedTx      = createRLPTransaction(tx);
      const rlpEncodedReceipt = createRLPReceipt(txReceipt);

      const path = RLP.encode(tx.transactionIndex);
      const rlpEncodedTxNodes = await createTxMerkleProof(block, tx.transactionIndex);
      const rlpEncodedReceiptNodes = await createReceiptMerkleProof(block, tx.transactionIndex);

      await expectRevert(destinationNapToken.transferFromChain(rlpHeader, rlpEncodedTx, rlpEncodedReceipt, rlpEncodedTxNodes, rlpEncodedReceiptNodes, path),
          'burn receipt does not exist');

      let balance;
      balance = await sourceNapToken.balanceOf(accounts[0]);
      expect(balance).to.be.bignumber.equal(ether('0.999999999999999000'));

      balance = await destinationNapToken.balanceOf(accounts[0]);
      expect(balance).to.be.bignumber.equal(ether('1.000000000000000000'));
   });

   it('should not allow tokens to be claimed twice', async () => {
      const sender = accounts[0];
      const value = '1000';
      const recipient = accounts[0];

      const burnResult = await sourceNapToken.transferToChain(recipient, destinationNapToken.address, value, {
         from: sender
      });

      const block             = await web3.eth.getBlock(burnResult.receipt.blockHash);
      const tx                = await web3.eth.getTransaction(burnResult.tx);
      const txReceipt         = await web3.eth.getTransactionReceipt(burnResult.tx);
      const rlpHeader         = createRLPHeader(block);
      const rlpEncodedTx      = createRLPTransaction(tx);
      const rlpEncodedReceipt = createRLPReceipt(txReceipt);

      const path = RLP.encode(tx.transactionIndex);
      const rlpEncodedTxNodes = await createTxMerkleProof(block, tx.transactionIndex);
      const rlpEncodedReceiptNodes = await createReceiptMerkleProof(block, tx.transactionIndex);

      const claimResult = await destinationNapToken.transferFromChain(rlpHeader, rlpEncodedTx, rlpEncodedReceipt, rlpEncodedTxNodes, rlpEncodedReceiptNodes, path);
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

      await expectRevert(destinationNapToken.transferFromChain(rlpHeader, rlpEncodedTx, rlpEncodedReceipt, rlpEncodedTxNodes, rlpEncodedReceiptNodes, path),
          'tokens have already been claimed');

      let balance;
      balance = await sourceNapToken.balanceOf(accounts[0]);
      expect(balance).to.be.bignumber.equal(ether('0.999999999999999000'));

      balance = await destinationNapToken.balanceOf(accounts[0]);
      expect(balance).to.be.bignumber.equal(ether('1.000000000000001000'));
   });

   const createTxMerkleProof = async (block, transactionIndex) => {
      const trie = newTrie();

      for (let i=0; i<block.transactions.length; i++) {
         const tx = await web3.eth.getTransaction(block.transactions[i]);
         const rlpTx = createRLPTransaction(tx);
         const key = RLP.encode(i);
         await asyncTriePut(trie, key, rlpTx);
      }

      const key = RLP.encode(transactionIndex);
      return RLP.encode(await asyncTrieProve(trie, key));
   };

   const createReceiptMerkleProof = async (block, transactionIndex) => {
      const trie = newTrie();

      for (let i=0; i<block.transactions.length; i++) {
         const receipt = await web3.eth.getTransactionReceipt(block.transactions[i]);
         const rlpReceipt = createRLPReceipt(receipt);
         const key = RLP.encode(i);
         await asyncTriePut(trie, key, rlpReceipt);
      }

      const key = RLP.encode(transactionIndex);
      return RLP.encode(await asyncTrieProve(trie, key));
   }

});
