pragma solidity ^0.7.6;

// SPDX-License-Identifier: Apache License 2.0

import "../SafeMath.sol";
import "../PredictionCollateralization.sol";

abstract contract AbstractFactory {
    using SafeMath for uint256;

    struct ContractStruct {
        bytes32 nameType;
        address factoryAddress;
        bool enabled;
    }

    ContractStruct public aUser;

    mapping(address => ContractStruct) public _contractStructs;

    uint256 public _count = 0;

    event ContractCreated(
        address suiteAddress,
        address contractAddress,
        string contractType
    );

    function getContractTypesCount() public view returns (uint256 count) {
        return _count;
    }
}
