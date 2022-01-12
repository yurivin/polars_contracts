pragma solidity ^0.7.6;
// SPDX-License-Identifier: Apache License 2.0

import "../Common/Ownable.sol";
import "./ISuiteFactory.sol";
import "./SuiteOwner.sol";

contract SuiteList is SuiteOwner {

    address[] public _suites;
    ISuiteFactory public _suiteFactory;
    mapping(address => uint256) public _suiteIndexes;
    mapping(address => address) public _suiteOwners;

    constructor(
        address suiteFactory
    ) {
        _suiteFactory = ISuiteFactory(suiteFactory);
    }
    fallback() external {
        revert();
    }

    modifier onlySuiteFactoryOrOwner() {
        require(msg.sender == address(_suiteFactory) || isOwner(), "Only SuiteFactory or Owner can call");
        _;
    }

    modifier modifierOwnerOrSuiteOwner(address suiteAddress) {
        require(isOwner() || _isSuiteOwner(suiteAddress, msg.sender), "only Owner or suiteOwner can call");
        _;
    }

    function addSuite(address suiteAddress, address suiteOwner) external onlySuiteFactoryOrOwner() {
        _suites.push(suiteAddress);
        _suiteIndexes[suiteAddress] = _suites.length - 1;
        _suiteOwners[suiteAddress] = suiteOwner;
    }

    function deleteUserSeries(address suiteAddress) external modifierOwnerOrSuiteOwner(suiteAddress) {
        require(_suiteIndexes[suiteAddress] != 0, "Not exists");

        uint256 index = _suiteIndexes[suiteAddress];
        delete _suiteIndexes[suiteAddress];
        delete _suiteOwners[suiteAddress];

        if (index >= _suites.length) {
            return;
        }

        uint256 lastIndex = _suites.length-1;

        if (index != lastIndex) {
            delete _suites[index];
            _suites[index] = _suites[lastIndex];
        }

        _suites.pop();
    }

    function getSuitePage(uint256 startIndex, uint256 count) external view returns(address[] memory) {
        address[] memory result = new address[](count);
        uint256 border = startIndex + count;
        for(uint256 i = startIndex; i < border; i++) {
            result[i - startIndex] = _suites[i];
        }
        return result;
    }

    function setSuiteFactory(address factoryAddress) external onlyOwner {
        _suiteFactory = ISuiteFactory(factoryAddress);
    }

    function changeSuiteOwner(address suiteAddress, address candidateAddress) external onlySuiteOwner(suiteAddress) {
        _suiteOwners[suiteAddress] = candidateAddress;
    }

    function _isSuiteOwner(address suiteAddress, address candidateAddress) internal view returns (bool){
        return _suiteOwners[suiteAddress] == candidateAddress;
    }

    function isSuiteOwner(address suiteAddress, address candidateAddress) external view returns (bool){
        _isSuiteOwner(suiteAddress, candidateAddress);
    }


} 
