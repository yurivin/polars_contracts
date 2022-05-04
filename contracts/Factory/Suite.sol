pragma solidity ^0.7.6;

// SPDX-License-Identifier: Apache License 2.0

import "../Common/Ownable.sol";
import "./WhiteList.sol";

contract Suite is Ownable {
    WhiteList public _whiteList;

    string public _suiteName;
    address public _collateralTokenAddress;
    address public _suiteFactoryAddress;

    modifier onlyWhiteListed(bytes32 contractType) {
        require(
            _whiteList._allowedFactories(contractType) == msg.sender,
            "Caller should be in White List"
        );
        _;
    }

    mapping(bytes32 => address) public contracts;

    constructor(
        string memory suiteName,
        address collateralTokenAddress,
        address whiteList
    ) {
        _suiteName = suiteName;
        _collateralTokenAddress = collateralTokenAddress;
        _suiteFactoryAddress = msg.sender; // suiteFactory
        _whiteList = WhiteList(whiteList);
    }

    function addContract(bytes32 contractType, address contractAddress)
        external
        onlyWhiteListed(contractType)
    {
        contracts[contractType] = contractAddress;
    }
}
