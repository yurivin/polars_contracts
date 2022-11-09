pragma solidity ^0.7.6;

// SPDX-License-Identifier: Apache License 2.0

import "./Suite.sol";
import "./ISuiteList.sol";
import "../IPredictionPool.sol";
import "../IEventLifeCycle.sol";
import "../ILeverage.sol";
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

    event CommissionChanged(uint256 newValue);

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

        Suite suite = new Suite(
            suiteName,
            collateralTokenAddress,
            _suiteList._whiteList()
        );

        emit SuiteDeployed(suiteName, address(suite), msg.sender);

        require(
            _commissionToken.transferFrom(
                msg.sender,
                address(this),
                _commissionAmount
            ),
            "Transfer commission failed"
        );

        suite.transferOwnership(msg.sender);
        _suiteList.addSuite(address(suite), msg.sender);

        return address(suite);
    }

    function setSuiteList(address suiteListAddress) external onlyOwner {
        _suiteList = ISuiteList(suiteListAddress);
    }

    function setCommission(uint256 amount) external onlyOwner {
        _commissionAmount = amount;
        emit CommissionChanged(amount);
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

    function enablePendingOrders(address suiteAddress) external {
        Suite suite = Suite(suiteAddress);
        address suiteOwner = suite.owner();

        require(suiteOwner == msg.sender, "Caller should be suite owner");

        address predictionPoolAddress = suite.contracts(
            1 // id for PREDICTION_POOL
        );

        require(
            predictionPoolAddress != address(0),
            "You must create PredictionPool contract"
        );

        address pendingOrdersAddress = suite.contracts(
            3 // id for PENDING_ORDERS
        );

        require(
            pendingOrdersAddress != address(0),
            "You must create PendingOrders contract"
        );

        address eventLifeCycleAddress = suite.contracts(
            2 // id for EVENT_LIFE_CYCLE
        );

        require(
            eventLifeCycleAddress != address(0),
            "You must create EventLifeCycle contract"
        );

        IPredictionPool ipp = IPredictionPool(predictionPoolAddress);
        IEventLifeCycle elc = IEventLifeCycle(eventLifeCycleAddress);

        require(
            (ipp._blackBought() == 0 && ipp._whiteBought() == 0),
            "The action is not available while there are orders in the PredictionPool"
        );

        ipp.changeOrderer(pendingOrdersAddress);
        ipp.setOnlyOrderer(true);

        elc.setPendingOrders(pendingOrdersAddress, true);
    }

    function enableLeverage(address suiteAddress) external {
        Suite suite = Suite(suiteAddress);
        address suiteOwner = suite.owner();

        require(suiteOwner == msg.sender, "Caller should be suite owner");

        address eventLifeCycleAddress = suite.contracts(
            2 // id for EVENT_LIFE_CYCLE
        );

        require(
            eventLifeCycleAddress != address(0),
            "You must create EventLifeCycle contract"
        );

        address leverageAddress = suite.contracts(
            4 // id for LEVERAGE
        );

        require(
            leverageAddress != address(0),
            "You must create Leverage contract"
        );

        IEventLifeCycle elc = IEventLifeCycle(eventLifeCycleAddress);
        elc.setLeverage(leverageAddress, true);
    }

    function leverageChangeMaxUsageThreshold(
        address suiteAddress,
        uint256 percent
    ) external {
        Suite suite = Suite(suiteAddress);
        address suiteOwner = suite.owner();

        require(suiteOwner == msg.sender, "Caller should be suite owner");

        address leverageAddress = suite.contracts(
            4 // id for LEVERAGE
        );

        require(
            leverageAddress != address(0),
            "You must create Leverage contract"
        );

        ILeverage levc = ILeverage(leverageAddress);

        levc.changeMaxUsageThreshold(percent);
    }

    function leverageChangeMaxLossThreshold(
        address suiteAddress,
        uint256 percent
    ) external {
        Suite suite = Suite(suiteAddress);
        address suiteOwner = suite.owner();

        require(suiteOwner == msg.sender, "Caller should be suite owner");

        address leverageAddress = suite.contracts(
            4 // id for LEVERAGE
        );

        require(
            leverageAddress != address(0),
            "You must create Leverage contract"
        );

        ILeverage levc = ILeverage(leverageAddress);

        levc.changeMaxLossThreshold(percent);
    }
}
