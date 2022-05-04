pragma solidity ^0.7.6;

// SPDX-License-Identifier: Apache License 2.0

import "./ISuite.sol";

abstract contract AbstractFactory {
    modifier onlySuiteOwner(address suiteAddress) {
        ISuite _suite = ISuite(suiteAddress);
        require(_suite.owner() == msg.sender, "Caller should be suite owner");
        _;
    }

    modifier noExist(address suiteAddress, bytes32 contractType) {
        ISuite _suite = ISuite(suiteAddress);
        address factoryContract = _suite.contracts(contractType);
        require(factoryContract == address(0), "Contract already exist");
        _;
    }

    event ContractCreated(
        address suiteAddress,
        address contractAddress,
        string contractType
    );
}
