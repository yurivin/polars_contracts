pragma solidity ^0.7.6;

// SPDX-License-Identifier: Apache License 2.0

import "./Suite.sol";
import "./ISuiteList.sol";
import "../Common/IERC20.sol";

contract SuiteFactory is Ownable {
    ISuiteList public _suiteList;
    IERC20 public _commissionToken;
    uint256 public _commissionAmount;

    constructor(address token, uint256 amount) {
        _commissionToken = IERC20(token);
        _commissionAmount = amount;
    }

    event SuiteDeployed(
        string suiteName,
        address suiteAddress,
        address suiteOwner
    );

    function deploySuite(
        string memory suiteName,
        address collateralTokenAddress
    ) external returns (address) {
        require(
            _suiteList._whiteList() != address(0),
            "WhiteList address not defined"
        );
        require(bytes(suiteName).length > 0, "Parameter suiteName is null");
        require(
            _commissionToken.balanceOf(msg.sender) >= _commissionAmount,
            "You don't have enough commission tokens for the action"
        );
        require(
            _commissionToken.allowance(msg.sender, address(this)) >=
                _commissionAmount,
            "Not enough delegated commission tokens for the action"
        );
        require(
            _commissionToken.transferFrom(
                msg.sender,
                address(this),
                _commissionAmount
            ),
            "Transfer commission failed"
        );
        Suite _suite = new Suite(
            suiteName,
            collateralTokenAddress,
            _suiteList._whiteList()
        );
        _suite.transferOwnership(msg.sender);
        emit SuiteDeployed(suiteName, address(_suite), msg.sender);
        _suiteList.addSuite(address(_suite), msg.sender);

        return address(_suite);
    }

    function setSuiteList(address suiteListAddress) external onlyOwner {
        _suiteList = ISuiteList(suiteListAddress);
    }

    function setCommission(uint256 amount) external onlyOwner {
        _commissionAmount = amount;
    }

    function setComissionToken(address token) external onlyOwner {
        _commissionToken = IERC20(token);
    }

    function withdrawComission() public onlyOwner {
        uint256 balance = _commissionToken.balanceOf(address(this));
        require(
            _commissionToken.transfer(msg.sender, balance),
            "Unable to transfer"
        );
    }
}
