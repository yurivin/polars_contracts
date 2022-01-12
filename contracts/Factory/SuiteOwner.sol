pragma solidity ^0.7.6;
// SPDX-License-Identifier: Apache License 2.0

import "../Common/Ownable.sol";
import "./ISuiteList.sol";

/*
SuiteOwner <|-- Ownable
/'All functions like Ownable exclude create/change suite owner and with "suite" prefix, but with
 suiteOwner logic, where we are checking ownership in SuiteList'/
class SuiteOwner {
    SuiteList suiteList
    modifier onlySuiteOwner(address msg.sender)
    +void changeSuiteList(address suiteList) onlyOwner
}
*/
contract SuiteOwner is Ownable {

    ISuiteList public _suiteList;

    function setSuiteList(address suiteListAddress) external onlyOwner {
        _suiteList = ISuiteList(suiteListAddress);
    }

    modifier onlySuiteOwner(address suiteAddress) {
        require(_suiteList.isSuiteOwner(suiteAddress, msg.sender), "Not a suite owner");
        _;
    }
}
