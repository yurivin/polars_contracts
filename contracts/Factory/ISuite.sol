pragma solidity ^0.7.6;

// SPDX-License-Identifier: Apache License 2.0

interface ISuite {
    function owner() external view returns (address);

    function addContract(bytes32 contractType, address contractAddress)
        external;
}
