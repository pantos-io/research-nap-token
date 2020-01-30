# NAP - A true cross-blockchain token
> _Important: NAP is a research prototype. 
  It represents ongoing work conducted within the [TAST](https://dsg.tuwien.ac.at/projects/tast/) 
  research project. Use with care._

[![Build Status](https://travis-ci.org/pantos-io/nap-token.svg?branch=master)](https://travis-ci.org/pantos-io/nap-token)

This project contains a proof of concept implementation of a true [cross-blockchain token](https://dsg.tuwien.ac.at/projects/tast/pub/tast-white-paper-5.pdf).
That is, holders of the token can decide on which blockchains they want to hold their tokens
with the ability to freely transfer tokens from one chain to another.

The token differs from atomic swaps in the sense that tokens are not exchanged between two
different users on different blockchains, but rather the same token can be transferred to another blockchain
with no other user involved.

The workflow of transferring a token from one chain to another consists of the following steps.
1. Burn tokens on the source blockchain.
2. Create a [Simplified Payment Verification (SPV)]() of the transaction burning the tokens.
3. Claim the tokens on the destination blockchain using the SPV of the burn transaction.
    * If the SPV is _valid_, the tokens (re-)created on the destination blockchain.
    * If the SPV is _invalid_, the claim is denied.
    
Evidently, the smart contract on the destination blockchain implementing the token needs a way to
reliably validate SPVs for the source blockchain. 

For this, NAP makes use of [Testimonium](https://www.github.com/pantos-io/testimonium)––a blockchain relay
which continuously relays block headers from the source blockchain to the destination blockchain. 
Testimonium makes sure that SPVs cannot be submitted for illegal block headers of the source blockchain in a 
fully decentralized manner.

So far, NAP consists of a smart contract implemented in Solidity, as such it is available for Ethereum-based blockchains.

## Get Started
### Deployment
1. Clone the repository: `git clone git@github.com:pantos-io/nap-token.git`
2. Change into the project directory: `cd nap-token/`
3. Install all dependencies: `npm install`
4. Deploy contracts: `truffle migrate --reset`

### Testing
Run the tests with `truffle test --network test`.


## API
For transferring tokens between two blockchains, the contract offers the following two methods.

#### Transfer to chain (Burn)
```
function transferToChain(
    address recipient,
    address destinationContract,
    uint value
) public;
```
This method burns tokens of the sender and emits an event that can be used to claim the tokens on the destination blockchain. 

The sender has to provide the address of the recipient (`recipient`) and the address of the NAP contract (`destinationContract`) on the destination blockchain,
as well as the amount the user wishes to transfer (`value`). 

#### Transfer from chain (Claim)
```
function transferFromChain(
    bytes memory rlpHeader,
    bytes memory rlpTx,
    bytes memory rlpReceipt, 
    bytes memory rlpMerkleProofTx,
    bytes memory rlpMerkleProofReceipt,
    bytes memory path
) public payable;
```
This method can be used to claim tokens on the destination blockchain.
As mentioned before, the sender has to provide a valid SPV to the destination blockchain.

The SPV consists of the RLP-encoded block header of the source blockchain presumably containing the burn transaction (`rlpHeader`),
the RLP-encoded burn transaction itself (`rlpTx`) together with its (RLP-encoded) transaction receipt (`rlpReceipt`), 
as well as Merkle proofs contesting the inclusion of the burn transaction and receipt 
within the provided block header (`rlpMerkleProofTx`, `rlpMerkleProofReceipt`, and `path`).

Internally, the provided information is parsed to check whether the transaction is actually a successful burn transaction. 
Then the SPV proof is passed to the Testimonium relay to verify that the transaction (and receipt)
are actually part of the source blockchain.

#### ERC20 Token
Besides the ability to transfer tokens between different blockchains, 
NAP further implements the popular [ERC20](https://eips.ethereum.org/EIPS/eip-20) standard.

## How to contribute
NAP is a research prototype. We welcome anyone to contribute.
File a bug report or submit feature requests through the [issue tracker](https://github.com/pantos-io/nap-token/issues). 
If you want to contribute feel free to submit a pull request.

## Acknowledgements
The development of this prototype was funded by [Pantos](https://pantos.io/) within the [TAST](https://dsg.tuwien.ac.at/projects/tast/) research project.
Further, the contract uses the [RLPReader](https://github.com/hamdiallam/Solidity-RLP) library from Hamdi Allam
and the [ERC20 token implementation](https://github.com/OpenZeppelin/openzeppelin-contracts) from OpenZeppelin.

## Licence
This project is licensed under the [MIT License](LICENSE).
