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

    // indicates fee percentage of 0.001%, which can be changed by owner
    uint256 public _FEE = 0; // solhint-disable-line var-name-mixedcase

    uint256 _collectedFee;

    IERC20 public _collateralToken;
    IPredictionPool public _predictionPool;

    address public _feeWithdrawAddress;
    address public _eventContractAddress;

    // mapping from order ID to Order detail
    mapping(uint256 => Order) _orders;

    // mapping from user address to order IDs for that user
    mapping(address => uint256[]) _ordersOfUser;

    struct Detail {
        /* solhint-disable prettier/prettier */
        uint256 amount;
        uint256 whiteCollateral;    // total amount of collateral for white side of the event
        uint256 blackCollateral;    // total amount of collateral for black side of the event
        uint256 whitePriceBefore;   // price of white token before the event
        uint256 blackPriceBefore;   // price of black token before the event
        uint256 whitePriceAfter;    // price of white token after the event
        uint256 blackPriceAfter;    // price of black token after the event
        bool isExecuted;            // TRUE before the event, FALSE after the event
        /* solhint-enable prettier/prettier */
    }

    // mapping from event ID to detail for that event
    mapping(uint256 => Detail) _detailForEvent;

    event OrderCreated(uint256 id, uint256 amount);
    event OrderCanceled(uint256 id);
    event CollateralWithdrew(uint256 amount);
    event ContractOwnerChanged(address owner);
    event EventContractAddressChanged(address eventContract);
    event FeeWithdrawAddressChanged(address feeAddress);
    event FeeWithdrew(uint256 amount);
    event FeeChanged(uint256 number);
    event AmountExecuted(uint256 amount);

    constructor(
        address predictionPoolAddress,
        address collateralTokenAddress,
        address feeWithdrawAddress,
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
            feeWithdrawAddress != address(0),
            "FEE WITHDRAW ADDRESS SHOULD NOT BE NULL"
        );
        require(
            eventContractAddress != address(0),
            "EVENT ADDRESS SHOULD NOT BE NULL"
        );
        _predictionPool = IPredictionPool(predictionPoolAddress);
        _collateralToken = IERC20(collateralTokenAddress);
        _feeWithdrawAddress = feeWithdrawAddress;
        _eventContractAddress = eventContractAddress;

        // solhint-disable-next-line var-name-mixedcase
        uint256 MAX_UINT = 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff;
        _collateralToken.approve(
            address(_predictionPool._thisCollateralization()),
            MAX_UINT
        );
        IERC20(_predictionPool._whiteToken()).approve(
            _predictionPool._thisCollateralization(),
            MAX_UINT
        );
        IERC20(_predictionPool._blackToken()).approve(
            _predictionPool._thisCollateralization(),
            MAX_UINT
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
        require(
            _collateralToken.balanceOf(msg.sender) >= _amount,
            "NOT ENOUGH COLLATERAL IN USER'S ACCOUNT"
        );
        require(
            _collateralToken.allowance(msg.sender, address(this)) >= _amount,
            "NOT ENOUGHT DELEGATED TOKENS"
        );
        require(
            _ordersOfUser[msg.sender].length < 11,
            "Cannot have more than 10 orders for a user simultaneously"
        );

        _ordersCount += 1;
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
        emit OrderCreated(_ordersCount, _amount);
    }

    function cancelOrder(uint256 orderId) external {
        Order memory order = _orders[orderId];
        require(msg.sender == order.orderer, "NOT YOUR ORDER");
        require(order.isPending, "ORDER HAS ALREADY BEEN CANCELED");
        require(
            !_detailForEvent[order.eventId].isExecuted,
            "ORDER HAS ALREADY BEEN EXECUTED"
        );
        _collateralToken.transfer(order.orderer, order.amount);

        /* solhint-disable prettier/prettier */
        order.isWhite
            ? _detailForEvent[order.eventId].whiteCollateral = _detailForEvent[order.eventId].whiteCollateral.sub(order.amount)
            : _detailForEvent[order.eventId].blackCollateral = _detailForEvent[order.eventId].blackCollateral.sub(order.amount);
        /* solhint-enable prettier/prettier */
        _orders[orderId].isPending = false;
        emit OrderCanceled(orderId);
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
        if (ownBlack > 0 || ownWhite > 0) {
            _detailForEvent[_eventId].isExecuted = true;
        }
    }

    function withdrawCollateral() external returns (uint256) {
        // total amount of collateral token that should be returned to user
        // feeAmount should be subtracted before actual return
        uint256 totalWithdrawAmount;

        uint256[] memory orders = _ordersOfUser[msg.sender];
        for (uint256 i = 0; i < orders.length; i++) {
            uint256 _oId = orders[i]; // order ID
            Order memory order = _orders[_oId];
            uint256 _eId = order.eventId; // event ID
            Detail memory eventDetail = _detailForEvent[_eId];

            // calculate and sum up collaterals to be returned
            // exclude canceled orders, only include executed orders
            if (order.isPending && eventDetail.isExecuted) {
                uint256 withdrawAmount = 0;

                withdrawAmount = order.amount.sub(
                    wmul(order.amount, _predictionPool.FEE())
                );
                withdrawAmount = wdiv(
                    withdrawAmount,
                    order.isWhite
                        ? eventDetail.whitePriceBefore
                        : eventDetail.blackPriceBefore
                );
                withdrawAmount = wmul(
                    withdrawAmount,
                    order.isWhite
                        ? eventDetail.whitePriceAfter
                        : eventDetail.blackPriceAfter
                );
                withdrawAmount = withdrawAmount.sub(
                    wmul(withdrawAmount, _predictionPool.FEE())
                );
                totalWithdrawAmount = totalWithdrawAmount.add(withdrawAmount);
            }

            // pop IDs of canceled or executed orders from ordersOfUser array
            if (!order.isPending || eventDetail.isExecuted) {
                delete _ordersOfUser[msg.sender][i];

                // solhint-disable-next-line prettier/prettier
                _ordersOfUser[msg.sender][i] = _ordersOfUser[msg.sender][_ordersOfUser[msg.sender].length - 1];
                _ordersOfUser[msg.sender].pop();
            }
        }

        uint256 feeAmount = wmul(totalWithdrawAmount, _FEE);
        uint256 userWithdrawAmount = totalWithdrawAmount.sub(feeAmount);

        _collectedFee = _collectedFee.add(feeAmount);

        _collateralToken.transfer(msg.sender, userWithdrawAmount);
        emit CollateralWithdrew(userWithdrawAmount);

        return totalWithdrawAmount;
    }

    function calculateNewAmount(
        uint256 originAmount,
        uint256 priceBefore,
        uint256 priceAfter
    ) internal pure returns (uint256 newAmount) {
        newAmount = wmul(wdiv(originAmount, priceBefore), priceAfter);
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

    function changeFeeWithdrawAddress(address _newFeeWithdrawAddress)
        external
        onlyOwner
    {
        require(
            _newFeeWithdrawAddress != address(0),
            "NEW WITHDRAW ADDRESS SHOULD NOT BE NULL"
        );
        _feeWithdrawAddress = _newFeeWithdrawAddress;
        emit FeeWithdrawAddressChanged(_feeWithdrawAddress);
    }

    function withdrawFee() external onlyOwner {
        require(
            _collateralToken.balanceOf(address(this)) >= _collectedFee,
            "INSUFFICIENT TOKEN(THAT IS LOWER THAN EXPECTED COLLECTEDFEE) IN PENDINGORDERS CONTRACT"
        );
        _collateralToken.transfer(_feeWithdrawAddress, _collectedFee);
        _collectedFee = 0;
        emit FeeWithdrew(_collectedFee);
    }

    function changeFee(uint256 _newFEE) external onlyOwner {
        _FEE = _newFEE;
        emit FeeChanged(_FEE);
    }
}
