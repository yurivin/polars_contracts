pragma solidity ^0.7.6;
// SPDX-License-Identifier: Apache License 2.0

import "../Common/Ownable.sol";
import "./ISuiteFactory.sol";
import "./ISuite.sol";
import "../SafeMath.sol";

contract SuiteList is Ownable {
    using SafeMath for uint256;

    address[] public _suites;
    ISuiteFactory public _suiteFactory;
    address public _whiteList;
    mapping(address => uint256) public _suiteIndexes;
    mapping(address => address) public _suiteOwners;

    mapping(address => uint256[]) public _suiteIndexesByUserMap;
    mapping(address => address[]) public _suitesMap2;

    constructor(address suiteFactory) {
        _suiteFactory = ISuiteFactory(suiteFactory);
    }

    fallback() external {
        // solhint-disable-next-line reason-string
        revert();
    }

    modifier onlyOwnerOrSuiteOwner(address suiteAddress) {
        require(
            _isSuiteOwner(suiteAddress) || isOwner(),
            "only Gov or suite owner can call"
        );
        _;
    }

    modifier onlyOwnerOrSuiteFactory() {
        require(
            _isSuiteFactory() || isOwner(),
            "Only Gov or SuiteFactory can call"
        );
        _;
    }

    modifier onlySuiteFactory() {
        require(_isSuiteFactory(), "only SuiteFactory can call");
        _;
    }

    function addSuite(address suiteAddress, address suiteOwner)
        external
        onlyOwnerOrSuiteFactory
    {
        uint256 index = _suites.length;
        _suites.push(suiteAddress);
        _suiteIndexes[suiteAddress] = index;
        _suiteOwners[suiteAddress] = suiteOwner;
        _suiteIndexesByUserMap[suiteOwner].push(index);
    }

    function deleteSuite(address suiteAddress)
        external
        onlyOwnerOrSuiteOwner(suiteAddress)
    {
        require(_isSuiteExists(suiteAddress), "Suite not exists");

        uint256 index = _suiteIndexes[suiteAddress];
        delete _suiteIndexes[suiteAddress];
        // delete _suiteOwners[suiteAddress];

        if (index >= _suites.length) {
            return;
        }

        uint256 lastIndex = _suites.length - 1;

        if (index != lastIndex) {
            // delete _suites[index];
            _suites[index] = _suites[lastIndex];
        }

        _suites.pop();
    }

    function isSuiteExists(address suiteAddress) external view returns (bool) {
        return _isSuiteExists(suiteAddress);
    }

    function _isSuiteExists(address suiteAddress) internal view returns (bool) {
        if (_suites.length == 0) return false;
        uint256 suiteIndex = _suiteIndexes[suiteAddress];
        return _suites[suiteIndex] == suiteAddress;
    }

    function getSuitesCount() external view returns (uint256) {
        return _suites.length;
    }

    function getUserSuitesCount(address user) external view returns (uint256) {
        return _suiteIndexesByUserMap[user].length;
    }

    function getUserSuitesByPage(
        address user,
        uint256 startIndex,
        uint256 count
    ) external view returns (address[] memory) {
        require(count <= 30, "Count must be less than 30");
        require(
            startIndex < _suites.length,
            "Start index must be less than suites length"
        );
        uint256 border = startIndex.add(count);

        if (border > _suiteIndexesByUserMap[user].length) {
            border = _suiteIndexesByUserMap[user].length;
        }
        uint256 returnCount = border.sub(startIndex);
        address[] memory result = new address[](returnCount);

        for (uint256 i = startIndex; i < border; i++) {
            uint256 currentIndex = i - startIndex;
            uint256 currentSuite = _suiteIndexesByUserMap[user][i];
            result[currentIndex] = _suites[currentSuite];
        }
        return result;
    }

    function getSuitesByPage(uint256 startIndex, uint256 count)
        external
        view
        returns (address[] memory)
    {
        require(count <= 30, "Count must be less than 30");
        require(
            startIndex < _suites.length,
            "Start index must be less than suites length"
        );
        uint256 border = startIndex.add(count);

        if (border > _suites.length) {
            border = _suites.length;
        }
        uint256 returnCount = border.sub(startIndex);
        address[] memory result = new address[](returnCount);

        for (uint256 i = startIndex; i < border; i++) {
            uint256 currentIndex = i - startIndex;
            result[currentIndex] = _suites[i];
        }
        return result;
    }

    function setSuiteFactory(address factoryAddress) external onlyOwner {
        _suiteFactory = ISuiteFactory(factoryAddress);
    }

    function setWhiteList(address whiteList) external onlyOwner {
        _whiteList = whiteList;
    }

    function changeSuiteOwner(address suiteAddress, address candidateAddress)
        external
        // onlySuiteOwner(suiteAddress)
    {
        _suiteOwners[suiteAddress] = candidateAddress;
    }

    function _isSuiteOwner(address suiteAddress) internal view returns (bool) {
        return ISuite(suiteAddress).owner() == msg.sender;
    }

    function isSuiteOwner(address suiteAddress) external view returns (bool) {
        return _isSuiteOwner(suiteAddress);
    }

    function _isSuiteFactory() internal view returns (bool) {
        return address(_suiteFactory) == msg.sender;
    }
}
