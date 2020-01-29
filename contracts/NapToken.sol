pragma solidity ^0.5.13;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20Detailed.sol";
import "solidity-rlp/contracts/RLPReader.sol";
import "./RelayContract.sol";

contract NapToken is ERC20, ERC20Detailed {
    using RLPReader for RLPReader.RLPItem;
    using RLPReader for bytes;

    RelayContract relay;
    address otherContract;

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

    function transferFromChain(
        bytes memory rlpHeader,
        bytes memory rlpEncodedTx,
        bytes memory rlpEncodedReceipt
//        bytes memory rlpEncodedTxNodes,
//        bytes memory rlpEncodedReceiptNodes,
//        bytes memory path
    ) public payable {
        // parse transaction
        RLPReader.RLPItem[] memory tx = rlpEncodedTx.toRlpItem().toList();
        address burnContract = tx[3].toAddress();

        // parse receipt
        RLPReader.RLPItem[] memory receipt = rlpEncodedReceipt.toRlpItem().toList();
        bool status = receipt[3].toBoolean();
        RLPReader.RLPItem[] memory logs = receipt[2].toList();

        // read logs
        RLPReader.RLPItem[] memory transferEvent = logs[0].toList();
        RLPReader.RLPItem[] memory chainEvent = logs[1].toList();

        // read value from transfer event
        uint value = transferEvent[2].toUint();

        // read recipient from chain event
        address recipient = address(chainEvent[2].toUint());

        // check pre-conditions
        require(burnContract == otherContract, "contract address is not registered");
        require(status == true, "burn transaction was not successful");
        // todo: verify inclusion of transfer transaction
        // todo: verify inclusion of receipt

        // mint tokens to recipient
        _mint(recipient, value);
        emit ChainTransfer(burnContract, address(this), recipient);
        emit BurnSuccessful(status, value);
    }

    function transferToChain(address recipient, address destinationContract, uint value) public {
        require(destinationContract == otherContract, "contract address is not registered");
        _burn(msg.sender, value);
        emit ChainTransfer(address(this), destinationContract, recipient);
    }

    event ChainTransfer(address indexed source, address indexed destination, address recipient);
    event BurnSuccessful(bool status, uint value);
}
