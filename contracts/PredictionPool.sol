pragma solidity ^0.7.4;
// "SPDX-License-Identifier: MIT"

import "./Common/IERC20.sol";
import "./Eventable.sol";
import "./iPredictionCollateralization.sol";
import "./DSMath.sol";
import "./SafeMath.sol";

contract PredictionPool is Eventable, DSMath {
    using SafeMath for uint256;

    bool public _eventStarted = false;
    bool public _poolShutdown = false;

    address public _governanceAddress;
    address public _eventContractAddress;
    address public _governanceWalletAddress;

    /*
    Founders wallets
    */
    address public _controllerWalletAddress;

    event BuyBlack(address user, uint256 amount, uint256 price);
    event BuyWhite(address user, uint256 amount, uint256 price);
    event SellBlack(address user, uint256 amount, uint256 price);
    event SellWhite(address user, uint256 amount, uint256 price);

    IERC20 public _whiteToken;
    IERC20 public _blackToken;
    IERC20 public _collateralToken;
    iPredictionCollateralization public _thisCollateralization;

    uint256 public _whitePrice; // in 1e18
    uint256 public _blackPrice; // in 1e18

    // solhint-disable-next-line var-name-mixedcase
    uint256 public BW_DECIMALS = 18;

    // in percents (1e18 == 100%)
    uint256 public _currentEventPercentChange;

    // 0.3% (1e18 == 100%)
    uint256 public FEE = 0.003 * 1e18;

    // governance token holders fee of total FEE
    uint256 public _governanceFee = 0.4 * 1e18;

    // controller fee of total FEE
    uint256 public _controllerFee = 0.55 * 1e18;

    // initial pool fee  of total FEE
    uint256 public _bwAdditionFee = 0.05 * 1e18;

    uint256 public _maxFeePart = 0.9 * 1e18;

    /*
    Part which will be sent as governance incentives
    Only not yet distributed fees.
    */
    uint256 public _feeGovernanceCollected;

    /*
    Part which will sent to the team
    Only not yet distributed fees.
    */
    uint256 public _controllerFeeCollected;

    uint256 public _collateralForBlack;
    uint256 public _collateralForWhite;

    uint256 public _blackBought;
    uint256 public _whiteBought;

    uint256 public _whiteBoughtThisCycle;
    uint256 public _blackBoughtThisCycle;
    uint256 public _whiteSoldThisCycle;
    uint256 public _blackSoldThisCycle;

    // Minimum amount of tokens pool should hold after initial actions.
    uint256 public constant MIN_HOLD = 2 * 1e18;

    bool public inited;

    constructor(
        address thisCollateralizationAddress,
        address collateralTokenAddress,
        address whiteTokenAddress,
        address blackTokenAddress,
        uint256 whitePrice,
        uint256 blackPrice
    ) {
        require(
            whiteTokenAddress != address(0),
            "WHITE token address should not be null"
        );
        require(
            blackTokenAddress != address(0),
            "BLACK token address should not be null"
        );

        _thisCollateralization = iPredictionCollateralization(
            thisCollateralizationAddress
        );
        _collateralToken = IERC20(collateralTokenAddress);

        _whiteToken = IERC20(whiteTokenAddress);

        _blackToken = IERC20(blackTokenAddress);

        _governanceAddress = msg.sender;

        _whitePrice = whitePrice;
        _blackPrice = blackPrice;
    }

    function init(
        address governanceWalletAddress,
        address eventContractAddress,
        address controllerWalletAddress
    ) external onlyGovernance {
        require(!inited, "Pool already initiated");
        require(
            controllerWalletAddress != address(0),
            "controllerWalletAddress should not be null"
        );
        require(
            governanceWalletAddress != address(0),
            "governanceWalletAddress should not be null"
        );
        _eventContractAddress = eventContractAddress == address(0)
            ? msg.sender
            : eventContractAddress;

        _governanceWalletAddress = governanceWalletAddress;
        _controllerWalletAddress = controllerWalletAddress;
        inited = true;
    }

    modifier noEvent() {
        require(
            _eventStarted == false,
            "Function cannot be called during ongoing event"
        );
        _;
    }

    modifier onlyGovernance() {
        require(
            _governanceAddress == msg.sender,
            "CALLER SHOULD BE GOVERNANCE"
        );
        _;
    }

    modifier onlyEventContract() {
        require(
            _eventContractAddress == msg.sender,
            "CALLER SHOULD BE EVENT CONTRACT"
        );
        _;
    }

    modifier notPoolShutdown() {
        require(
            _poolShutdown == false,
            "Pool is shutting down. This function does not work"
        );
        _;
    }

    struct EventEnd {
        uint256 whitePrice;
        uint256 blackPrice;
        uint256 whiteWinVolatility;
        uint256 blackWinVolatility;
        uint256 changePercent;
        uint256 whiteCoefficient;
        uint256 blackCoefficient;
        uint256 totalFundsInSecondaryPool;
        uint256 allWhiteCollateral;
        uint256 allBlackCollateral;
        uint256 spentForWhiteThisCycle;
        uint256 spentForBlackThisCycle;
        uint256 collateralForWhite;
        uint256 collateralForBlack;
        uint256 whiteBought;
        uint256 blackBought;
        uint256 receivedForWhiteThisCycle;
        uint256 receivedForBlackThisCycle;
    }

    event CurrentWhitePrice(uint256 currrentWhitePrice);
    event CurrentBlackPrice(uint256 currentBlackPrice);
    event WhiteBoughtThisCycle(uint256 whiteBoughtThisCycle);
    event BlackBoughtThisCycle(uint256 blackBoughtThisCycle);
    event WhiteSoldThisCycle(uint256 whiteSoldThisCycle);
    event BlackSoldThisCycle(uint256 blackSoldThisCycle);
    event WhiteBought(uint256 whiteBought);
    event BlackBought(uint256 blackBought);
    event ReceivedForWhiteThisCycle(uint256 receivedForWhiteThisCycle);
    event ReceivedForBlackThisCycle(uint256 receivedForBlackThisCycle);
    event SpentForWhiteThisCycle(uint256 spentForWhiteThisCycle);
    event SpentForBlackThisCycle(uint256 spentForBlackThisCycle);
    event AllWhiteCollateral(uint256 allWhiteCollateral);
    event AllBlackCollateral(uint256 allBlackCollateral);
    event TotalFunds(uint256 totalFundsInSecondaryPool);
    event WhiteCefficient(uint256 whiteCoefficient);
    event BlackCefficient(uint256 blackCoefficient);
    event ChangePercent(uint256 changePercent);
    event WhiteWinVolatility(uint256 whiteWinVolatility);
    event BlackWinVolatility(uint256 blackWinVolatility);
    event CollateralForWhite(uint256 collateralForWhite);
    event CollateralForBlack(uint256 collateralForBlack);
    event WhitePrice(uint256 whitePrice);
    event BlackPrice(uint256 blackPrice);
    event SecondaryPoolBWPrice(uint256 secondaryPoolBWPrice);

    /**
     * Receive event results. Receives result of an event in value between -1 and 1. -1 means
     * Black won,1 means white-won.
     */
    function submitEventResult(int8 _result)
        external
        override
        onlyEventContract
    {
        require(
            _result == -1 || _result == 1 || _result == 0,
            "Result has inappropriate value. Should be -1, 0 or 1"
        );

        _eventStarted = false;

        if (_result == 0) {
            return;
        }

        EventEnd memory eend;
        //Cells are cell numbers from SECONDARY POOL FORMULA DOC page

        // Cell 3
        uint256 currentWhitePrice = _whitePrice;
        emit CurrentWhitePrice(currentWhitePrice);

        // Cell 4
        uint256 currentBlackPrice = _blackPrice;
        emit CurrentBlackPrice(currentBlackPrice);

        //Cell 7
        uint256 whiteBoughtThisCycle = _whiteBoughtThisCycle;
        _whiteBoughtThisCycle = 0; // We need to start calculations from zero for the next cycle.
        emit WhiteBoughtThisCycle(whiteBoughtThisCycle);

        //Cell 8
        uint256 blackBoughtThisCycle = _blackBoughtThisCycle;
        _blackBoughtThisCycle = 0; // We need to start calculations from zero for the next cycle.
        emit BlackBoughtThisCycle(blackBoughtThisCycle);

        // Cell 10
        uint256 whiteSoldThisCycle = _whiteSoldThisCycle;
        _whiteSoldThisCycle = 0; // We need to start calculations from zero for the next cycle.
        emit WhiteSoldThisCycle(whiteSoldThisCycle);

        // Cell 11
        uint256 blackSoldThisCycle = _blackSoldThisCycle;
        _blackSoldThisCycle = 0; // We need to start calculations from zero for the next cycle.
        emit BlackSoldThisCycle(blackSoldThisCycle);

        // Cell 13
        eend.whiteBought = _whiteBought;
        emit WhiteBought(eend.whiteBought);
        if (eend.whiteBought == 0) {
            return;
        }

        // Cell 14
        eend.blackBought = _blackBought;
        emit BlackBought(eend.blackBought);
        if (eend.blackBought == 0) {
            return;
        }

        // Cell 16
        eend.receivedForWhiteThisCycle = wmul(
            whiteBoughtThisCycle,
            currentWhitePrice
        );
        emit ReceivedForWhiteThisCycle(eend.receivedForWhiteThisCycle);

        // Cell 17
        eend.receivedForBlackThisCycle = wmul(
            blackBoughtThisCycle,
            currentBlackPrice
        );
        emit ReceivedForBlackThisCycle(eend.receivedForBlackThisCycle);

        // Cell 19
        eend.spentForWhiteThisCycle = wmul(
            whiteSoldThisCycle,
            currentWhitePrice
        );
        emit SpentForWhiteThisCycle(eend.spentForWhiteThisCycle);

        // Cell 20
        eend.spentForBlackThisCycle = wmul(
            blackSoldThisCycle,
            currentBlackPrice
        );
        emit SpentForBlackThisCycle(eend.spentForBlackThisCycle);

        // Cell 22
        eend.allWhiteCollateral = _collateralForWhite;
        emit AllWhiteCollateral(eend.allWhiteCollateral);

        if (eend.allWhiteCollateral == 0) {
            return;
        }

        // Cell 23
        eend.allBlackCollateral = _collateralForBlack;
        emit AllBlackCollateral(eend.allBlackCollateral);

        if (eend.allBlackCollateral == 0) {
            return;
        }

        // Cell 24
        eend.totalFundsInSecondaryPool = eend.allWhiteCollateral.add(
            eend.allBlackCollateral
        );
        emit TotalFunds(eend.totalFundsInSecondaryPool);

        // To exclude division by zero There is a check for a non zero eend.allWhiteCollateral above
        // Cell 26
        eend.whiteCoefficient = wdiv(
            eend.allBlackCollateral,
            eend.allWhiteCollateral
        );
        emit WhiteCefficient(eend.whiteCoefficient);

        // To exclude division by zero There is a check for a non zero eend.allBlackCollateral above
        // Cell 27
        eend.blackCoefficient = wdiv(
            eend.allWhiteCollateral,
            eend.allBlackCollateral
        );
        emit BlackCefficient(eend.blackCoefficient);

        // Cell 29
        eend.changePercent = _currentEventPercentChange;
        emit ChangePercent(eend.changePercent);

        // Cell 30
        eend.whiteWinVolatility = wmul(
            eend.whiteCoefficient,
            eend.changePercent
        );
        emit WhiteWinVolatility(eend.whiteWinVolatility);

        // Cell 31
        eend.blackWinVolatility = wmul(
            eend.blackCoefficient,
            eend.changePercent
        );
        emit BlackWinVolatility(eend.blackWinVolatility);

        // white won
        if (_result == 1) {
            // Cell 33, 43
            eend.collateralForWhite = wmul(
                eend.allWhiteCollateral,
                WAD.add(eend.whiteWinVolatility)
            );
            emit CollateralForWhite(eend.collateralForWhite);

            // Cell 36, 44
            eend.collateralForBlack = wmul(
                eend.allBlackCollateral,
                WAD.sub(eend.changePercent)
            );
            emit CollateralForBlack(eend.collateralForBlack);

            // To exclude division by zero There is a check for a non zero eend.whiteBought above
            // Like Cell 47
            eend.whitePrice = wdiv(eend.collateralForWhite, eend.whiteBought);
            emit WhitePrice(eend.whitePrice);

            // To exclude division by zero There is a check for a non zero eend.blackBought above
            // Like Cell 48
            eend.blackPrice = wdiv(eend.collateralForBlack, eend.blackBought);
            emit BlackPrice(eend.blackPrice);

            // Cell 48
            uint256 secondaryPoolBWPrice = eend.whitePrice.add(eend.blackPrice);
            emit SecondaryPoolBWPrice(secondaryPoolBWPrice);
        }

        // black won
        if (_result == -1) {
            // Cell 34, 43
            eend.collateralForWhite = wmul(
                eend.allWhiteCollateral,
                WAD.sub(eend.changePercent)
            );
            emit CollateralForWhite(eend.collateralForWhite);

            // Cell 35, 44
            eend.collateralForBlack = wmul(
                eend.allBlackCollateral,
                WAD.add(eend.blackWinVolatility)
            );
            emit CollateralForBlack(eend.collateralForBlack);

            // To exclude division by zero There is a check for a non zero eend.whiteBought above
            // Like Cell 47
            eend.whitePrice = wdiv(eend.collateralForWhite, eend.whiteBought);
            emit WhitePrice(eend.whitePrice);

            // To exclude division by zero There is a check for a non zero eend.blackBought above
            // Like Cell 48
            eend.blackPrice = wdiv(eend.collateralForBlack, eend.blackBought);
            emit BlackPrice(eend.blackPrice);

            // Cell 48
            uint256 secondaryPoolBWPrice = eend.whitePrice.add(eend.blackPrice);
            emit SecondaryPoolBWPrice(secondaryPoolBWPrice);
        }

        _whitePrice = eend.whitePrice;
        _blackPrice = eend.blackPrice;

        _collateralForWhite = eend.collateralForWhite;
        _collateralForBlack = eend.collateralForBlack;
    }

    /**
     * @param currentEventPriceChangePercent - from 1% to 40% (with 1e18 math: 1e18 == 100%)
     * */
    function submitEventStarted(uint256 currentEventPriceChangePercent)
        external
        override
        onlyEventContract
    {
        require(
            currentEventPriceChangePercent <= 0.4 * 1e18,
            "Too high event price change percent submitted: no more than 40%"
        );
        require(
            currentEventPriceChangePercent >= 0.01 * 1e18,
            "Too lower event price change percent submitted: at least 1%"
        );

        _currentEventPercentChange = currentEventPriceChangePercent;

        _eventStarted = true;
    }

    function exchangeBW(uint256 tokensAmount, uint8 tokenId)
        external
        noEvent
        notPoolShutdown
    {
        require(tokenId == 0 || tokenId == 1, "TokenId should be 0 or 1");

        IERC20 sellToken;
        IERC20 buyToken;
        uint256 sellPrice;
        uint256 buyPrice;
        address tokenAddress;
        bool isWhite = false;

        if (tokenId == 0) {
            sellToken = _blackToken;
            buyToken = _whiteToken;
            sellPrice = _blackPrice;
            buyPrice = _whitePrice;
            tokenAddress = address(_whiteToken);
            isWhite = true;
        } else if (tokenId == 1) {
            sellToken = _whiteToken;
            buyToken = _blackToken;
            sellPrice = _whitePrice;
            buyPrice = _blackPrice;
            tokenAddress = address(_blackToken);
        }
        require(
            sellToken.allowance(msg.sender, address(_thisCollateralization)) >=
                tokensAmount,
            "Not enough delegated tokens"
        );

        uint256 collateralWithFee = wmul(tokensAmount, sellPrice);
        uint256 collateralToBuy = collateralWithFee.sub(
            wmul(collateralWithFee, FEE)
        );

        updateFees(wmul(collateralWithFee, FEE), isWhite);

        uint256 amountToSend = wdiv(collateralToBuy, buyPrice);

        _thisCollateralization.buySeparately(
            msg.sender,
            amountToSend,
            tokenAddress,
            tokensAmount,
            address(sellToken)
        );
        //--------------------------------
        if (tokenId == 0) {
            _blackBought = _blackBought.sub(tokensAmount);
            _blackSoldThisCycle = _blackSoldThisCycle.add(tokensAmount);
            _collateralForBlack = _collateralForBlack.sub(collateralWithFee);
            _whiteBought = _whiteBought.add(amountToSend);
            _whiteBoughtThisCycle = _whiteBoughtThisCycle.add(amountToSend);
            _collateralForWhite = _collateralForWhite.add(collateralToBuy);
        } else if (tokenId == 1) {
            _whiteBought = _whiteBought.sub(tokensAmount);
            _whiteSoldThisCycle = _whiteSoldThisCycle.add(tokensAmount);
            _collateralForWhite = _collateralForWhite.sub(collateralWithFee);
            _blackBought = _blackBought.add(amountToSend);
            _blackBoughtThisCycle = _blackBoughtThisCycle.add(amountToSend);
            _collateralForBlack = _collateralForBlack.add(collateralToBuy);
        }
    }

    function sellBlack(uint256 tokensAmount, uint256 minPrice)
        external
        noEvent
    {
        require(
            _blackBought > tokensAmount.add(MIN_HOLD),
            "Cannot buyback more than sold from the pool"
        );

        (
            uint256 collateralAmountWithFee,
            uint256 collateralToSend
        ) = genericSell(_blackToken, _blackPrice, minPrice, tokensAmount, true);
        _blackBought = _blackBought.sub(tokensAmount);
        _collateralForBlack = _collateralForBlack.sub(collateralAmountWithFee);
        _blackSoldThisCycle = _blackSoldThisCycle.add(tokensAmount);
        emit SellBlack(msg.sender, collateralToSend, _blackPrice);
    }

    function sellWhite(uint256 tokensAmount, uint256 minPrice)
        external
        noEvent
    {
        require(
            _whiteBought > tokensAmount.add(MIN_HOLD),
            "Cannot buyback more than sold from the pool"
        );

        (
            uint256 collateralAmountWithFee,
            uint256 collateralToSend
        ) = genericSell(
                _whiteToken,
                _whitePrice,
                minPrice,
                tokensAmount,
                false
            );
        _whiteBought = _whiteBought.sub(tokensAmount);
        _collateralForWhite = _collateralForWhite.sub(collateralAmountWithFee);
        _whiteSoldThisCycle = _whiteSoldThisCycle.add(tokensAmount);
        emit SellWhite(msg.sender, collateralToSend, _whitePrice);
    }

    function genericSell(
        IERC20 token,
        uint256 price,
        uint256 minPrice,
        uint256 tokensAmount,
        bool isWhite
    ) private returns (uint256, uint256) {
        require(
            token.allowance(msg.sender, address(_thisCollateralization)) >=
                tokensAmount,
            "Not enough delegated tokens"
        );
        require(
            price >= minPrice,
            "Actual price is lower than acceptable by the user"
        );

        uint256 collateralWithFee = wmul(tokensAmount, price);
        uint256 feeAmount = wmul(collateralWithFee, FEE);
        uint256 collateralToSend = collateralWithFee.sub(feeAmount);

        updateFees(feeAmount, isWhite);

        require(
            _collateralToken.balanceOf(address(_thisCollateralization)) >
                collateralToSend,
            "Not enought collateral liquidity in the pool"
        );

        _thisCollateralization.buyBackSeparately(
            msg.sender,
            tokensAmount,
            address(token),
            collateralToSend
        );

        return (collateralWithFee, collateralToSend);
    }

    function buyBlack(uint256 maxPrice, uint256 payment)
        external
        noEvent
        notPoolShutdown
    {
        (uint256 tokenAmount, uint256 collateralToBuy) = genericBuy(
            maxPrice,
            _blackPrice,
            _blackToken,
            payment,
            false
        );
        _collateralForBlack = _collateralForBlack.add(collateralToBuy);
        _blackBought = _blackBought.add(tokenAmount);
        _blackBoughtThisCycle = _blackBoughtThisCycle.add(tokenAmount);
        emit BuyBlack(msg.sender, tokenAmount, _blackPrice);
    }

    function buyWhite(uint256 maxPrice, uint256 payment)
        external
        noEvent
        notPoolShutdown
    {
        (uint256 tokenAmount, uint256 collateralToBuy) = genericBuy(
            maxPrice,
            _whitePrice,
            _whiteToken,
            payment,
            true
        );
        _collateralForWhite = _collateralForWhite.add(collateralToBuy);
        _whiteBought = _whiteBought.add(tokenAmount);
        _whiteBoughtThisCycle = _whiteBoughtThisCycle.add(tokenAmount);
        emit BuyWhite(msg.sender, tokenAmount, _whitePrice);
    }

    function genericBuy(
        uint256 maxPrice,
        uint256 price,
        IERC20 token,
        uint256 payment,
        bool isWhite
    ) private returns (uint256, uint256) {
        require(
            price <= maxPrice,
            "Actual price is higher than acceptable by the user"
        );
        require(
            _collateralToken.allowance(
                msg.sender,
                address(_thisCollateralization)
            ) >= payment,
            "Not enough delegated tokens"
        );

        uint256 feeAmount = wmul(payment, FEE);

        updateFees(feeAmount, isWhite);

        uint256 paymentToBuy = payment.sub(feeAmount);
        uint256 tokenAmount = wdiv(paymentToBuy, price);

        _thisCollateralization.buySeparately(
            msg.sender,
            tokenAmount,
            address(token),
            payment,
            address(_collateralToken)
        );
        return (tokenAmount, paymentToBuy);
    }

    function updateFees(uint256 feeAmount, bool isWhite) internal {
        // update team fee collected
        _controllerFeeCollected = _controllerFeeCollected.add(
            wmul(feeAmount, _controllerFee)
        );

        // update governance fee collected
        _feeGovernanceCollected = _feeGovernanceCollected.add(
            wmul(feeAmount, _governanceFee)
        );

        // update BW addition fee collected. For better price
        // stability we add fees to opposite collateral of the transaction
        if (isWhite) {
            _collateralForBlack = _collateralForBlack.add(
                wmul(feeAmount, _bwAdditionFee)
            );
        } else {
            _collateralForWhite = _collateralForWhite.add(
                wmul(feeAmount, _bwAdditionFee)
            );
        }
    }

    function changeGovernanceAddress(address governanceAddress)
        public
        onlyGovernance
    {
        require(
            governanceAddress != address(0),
            "New Gouvernance address should not be null"
        );
        _governanceAddress = governanceAddress;
    }

    function changeEventContractAddress(address evevntContractAddress)
        external
        onlyGovernance
    {
        require(
            evevntContractAddress != address(0),
            "New event contract address should not be null"
        );

        _eventContractAddress = evevntContractAddress;
    }

    function changeGovernanceWalletAddress(address payable newAddress)
        external
        onlyGovernance
    {
        require(
            newAddress != address(0),
            "New Gouvernance wallet address should not be null"
        );

        _governanceWalletAddress = newAddress;
    }

    function shutdownPool(bool isShutdown) external onlyGovernance {
        _poolShutdown = isShutdown;
    }

    function distributeProjectIncentives() external {
        _thisCollateralization.withdrawCollateral(
            _governanceWalletAddress,
            _feeGovernanceCollected
        );
        _feeGovernanceCollected = 0;
        _thisCollateralization.withdrawCollateral(
            _controllerWalletAddress,
            _controllerFeeCollected
        );
        _controllerFeeCollected = 0;
    }

    function addCollateral(uint256 forWhiteAmount, uint256 forBlackAmount)
        external
        onlyGovernance
    {
        _collateralForBlack = _collateralForBlack.add(forBlackAmount);
        _collateralForWhite = _collateralForWhite.add(forWhiteAmount);
        _collateralToken.transferFrom(
            msg.sender,
            address(_thisCollateralization),
            forWhiteAmount.add(forBlackAmount)
        );
    }

    function changeFees(
        uint256 fee,
        uint256 governanceFee,
        uint256 controllerFee,
        uint256 bwAdditionFee
    ) external onlyGovernance {
        require(fee <= 0.1 * 1e18, "Too high total fee");
        require(governanceFee <= _maxFeePart, "Too high governance fee");
        require(controllerFee <= _maxFeePart, "Too high controller fee");
        require(bwAdditionFee <= _maxFeePart, "Too high bwAddition fee");

        FEE = fee;
        _governanceFee = governanceFee;
        _controllerFee = controllerFee;
        _bwAdditionFee = bwAdditionFee;
    }
}
