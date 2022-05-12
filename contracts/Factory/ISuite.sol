pragma solidity ^0.7.6;

// SPDX-License-Identifier: Apache License 2.0

interface ISuite {
    function owner() external view returns (address);

    function contracts(uint8 contractType) external view returns (address);

    function _collateralTokenAddress() external returns (address);

    function _suiteFactoryAddress() external returns (address);

    function addContract(uint8 contractType, address contractAddress) external;
}
