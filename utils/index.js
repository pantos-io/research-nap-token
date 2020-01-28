const RLP = require('rlp');
const Web3 = require('web3');
const web3 = new Web3(Web3.givenProvider || 'https://mainnet.infura.io', null, {});
const BN = web3.utils.BN;
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

const createRlpReceipt = (receipt) => {
    return RLP.encode([
        receipt.gasUsed,
        receipt.logsBloom,
        convertLogs(receipt.rawLogs),
        receipt.status ? 1 : 0  // convert boolean to binary
    ]);
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
    createRlpReceipt
    // addToHex
};
