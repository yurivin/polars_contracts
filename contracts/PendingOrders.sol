pragma solidity ^0.7.4;

// "SPDX-License-Identifier: MIT"

import "./DSMath.sol";
import "./SafeMath.sol";
import "./Common/IERC20.sol";
import "./Common/Ownable.sol";
import "./IPredictionPool.sol";

contract PendingOrders is DSMath, Ownable {
    using SafeMath for uint256;

    struct Order {
        /* solhint-disable prettier/prettier */
        address orderer;    // address of user placing order
        uint256 amount;     // amount of collateral tokens
        bool isWhite;       // TRUE for white side, FALSE for black side
        uint256 eventId;    // order target eventId
        bool isPending;     // TRUE when placed, FALSE when canceled
        /* solhint-enable prettier/prettier */
    }

    // ordersCount count number of orders so far, and is id of very last order
    uint256 public _ordersCount;
    uint256 public MAX_ORDERS_ALLOWED = 10;

    IERC20 public _collateralToken;
    IPredictionPool public _predictionPool;

    address public _eventContractAddress;

    // mapping from order ID to Order detail
    mapping(uint256 => Order) public _orders;

    // mapping from user address to order IDs for that user
    mapping(address => uint256[]) public _ordersOfUser;

    struct Detail {
        /* solhint-disable prettier/prettier */
        uint256 amount;
        uint256 whiteCollateral;    // total amount of collateral for white side of the event
        uint256 blackCollateral;    // total amount of collateral for black side of the event
        uint256 whitePriceBefore;   // price of white token before the event
        uint256 blackPriceBefore;   // price of black token before the event
        uint256 whitePriceAfter;    // price of white token after the event
        uint256 blackPriceAfter;    // price of black token after the event
        bool isExecuted;            // FALSE before the event, TRUE after the event end
        bool isStarted;             // FALSE before the event, TRUE after the event start
        /* solhint-enable prettier/prettier */
    }

    // mapping from event ID to detail for that event
    mapping(uint256 => Detail) public _detailForEvent;

    event OrderCreated(uint256 id, address user, uint256 amount);
    event OrderCanceled(uint256 id, address user);
    event CollateralWithdrew(uint256 amount, address user);
    event ContractOwnerChanged(address owner);
    event EventContractAddressChanged(address eventContract);
    event FeeWithdrawAddressChanged(address feeAddress);
    event FeeWithdrew(uint256 amount);
    event FeeChanged(uint256 number);
    event AmountExecuted(uint256 amount);

    constructor(
        address predictionPoolAddress,
        address collateralTokenAddress,
        address eventContractAddress
    ) {
        require(
            predictionPoolAddress != address(0),
            "SECONDARY POOL ADDRESS SHOULD NOT BE NULL"
        );
        require(
            collateralTokenAddress != address(0),
            "COLLATERAL TOKEN ADDRESS SHOULD NOT BE NULL"
        );
        require(
            eventContractAddress != address(0),
            "EVENT ADDRESS SHOULD NOT BE NULL"
        );
        _predictionPool = IPredictionPool(predictionPoolAddress);
        _collateralToken = IERC20(collateralTokenAddress);
        _eventContractAddress = eventContractAddress;

        _collateralToken.approve(
            address(_predictionPool._thisCollateralization()),
            type(uint256).max
        );
        IERC20(_predictionPool._whiteToken()).approve(
            _predictionPool._thisCollateralization(),
            type(uint256).max
        );
        IERC20(_predictionPool._blackToken()).approve(
            _predictionPool._thisCollateralization(),
            type(uint256).max
        );
    }

    // Modifier to ensure call has been made by event contract
    modifier onlyEventContract() {
        require(
            msg.sender == _eventContractAddress,
            "CALLER SHOULD BE EVENT CONTRACT"
        );
        _;
    }

    function createOrder(
        uint256 _amount,
        bool _isWhite,
        uint256 _eventId
    ) external {
        require(!_detailForEvent[_eventId].isStarted, "EVENT ALREADY STARTED");
        require(
            _collateralToken.balanceOf(msg.sender) >= _amount,
            "NOT ENOUGH COLLATERAL IN USER ACCOUNT"
        );
        require(
            _collateralToken.allowance(msg.sender, address(this)) >= _amount,
            "NOT ENOUGHT DELEGATED TOKENS"
        );
        require(
            _ordersOfUser[msg.sender].length <= MAX_ORDERS_ALLOWED,
            "CANNOT HAVE MORE THAN 10 ORDERS FOR A USER SIMULTANEOUSLY"
        );

        _orders[_ordersCount] = Order(
            msg.sender,
            _amount,
            _isWhite,
            _eventId,
            true
        );

        /* solhint-disable prettier/prettier */
        _isWhite
            ? _detailForEvent[_eventId].whiteCollateral = _detailForEvent[_eventId].whiteCollateral.add(_amount)
            : _detailForEvent[_eventId].blackCollateral = _detailForEvent[_eventId].blackCollateral.add(_amount);
        /* solhint-enable prettier/prettier */
        _ordersOfUser[msg.sender].push(_ordersCount);

        _collateralToken.transferFrom(msg.sender, address(this), _amount);
        emit OrderCreated(_ordersCount, msg.sender, _amount);
        _ordersCount += 1;
    }

    function ordersOfUser(address user)
        external
        view
        returns (uint256[] memory)
    {
        return _ordersOfUser[user];
    }

    function cancelOrder(uint256 orderId) external {
        Order memory order = _orders[orderId];
        require(msg.sender == order.orderer, "NOT YOUR ORDER");

        require(order.isPending, "ORDER HAS ALREADY BEEN CANCELED");

        require(
            !_detailForEvent[order.eventId].isExecuted,
            "The order cannot be canceled - ALREADY EXECUTED"
        );

        require(
            !_detailForEvent[order.eventId].isStarted,
            "The order cannot be canceled - EVENT IN PROGRESS"
        );

        /* solhint-disable prettier/prettier */
        order.isWhite
            ? _detailForEvent[order.eventId].whiteCollateral = _detailForEvent[order.eventId].whiteCollateral.sub(order.amount)
            : _detailForEvent[order.eventId].blackCollateral = _detailForEvent[order.eventId].blackCollateral.sub(order.amount);
        /* solhint-enable prettier/prettier */
        _orders[orderId].isPending = false;
        _collateralToken.transfer(order.orderer, order.amount);
        emit OrderCanceled(orderId, msg.sender);
    }

    function eventStart(uint256 _eventId) external onlyEventContract {
        // solhint-disable-next-line var-name-mixedcase
        uint256 MAX_PRICE = 100 * WAD;
        uint256 forWhite = _detailForEvent[_eventId].whiteCollateral;
        uint256 forBlack = _detailForEvent[_eventId].blackCollateral;
        if (forWhite > 0) {
            _predictionPool.buyWhite(MAX_PRICE, forWhite);
            // solhint-disable-next-line prettier/prettier
            _detailForEvent[_eventId].whitePriceBefore = _predictionPool._whitePrice();
        }
        if (forBlack > 0) {
            _predictionPool.buyBlack(MAX_PRICE, forBlack);
            // solhint-disable-next-line prettier/prettier
            _detailForEvent[_eventId].blackPriceBefore = _predictionPool._blackPrice();
        }
        _detailForEvent[_eventId].isStarted = true;
    }

    function eventEnd(uint256 _eventId) external onlyEventContract {
        // solhint-disable-next-line var-name-mixedcase
        uint256 MIN_PRICE = 0;
        uint256 ownWhite = IERC20(_predictionPool._whiteToken()).balanceOf(
            address(this)
        );
        uint256 ownBlack = IERC20(_predictionPool._blackToken()).balanceOf(
            address(this)
        );

        if (ownWhite > 0) {
            _predictionPool.sellWhite(ownWhite, MIN_PRICE);
            // solhint-disable-next-line prettier/prettier
            _detailForEvent[_eventId].whitePriceAfter = _predictionPool._whitePrice();
        }
        if (ownBlack > 0) {
            _predictionPool.sellBlack(ownBlack, MIN_PRICE);
            // solhint-disable-next-line prettier/prettier
            _detailForEvent[_eventId].blackPriceAfter = _predictionPool._blackPrice();
        }
        _detailForEvent[_eventId].isExecuted = true;
    }

    function withdrawCollateral() external returns (uint256) {
        require(_ordersOfUser[msg.sender].length > 0, "ACCOUNT HAS NO ORDERS");

        // total amount of collateral token that should be returned to user
        // feeAmount should be subtracted before actual return
        uint256 totalWithdrawAmount;

        uint256 i = 0;
        while (i < _ordersOfUser[msg.sender].length) {
            uint256 _oId = _ordersOfUser[msg.sender][i]; // order ID
            Order memory order = _orders[_oId];
            uint256 _eId = order.eventId; // event ID
            Detail memory eventDetail = _detailForEvent[_eId];

            // calculate and sum up collaterals to be returned
            // exclude canceled orders, only include executed orders
            if (order.isPending && eventDetail.isExecuted) {
                uint256 withdrawAmount = 0;
                uint256 priceAfter = 0;
                uint256 priceBefore = 0;

                if (order.isWhite) {
                    priceBefore = eventDetail.whitePriceBefore;
                    priceAfter = eventDetail.whitePriceAfter;
                } else {
                    priceBefore = eventDetail.blackPriceBefore;
                    priceAfter = eventDetail.blackPriceAfter;
                }

                withdrawAmount = order.amount.sub(
                    wmul(order.amount, _predictionPool.FEE())
                );
                withdrawAmount = wdiv(withdrawAmount, priceBefore);
                withdrawAmount = wmul(withdrawAmount, priceAfter);
                withdrawAmount = withdrawAmount.sub(
                    wmul(withdrawAmount, _predictionPool.FEE())
                );
                totalWithdrawAmount = totalWithdrawAmount.add(withdrawAmount);
            }

            // pop IDs of canceled or executed orders from ordersOfUser array
            if (!_orders[_oId].isPending || eventDetail.isExecuted) {
                delete _ordersOfUser[msg.sender][i];
                _ordersOfUser[msg.sender][i] = _ordersOfUser[msg.sender][
                    _ordersOfUser[msg.sender].length - 1
                ];
                _ordersOfUser[msg.sender].pop();

                delete _orders[_oId];
            } else {
                i++;
            }
        }

        if (totalWithdrawAmount > 0) {
            _collateralToken.transfer(msg.sender, totalWithdrawAmount.sub(1));
        }

        emit CollateralWithdrew(totalWithdrawAmount, msg.sender);

        return totalWithdrawAmount;
    }

    function changeContractOwner(address _newOwnerAddress) external onlyOwner {
        require(
            _newOwnerAddress != address(0),
            "NEW OWNER ADDRESS SHOULD NOT BE NULL"
        );
        transferOwnership(_newOwnerAddress);
        emit ContractOwnerChanged(_newOwnerAddress);
    }

    function changeEventContractAddress(address _newEventAddress)
        external
        onlyOwner
    {
        require(
            _newEventAddress != address(0),
            "NEW EVENT ADDRESS SHOULD NOT BE NULL"
        );
        _eventContractAddress = _newEventAddress;
        emit EventContractAddressChanged(_eventContractAddress);
    }

    function changeMaxOrdersCount(uint256 count) external onlyOwner {
        require(count != 0, "NEW MAX ORDERS COUNT SHOULD NOT BE NULL");
        MAX_ORDERS_ALLOWED = count;
    }

    function emergencyWithdrawCollateral() public onlyOwner {
        uint256 balance = _collateralToken.balanceOf(address(this));
        require(
            _collateralToken.transfer(msg.sender, balance),
            "Unable to transfer"
        );
    }
}
