pragma solidity ^0.5.13;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20Detailed.sol";
import "solidity-rlp/contracts/RLPReader.sol";
import "./RelayContract.sol";

contract NapToken is ERC20, ERC20Detailed {
    using RLPReader for RLPReader.RLPItem;
    using RLPReader for bytes;

    struct Claim {
        address burnContract;
        address recipient;
        uint value;
        bool valid;
    }

    RelayContract relay;
    address otherContract;
    mapping(bytes32 => bool) claimedTransactions;

    constructor(address _relayAddress) ERC20Detailed("NapToken", "NAP", 18) public {
        relay = RelayContract(_relayAddress);

        otherContract = address(this);
        _mint(msg.sender, 1 ether); // Nap Token and Ether have same number of decimals
    }

    // For simplicity, use this function to register the "other" contract.
    // This has obvious security implications as any one is able to change this address.
    // Maybe change to a more sophisticated, "contract registry" later on.
    function registerContract(address _contractAddress) public {
        require(_contractAddress != address(0), "contract address must not be zero address");
        otherContract = _contractAddress;
    }

    function transferToChain(address recipient, address destinationContract, uint value) public {
        require(destinationContract == otherContract, "contract address is not registered");
        _burn(msg.sender, value);
        emit ChainTransfer(address(this), destinationContract, recipient);
    }

    function transferFromChain(
        bytes memory rlpHeader,
        bytes memory rlpEncodedTx,
        bytes memory rlpEncodedReceipt,
        bytes memory rlpMerkleProofTx,
        bytes memory rlpMerkleProofReceipt,
        bytes memory path
    ) public payable {

        Claim memory c = extractClaim(rlpEncodedTx, rlpEncodedReceipt);

        // check pre-conditions
        require(claimedTransactions[keccak256(rlpEncodedTx)] == false, "tokens have already been claimed");
        require(c.burnContract == otherContract, "contract address is not registered");
        require(c.valid == true, "burn transaction was not successful");

        // verify inclusion of transfer transaction
        uint txExists = relay.verifyTransaction(0, rlpHeader, 0, rlpEncodedTx, path, rlpMerkleProofTx);
        require(txExists == 1, "burn transaction does not exist");

        // verify inclusion of receipt
        uint receiptExists = relay.verifyReceipt(0, rlpHeader, 0, rlpEncodedReceipt, path, rlpMerkleProofReceipt);
        require(receiptExists == 1, "burn receipt does not exist");

        // mint tokens to recipient
        claimedTransactions[keccak256(rlpEncodedTx)] = true; // IMPORTANT: invalidate tx for further claims
        _mint(c.recipient, c.value);
        emit ChainTransfer(c.burnContract, address(this), c.recipient);
    }

    function extractClaim(bytes memory rlpTransaction, bytes memory rlpReceipt) private returns (Claim memory) {
        Claim memory c;
        // parse transaction
        RLPReader.RLPItem[] memory tx = rlpTransaction.toRlpItem().toList();
        c.burnContract = tx[3].toAddress();

        // parse receipt
        RLPReader.RLPItem[] memory receipt = rlpReceipt.toRlpItem().toList();
        c.valid = receipt[3].toBoolean();

        // read logs
        RLPReader.RLPItem[] memory logs = receipt[2].toList();
        RLPReader.RLPItem[] memory transferEvent = logs[0].toList();
        RLPReader.RLPItem[] memory chainEvent = logs[1].toList();

        // read value and recipient from transfer and chain event
        c.value = transferEvent[2].toUint();
        c.recipient = address(chainEvent[2].toUint());

        return c;
    }

    event ChainTransfer(address indexed source, address indexed destination, address recipient);
}
