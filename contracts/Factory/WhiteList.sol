pragma solidity ^0.7.6;

// SPDX-License-Identifier: Apache License 2.0

import "../Common/Ownable.sol";

contract WhiteList is Ownable {
    mapping(uint8 => address) public _allowedFactories;

    function add(uint8 factoryType, address factoryAddress) external onlyOwner {
        _allowedFactories[factoryType] = factoryAddress;
    }

    function remove(uint8 factoryType) external onlyOwner {
        _allowedFactories[factoryType] = address(0);
    }
}
