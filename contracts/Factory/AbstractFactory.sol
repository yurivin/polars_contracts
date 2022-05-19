pragma solidity ^0.7.6;

// SPDX-License-Identifier: Apache License 2.0

import "./ISuite.sol";

abstract contract AbstractFactory {
    modifier onlySuiteOwner(address suiteAddress) {
        ISuite suite = ISuite(suiteAddress);
        require(suite.owner() == msg.sender, "Caller should be suite owner");
        _;
    }

    modifier noExist(address suiteAddress, uint8 contractType) {
        ISuite suite = ISuite(suiteAddress);
        address userContract = suite.contracts(contractType);
        require(userContract == address(0), "Contract already exist");
        _;
    }

    event ContractCreated(
        address suiteAddress,
        address contractAddress,
        string contractType
    );
}
