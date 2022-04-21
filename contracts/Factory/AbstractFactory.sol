pragma solidity ^0.7.6;

// SPDX-License-Identifier: Apache License 2.0

import "./ISuite.sol";

abstract contract AbstractFactory {
    modifier onlySuiteOwner(address suiteAddress) {
        ISuite _suite = ISuite(suiteAddress);
        require(_suite.owner() == msg.sender, "Caller should be suite owner");
        _;
    }

    event ContractCreated(
        address suiteAddress,
        address contractAddress,
        string contractType
    );
}
