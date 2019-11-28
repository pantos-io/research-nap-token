pragma solidity ^0.5.13;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20Detailed.sol";

contract NapToken is ERC20, ERC20Detailed {
    constructor() ERC20Detailed("NapToken", "NAP", 18) public {}
}
