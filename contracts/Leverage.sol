pragma solidity ^0.7.4;

// "SPDX-License-Identifier: MIT"

import "./Common/IERC20.sol";
import "./DSMath.sol";
import "./Common/Ownable.sol";
import "./LeverageToken.sol";
import "./IPendingOrders.sol";
import "./IEventLifeCycle.sol";
import "./IPredictionPool.sol";

contract Leverage is DSMath, Ownable, LeverageTokenERC20 {
    IERC20 public _collateralToken;
    IPendingOrders public _pendingOrders;
    IEventLifeCycle public _eventLifeCycle;
    IPredictionPool public _predictionPool;

    uint256 public _maxUsageThreshold = 0.2 * 1e18; // Default 20%
    uint256 public _maxLossThreshold = 0.5 * 1e18; // Default 50%

    uint256 public _lpTokens = 0; // in 1e18
    uint256 public _collateralTokens = 0; // in 1e18

    uint256 public _predictionPoolFee = 0;

    bool public _onlyCurrentEvent = true;

    uint256 public _priceChangePart = 0.05 * 1e18; // Default 0.05%

    struct CrossOrder {
        /* solhint-disable prettier/prettier */
        address orderer;        // address of user placing order
        uint256 cross;          // multiplicator
        uint256 ownAmount;      // amount of user`s collateral tokens
        uint256 borrowedAmount; // amount of given collateral tokens
        bool isWhite;           // TRUE for white side, FALSE for black side
        uint256 eventId;        // order target eventId
        bool isCanceled;        // FALSE when placed, TRUE when canceled
        /* solhint-enable prettier/prettier */
    }

    uint256 public _ordersCounter = 0;

    // mapping from order ID to Cross Order detail
    mapping(uint256 => CrossOrder) public _crossOrders;

    // // mapping from user address to order IDs for that user
    mapping(address => uint256[]) public _crossOrdersOfUser;

    struct CrossEvent {
        /* solhint-disable prettier/prettier */
        uint256 eventId;
        uint256 whitePriceBefore;       // price of white token before the event
        uint256 blackPriceBefore;       // price of black token before the event
        uint256 whitePriceAfter;        // price of white token after the event
        uint256 blackPriceAfter;        // price of black token after the event
        uint256 blackCollateralAmount;  // total amount of collateral for black side of the event
        uint256 whiteCollateralAmount;  // total amount of collateral for white side of the event
        bool isStarted;                 // FALSE before the event, TRUE after the event start
        bool isEnded;                   // FALSE before the event, TRUE after the event end
        /* solhint-enable prettier/prettier */
    }

    mapping(uint256 => CrossEvent) public _events;

    // Modifier to ensure call has been made by event contract
    modifier onlyEventContract() {
        require(
            msg.sender == address(_eventLifeCycle),
            "LEVERAGE: CALLER SHOULD BE EVENT CONTRACT"
        );
        _;
    }

    event OrderCreated(
        address user,
        uint256 maxLoss,
        uint256 priceChangePart,
        uint256 cross,
        uint256 ownAmount,
        uint256 orderAmount
    );
    event OrderCanceled(uint256 id, address user);
    event AddLiquidity(
        address user,
        uint256 lpAmount,
        uint256 colaterallAmount
    );
    event WithdrawLiquidity(
        address user,
        uint256 lpAmount,
        uint256 colaterallAmount
    );
    event CollateralWithdrew(uint256 amount, address user, address caller);

    constructor(address collateralTokenAddress, address pendingOrdersAddress) {
        require(
            collateralTokenAddress != address(0),
            "Collateral token address should not be null"
        );
        require(
            pendingOrdersAddress != address(0),
            "PendingOrders address should not be null"
        );

        _collateralToken = IERC20(collateralTokenAddress);
        _pendingOrders = IPendingOrders(pendingOrdersAddress);
        _eventLifeCycle = IEventLifeCycle(
            _pendingOrders._eventContractAddress()
        );
        _predictionPool = IPredictionPool(_pendingOrders._predictionPool());

        _predictionPoolFee = _predictionPool.FEE();

        _collateralToken.approve(address(_pendingOrders), type(uint256).max);
    }

    function getOngoingEvent() public view returns (uint256, uint256) {
        /* solhint-disable prettier/prettier */
        (
            uint256 priceChangePart,
            , // uint256 eventStartTimeExpected
            , // uint256 eventEndTimeExpected
            , // string blackTeam
            , // string whiteTeam
            , // string eventType
            , // string eventSeries
            , // string eventName
            uint256 gameEventId
        ) = _eventLifeCycle._ongoingEvent();
        /* solhint-enable prettier/prettier */
        return (priceChangePart, gameEventId);
    }

    function isPendingEnabled() public view returns (bool) {
        return (_eventLifeCycle._usePendingOrders() &&
            _eventLifeCycle._pendingOrders() == address(_pendingOrders));
    }

    function createOrder(
        uint256 amount,
        bool isWhite,
        uint256 maxLoss,
        uint256 eventId
    ) external {
        require(
            maxLoss <= _maxLossThreshold,
            "LEVERAGE: MAX LOSS PERCENT IS VERY BIG"
        );

        require(
            _collateralToken.balanceOf(msg.sender) >= amount,
            "LEVERAGE: NOT ENOUGH COLLATERAL IN USER ACCOUNT"
        );
        require(
            _collateralToken.allowance(msg.sender, address(this)) >= amount,
            "LEVERAGE: NOT ENOUGHT DELEGATED TOKENS"
        );

        uint256 cross = wdiv(maxLoss, _priceChangePart);
        uint256 orderAmount = wmul(amount, cross);

        uint256 userBorrowAmount = sub(orderAmount, amount);

        require(
            _collateralToken.balanceOf(address(this)) >= userBorrowAmount,
            "LEVERAGE: NOT ENOUGH COLLATERAL BALANCE FOR BORROW"
        );

        /* solhint-disable prettier/prettier */
        _crossOrders[_ordersCounter] = CrossOrder(
            msg.sender,         // address orderer
            cross,              // uint256 cross
            amount,             // uint256 ownAmount
            userBorrowAmount,   // uint256 borrowedAmount
            isWhite,            // bool    isWhite
            eventId,            // uint256 eventId
            false
        );
        /* solhint-enable prettier/prettier */

        _events[eventId].eventId = eventId;

        _crossOrdersOfUser[msg.sender].push(_ordersCounter);

        _ordersCounter += 1;

        /* solhint-disable prettier/prettier */
        isWhite
            ? _events[eventId].whiteCollateralAmount = add(_events[eventId].whiteCollateralAmount, orderAmount)
            : _events[eventId].blackCollateralAmount = add(_events[eventId].blackCollateralAmount, orderAmount);
        /* solhint-enable prettier/prettier */

        _collateralToken.transferFrom(msg.sender, address(this), amount);
        emit OrderCreated(
            msg.sender,
            maxLoss,
            _priceChangePart,
            cross,
            amount,
            orderAmount
        );
    }

    function cancelOrder(uint256 orderId) external {
        CrossOrder memory order = _crossOrders[orderId];
        require(msg.sender == order.orderer, "LEVERAGE: NOT YOUR ORDER");

        require(!order.isCanceled, "LEVERAGE: ORDER HAS ALREADY BEEN CANCELED");

        CrossEvent memory eventById = _events[order.eventId];

        require(!eventById.isEnded, "LEVERAGE: EVENT ALREADY ENDED");

        require(!eventById.isStarted, "LEVERAGE: EVENT IN PROGRESS");

        uint256 totalAmount = add(order.ownAmount, order.borrowedAmount);

        /* solhint-disable prettier/prettier */
        order.isWhite
            ? _events[order.eventId].whiteCollateralAmount = sub(eventById.whiteCollateralAmount, totalAmount)
            : _events[order.eventId].blackCollateralAmount = sub(eventById.blackCollateralAmount, totalAmount);
        /* solhint-enable prettier/prettier */

        _crossOrders[orderId].isCanceled = true;

        _collateralToken.transfer(order.orderer, order.ownAmount);
        emit OrderCanceled(orderId, msg.sender);
    }

    function withdrawCollateral(address user) external returns (uint256) {
        require(
            _crossOrdersOfUser[user].length > 0,
            "LEVERAGE: ACCOUNT HAS NO ORDERS"
        );

        // total amount of collateral token that should be returned to user
        // feeAmount should be subtracted before actual return
        uint256 totalWithdrawAmount = 0;

        uint256 i = 0;
        while (i < _crossOrdersOfUser[user].length) {
            uint256 _oId = _crossOrdersOfUser[user][i]; // order ID
            CrossOrder memory order = _crossOrders[_oId];
            uint256 _eId = order.eventId; // event ID
            CrossEvent memory eventDetail = _events[_eId];

            // calculate and sum up collaterals to be returned
            // exclude canceled orders, only include executed orders
            if (!order.isCanceled && eventDetail.isEnded) {
                uint256 withdrawAmount = 0;
                uint256 priceAfter = 0;
                uint256 priceBefore = 0;

                uint256 orderAmount = add(
                    order.ownAmount,
                    order.borrowedAmount
                );

                if (order.isWhite) {
                    priceBefore = eventDetail.whitePriceBefore;
                    priceAfter = eventDetail.whitePriceAfter;
                } else {
                    priceBefore = eventDetail.blackPriceBefore;
                    priceAfter = eventDetail.blackPriceAfter;
                }

                withdrawAmount = sub(
                    orderAmount,
                    wmul(orderAmount, _predictionPoolFee)
                );
                withdrawAmount = wdiv(withdrawAmount, priceBefore);
                withdrawAmount = wmul(withdrawAmount, priceAfter);
                withdrawAmount = sub(
                    withdrawAmount,
                    wmul(withdrawAmount, _predictionPoolFee)
                );
                withdrawAmount = sub(withdrawAmount, order.borrowedAmount);
                totalWithdrawAmount = add(totalWithdrawAmount, withdrawAmount);
            }

            // pop IDs of canceled or executed orders from ordersOfUser array
            if (_crossOrders[_oId].isCanceled || eventDetail.isEnded) {
                delete _crossOrdersOfUser[user][i];
                _crossOrdersOfUser[user][i] = _crossOrdersOfUser[user][
                    _crossOrdersOfUser[user].length - 1
                ];
                _crossOrdersOfUser[user].pop();

                delete _crossOrders[_oId];
            } else {
                i++;
            }
        }
        _collateralToken.transfer(user, totalWithdrawAmount);

        emit CollateralWithdrew(totalWithdrawAmount, user, msg.sender);

        return totalWithdrawAmount;
    }

    function eventStart(uint256 eventId) external onlyEventContract {
        _events[eventId].whitePriceBefore = _predictionPool._whitePrice();
        _events[eventId].blackPriceBefore = _predictionPool._blackPrice();

        (uint256 priceChangePart, ) = getOngoingEvent();

        require(isPendingEnabled(), "LEVERAGE: PENDING ORDERS DISABLED");

        require(
            priceChangePart == _priceChangePart,
            "LEVERAGE: WRONG PRICE CHANGE PART"
        );

        _events[eventId].isStarted = true;
        if (_events[eventId].whiteCollateralAmount > 0) {
            _pendingOrders.createOrder(
                _events[eventId].whiteCollateralAmount,
                true,
                eventId
            );
        }
        if (_events[eventId].blackCollateralAmount > 0) {
            _pendingOrders.createOrder(
                _events[eventId].blackCollateralAmount,
                false,
                eventId
            );
        }
    }

    function eventEnd(uint256 eventId) external onlyEventContract {
        CrossEvent memory nowEvent = _events[eventId];
        nowEvent.whitePriceAfter = _predictionPool._whitePrice();
        nowEvent.blackPriceAfter = _predictionPool._blackPrice();
        nowEvent.isEnded = true;
        if (
            (nowEvent.whiteCollateralAmount > 0) ||
            (nowEvent.blackCollateralAmount > 0)
        ) {
            _pendingOrders.withdrawCollateral();
        }
        _events[eventId] = nowEvent;
    }

    function getLpRatio() public view returns (uint256) {
        if ((_collateralTokens == _lpTokens) || (_lpTokens == 0)) {
            return 1e18;
        }
        return wdiv(_collateralTokens, _lpTokens);
    }

    function updateBalances(uint256 collateralAmount, uint256 lpAmount)
        public
        onlyOwner
    {
        _collateralTokens = add(_collateralTokens, collateralAmount);
        _lpTokens = add(_lpTokens, lpAmount);
    }

    function addLiquidity(uint256 tokensAmount) public {
        require(tokensAmount > 0, "LEVERAGE: TOKENS AMOUNT CANNOT BE 0");
        require(
            _collateralToken.allowance(msg.sender, address(this)) >=
                tokensAmount,
            "LEVERAGE: NOT ENOUGH COLLATERAL TOKENS ARE DELEGATED"
        );
        require(
            _collateralToken.balanceOf(msg.sender) >= tokensAmount,
            "LEVERAGE: NOT ENOUGH COLLATERAL TOKENS ON THE USER BALANCE"
        );

        uint256 lpRatio = getLpRatio();
        uint256 lpAmount = wdiv(tokensAmount, lpRatio);

        _collateralTokens = add(_collateralTokens, tokensAmount);
        _lpTokens = add(_lpTokens, lpAmount);

        _mint(msg.sender, lpAmount);

        emit AddLiquidity(msg.sender, lpAmount, tokensAmount);

        _collateralToken.transferFrom(msg.sender, address(this), tokensAmount);
    }

    function withdrawLiquidity(uint256 lpTokensAmount) public {
        require(
            balanceOf[msg.sender] >= lpTokensAmount,
            "LEVERAGE: NOT ENOUGH LIQUIDITY TOKENS ON THE USER BALANCE"
        );
        require(
            allowance[msg.sender][address(this)] >= lpTokensAmount,
            "LEVERAGE: NOT ENOUGH LIQUIDITY TOKENS ARE DELEGATED"
        );

        uint256 lpRatio = getLpRatio();
        uint256 collateralToSend = wmul(lpTokensAmount, lpRatio);

        require(
            _collateralToken.balanceOf(address(this)) >= collateralToSend,
            "LEVERAGE: NOT ENOUGH COLLATERAL IN THE CONTRACT"
        );

        _collateralTokens = sub(_collateralTokens, collateralToSend);
        _lpTokens = sub(_lpTokens, lpTokensAmount);

        _burn(msg.sender, lpTokensAmount);

        emit WithdrawLiquidity(msg.sender, lpTokensAmount, collateralToSend);

        _collateralToken.transfer(msg.sender, collateralToSend);
    }

    function changeMaxUsageThreshold(uint256 percent) external onlyOwner {
        require(
            percent >= 0.1 * 1e18,
            "LEVERAGE: NEW MAX USAGE THRESHOLD SHOULD BE MORE THAN 10%"
        );
        _maxUsageThreshold = percent;
    }

    function changeMaxLossThreshold(uint256 percent) external onlyOwner {
        require(
            percent <= 0.5 * 1e18,
            "LEVERAGE: NEW MAX LOSS THRESHOLD SHOULD BE LESS THAN 50%"
        );
        _maxLossThreshold = percent;
    }

    function changePriceChangePart(uint256 priceChangePart) external onlyOwner {
        _priceChangePart = priceChangePart;
    }

    function updatePredictionPoolFee() external onlyOwner {
        _predictionPoolFee = _predictionPool.FEE();
    }

    function emergencyWithdrawCollateral() public onlyOwner {
        uint256 balance = _collateralToken.balanceOf(address(this));
        require(
            _collateralToken.transfer(msg.sender, balance),
            "Unable to transfer"
        );
    }
}
