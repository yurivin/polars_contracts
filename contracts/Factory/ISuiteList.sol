pragma solidity ^0.7.6;

// SPDX-License-Identifier: Apache License 2.0

import "./SuiteOwner.sol";

interface ISuiteList {
    function addSuite(address suiteAddress, address suiteOwner) external;

    function deleteSuite(address suiteAddress) external;

    function getSuitePage(uint256 startIndex, uint256 count)
        external
        view
        returns (address[] memory);

    function setSuiteFactory(address factoryAddress) external;

    function _whiteList() external view returns (address);

    function changeSuiteOwner(address suiteAddress, address candidateAddress)
        external;

    function isSuiteOwner(address suiteAddress, address candidateAddress)
        external
        view
        returns (bool);
}
