const RLP = require('rlp');
const Web3 = require('web3');
const web3 = new Web3(Web3.givenProvider || 'https://mainnet.infura.io', null, {});
const BN = web3.utils.BN;
const {Transaction} = require('ethereumjs-tx');
const Trie = require('merkle-patricia-tree');

const RLP_TRUE = '0x01';
const RLP_FALSE = '0x00';
// const BigNumber = require('bignumber.js');

// const calculateBlockHash = (block) => {
//     return web3.utils.keccak256(createRLPHeader(block));
// };

// const addToHex = (hexString, number) => {
//   return web3.utils.toHex((new BigNumber(hexString).plus(number)));
// };

const createRLPHeader = (block) => {
    return RLP.encode([
        block.parentHash,
        block.sha3Uncles,
        block.miner,
        block.stateRoot,
        block.transactionsRoot,
        block.receiptsRoot,
        block.logsBloom,
        new BN(block.difficulty),
        new BN(block.number),
        block.gasLimit,
        block.gasUsed,
        block.timestamp,
        block.extraData,
        block.mixHash,
        block.nonce,
    ]);
};
const createRLPHeaderWithoutNonce = (block) => {
    return RLP.encode([
        block.parentHash,
        block.sha3Uncles,
        block.miner,
        block.stateRoot,
        block.transactionsRoot,
        block.receiptsRoot,
        block.logsBloom,
        new BN(block.difficulty),
        new BN(block.number),
        block.gasLimit,
        block.gasUsed,
        block.timestamp,
        block.extraData,
    ]);
};

const createRLPTransaction = (tx) => {
    const txData = {
      nonce: tx.nonce,
      gasPrice: web3.utils.toHex(new BN(tx.gasPrice)),
      gasLimit: tx.gas,
      to: tx.to,
      value: web3.utils.toHex(new BN(tx.value)),
      data: tx.input,
      v: tx.v,
      r: tx.r,
      s: tx.s
    };
    const transaction = new Transaction(txData);
    return transaction.serialize();
};

const createRLPReceipt = (receipt) => {
    return RLP.encode([
        receipt.gasUsed,
        receipt.logsBloom,
        convertLogs(receipt.logs),
        receipt.status ? RLP_TRUE : RLP_FALSE  // convert boolean to binary
    ]);
};

const newTrie = () => {
    return new Trie();
};

const asyncTriePut = (trie, key, value) => {
    return new Promise((resolve, reject) => {
        trie.put(key, value, (err) => {
            if (err != null) reject(err);
            resolve();
        });
    });
};

const asyncTrieProve = (trie, key) => {
    return new Promise((resolve, reject) => {
        Trie.prove(trie, key, (err, p) => {
            if (err != null) reject(err);
            resolve(p)
        });
    });
};

const asyncTrieGet = (trie, key) => {
    return new Promise((resolve, reject) => {
        trie.get(key, (err, value) => {
            if (err != null) reject(err);
            resolve(value);
        })
    })
};

const convertLogs = (logs) => {
    const convertedLogs = [];
    for (const log of logs) {
        convertedLogs.push([
            log.address,
            log.topics,
            log.data
        ]);
    }
    return convertedLogs;
};

module.exports = {
    // calculateBlockHash,
    createRLPHeader,
    createRLPHeaderWithoutNonce,
    createRLPTransaction,
    createRLPReceipt,
    newTrie,
    asyncTriePut,
    asyncTrieGet,
    asyncTrieProve
    // addToHex
};
