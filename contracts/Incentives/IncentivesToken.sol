// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./IncentiveERC20.sol";
import "../SafeERC20.sol";

contract IncentivesToken is IncentiveERC20 {
    constructor(
        string memory name,
        string memory symbol,
        uint256 initialSupply
    ) IncentiveERC20(name, symbol) {
        _mint(msg.sender, initialSupply);
    }
}