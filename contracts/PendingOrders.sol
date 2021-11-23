pragma solidity ^0.7.4;

// "SPDX-License-Identifier: MIT"

import "./DSMath.sol";
import "./SafeMath.sol";
import "./IERC20.sol";
import "./Ownable.sol";
import "./IBettingPool.sol";

contract PendingOrders is DSMath, Ownable {

	using SafeMath for uint256;

	struct Order {
		address orderer;	// address of user placing order
		uint256 amount;		// amount of collateral tokens
		bool isWhite;		// TRUE for white side, FALSE for black side
		uint256 eventId;		// order target eventId
		bool isPending;		// TRUE when placed, FALSE when canceled
	}

	// ordersCount count number of orders so far, and is id of very last order
	uint public _ordersCount;

	// indicates fee percentage of 0.001%, which can be changed by owner
	uint public _FEE = 0;

	uint _collectedFee;

	IERC20 public _collateralToken;
	IBettingPool public _bettingPool;

	address public _feeWithdrawAddress;
	address public _eventContractAddress;

	// mapping from order ID to Order detail
	mapping(uint256 => Order) _orders;

	// mapping from user address to order IDs for that user
	mapping(address => uint[]) _ordersOfUser;
	
	struct Detail {
	    uint amount;
	    uint whiteCollateral;		// total amount of collateral for white side of the event
	    uint blackCollateral;		// total amount of collateral for black side of the event
	    uint whitePriceBefore;	// price of white token before the event
	    uint blackPriceBefore;	// price of black token before the event
	    uint whitePriceAfter;	// price of white token after the event
	    uint blackPriceAfter;	// price of black token after the event
	    bool isExecuted;		// TRUE before the event, FALSE after the event
	}	
	
	// mapping from event ID to detail for that event
	mapping(uint256 => Detail) _detailForEvent;

	event OrderCreated(uint256 id);
	event OrderCanceled(uint256 id);
	event CollateralWithdrew(uint256 amount);
	event ContractOwnerChanged(address owner);
	event EventContractAddressChanged(address eventContract);
	event FeeWithdrawAddressChanged(address feeAddress);
	event FeeWithdrew(uint256 amount);
	event FeeChanged(uint256 number);
	event AmountExecuted(uint256 amount);

	constructor (
		address bettingPoolAddress,
		address collateralTokenAddress,
		address feeWithdrawAddress,
		address eventContractAddress
	) {
		require(
			bettingPoolAddress != address(0),
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
		_bettingPool = IBettingPool(bettingPoolAddress);
		_collateralToken = IERC20(collateralTokenAddress);
		_feeWithdrawAddress = feeWithdrawAddress;
		_eventContractAddress = eventContractAddress;
		
		uint256 MAX_UINT = 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff;
		_collateralToken.approve(address(_bettingPool._thisCollateralization()), MAX_UINT);
		IERC20(_bettingPool._whiteToken()).approve(_bettingPool._thisCollateralization(), MAX_UINT);
		IERC20(_bettingPool._blackToken()).approve(_bettingPool._thisCollateralization(), MAX_UINT);
	}

	// Modifier to ensure call has been made by event contract
	modifier onlyEventContract {
        require(
            msg.sender == _eventContractAddress,
            "CALLER SHOULD BE EVENT CONTRACT"
        );
        _;
    }

    function createOrder(uint _amount, bool _isWhite, uint _eventId) external {
    	require(
			_collateralToken.balanceOf(msg.sender) >= _amount,
			"NOT ENOUGH COLLATERAL IN USER'S ACCOUNT"
		);
		require(_collateralToken.allowance(msg.sender, address(this)) >= _amount,
		    "NOT ENOUGHT DELEGATED TOKENS"
		);
		require(_ordersOfUser[msg.sender].length < 11, 
		"Cannot have more than 10 orders for a user simultaneously");


		_ordersCount += 1;
		_orders[_ordersCount] = Order(
			msg.sender,
			_amount,
			_isWhite,
			_eventId,
			true
		);

		_isWhite
			? _detailForEvent[_eventId].whiteCollateral = _detailForEvent[_eventId].whiteCollateral.add(_amount)
			: _detailForEvent[_eventId].blackCollateral = _detailForEvent[_eventId].blackCollateral.add(_amount);
			
		_ordersOfUser[msg.sender].push(_ordersCount);

		_collateralToken.transferFrom(msg.sender, address(this), _amount);
		emit OrderCreated(_ordersCount);
    }

    function cancelOrder(uint orderId) external {
        Order memory order = _orders[orderId];
		require(
			msg.sender == order.orderer,
			"NOT YOUR ORDER"
		);
    	require(
    		order.isPending,
			"ORDER HAS ALREADY BEEN CANCELED"
		);
		require(
		    !_detailForEvent[order.eventId].isExecuted,
		    "ORDER HAS ALREADY BEEN EXECUTED"
		);
		_collateralToken.transfer(
			order.orderer,
			order.amount
		);
		order.isWhite
			? _detailForEvent[order.eventId].whiteCollateral = _detailForEvent[order.eventId].whiteCollateral.sub(order.amount)
			: _detailForEvent[order.eventId].blackCollateral = _detailForEvent[order.eventId].blackCollateral.sub(order.amount);
		_orders[orderId].isPending = false;
		emit OrderCanceled(orderId);
    }

    function eventStart(uint _eventId) external onlyEventContract {
        uint256 MAX_PRICE = 100 * WAD;
        uint256 forWhite = _detailForEvent[_eventId].whiteCollateral;
        uint256 forBlack = _detailForEvent[_eventId].blackCollateral;
        if(forWhite > 0) {
    	    _bettingPool.buyWhite(MAX_PRICE, forWhite);
    	    _detailForEvent[_eventId].whitePriceBefore = _bettingPool._whitePrice();
        }
        if(forBlack > 0) {
            _bettingPool.buyBlack(MAX_PRICE, forBlack);
    	    _detailForEvent[_eventId].blackPriceBefore = _bettingPool._blackPrice();
        }
    }

    function eventEnd(uint _eventId) external onlyEventContract {
        uint256 MIN_PRICE = 0;
        uint256 ownWhite = IERC20(_bettingPool._whiteToken()).balanceOf(address(this));
        uint256 ownBlack = IERC20(_bettingPool._blackToken()).balanceOf(address(this));

        if(ownWhite > 0) {
            _bettingPool.sellWhite(MIN_PRICE, ownWhite);
            _detailForEvent[_eventId].whitePriceAfter = _bettingPool._whitePrice();
        }
        if(ownBlack > 0) {
    	    _bettingPool.sellBlack(MIN_PRICE, ownBlack);
    	    _detailForEvent[_eventId].blackPriceAfter = _bettingPool._blackPrice();
        }
        if(ownBlack > 0 || ownWhite > 0) {
            _detailForEvent[_eventId].isExecuted = true;
        }
    }

    function withdrawCollateral() external returns(uint) {
    	
    	// total amount of collateral token that should be returned to user
    	// feeAmount should be subtracted before actual return
        uint totalWithdrawAmount;

        uint[] memory orders = _ordersOfUser[msg.sender];
        for (uint i = 0; i < orders.length; i++) {
            uint _oId = orders[i]; // order ID
            Order memory order = _orders[_oId];
            uint _eId = order.eventId; // event ID
            Detail memory eventDetail = _detailForEvent[_eId];
            // calculate and sum up collaterals to be returned
            // exclude canceled orders, only include executed orders
            if (order.isPending && eventDetail.isExecuted) {
                uint withdrawAmount = 0;
                if(order.isWhite) {
                    uint256 whitePriceBefore = eventDetail.whitePriceBefore;
                    whitePriceBefore = whitePriceBefore.add(wmul(whitePriceBefore, _bettingPool.FEE()) + 1);
                    uint256 whitePriceAfter = eventDetail.whitePriceAfter;
                    whitePriceAfter = whitePriceAfter.sub(wmul(whitePriceAfter, _bettingPool.FEE()) + 1);
                    withdrawAmount = calculateNewAmount(
                		order.amount,
                		whitePriceBefore,
                		whitePriceAfter);
                } else {
                    uint256 blackPriceBefore = eventDetail.blackPriceBefore;
                    blackPriceBefore = blackPriceBefore.add(wmul(blackPriceBefore, _bettingPool.FEE()) + 1);
                    uint256 blackPriceAfter = eventDetail.blackPriceAfter;
                    blackPriceAfter = blackPriceAfter.sub(wmul(blackPriceAfter, _bettingPool.FEE()) + 1);
                    withdrawAmount = calculateNewAmount(
                		order.amount,
                		blackPriceBefore,
                		blackPriceAfter);
                }
                totalWithdrawAmount = totalWithdrawAmount.add(withdrawAmount);
            }

            // pop IDs of canceled or executed orders from ordersOfUser array
            if (!order.isPending || eventDetail.isExecuted) {
                delete _ordersOfUser[msg.sender][i];
                _ordersOfUser[msg.sender][i] = _ordersOfUser[msg.sender][_ordersOfUser[msg.sender].length - 1];
                _ordersOfUser[msg.sender].pop();
            }
        }
        
        uint feeAmount = wmul(totalWithdrawAmount, _FEE);
        uint userWithdrawAmount = totalWithdrawAmount.sub(feeAmount);
        
        _collectedFee = _collectedFee.add(feeAmount);

        _collateralToken.transfer(msg.sender, userWithdrawAmount);
        emit CollateralWithdrew(userWithdrawAmount);
        
        return totalWithdrawAmount;
    }

    function calculateNewAmount(
    	uint originAmount,
    	uint priceBefore,
    	uint priceAfter
    ) internal pure returns(uint newAmount) {
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

	function changeEventContractAddress(address _newEventAddress) external onlyOwner {
		require(
			_newEventAddress != address(0),
			"NEW EVENT ADDRESS SHOULD NOT BE NULL"
		);
		_eventContractAddress = _newEventAddress;
		emit EventContractAddressChanged(_eventContractAddress);
	}

	function changeFeeWithdrawAddress(address _newFeeWithdrawAddress) external onlyOwner {
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

	function changeFee(uint _newFEE) external onlyOwner {
		_FEE = _newFEE;
		emit FeeChanged(_FEE);
	}

}