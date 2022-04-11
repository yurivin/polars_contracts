pragma solidity ^0.7.6;

// SPDX-License-Identifier: Apache License 2.0

interface ISuiteFactory {
    function deploySuite() external returns (address);

    function setSuiteList(address suiteList) external;
}
