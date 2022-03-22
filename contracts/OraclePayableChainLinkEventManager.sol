// SPDX-License-Identifier: GNU General Public License v3.0 or later

pragma solidity ^0.7.4;

import "./OracleEventManager.sol";
import "./IChainlinkAPIConsumer.sol";
import "@chainlink/contracts/src/v0.7/interfaces/AggregatorV3Interface.sol";

contract OraclePayableChainLinkEventManager is OracleEventManager {
    // AggregatorV3Interface internal _priceFeed;
    IChainlinkAPIConsumer internal _consumer;

    string internal aTokenSym;
    string internal bTokenSym;

    struct RoundData {
        int256 price;
        uint256 providerTimeStamp;
    }

    RoundData public _startRoundData;
    RoundData public _endRoundData;

    event LatestRound(int256 price, uint256 timeStamp);
    event PriceConsumerAddressChanged(address);

    constructor(
        address eventLifeCycleAddress,
        address predictionPoolAddress,
        uint256 priceChangePart,
        uint256 eventStartTimeOutExpected,
        uint256 eventEndTimeOutExpected
    )
        OracleEventManager(
            eventLifeCycleAddress,
            predictionPoolAddress,
            priceChangePart,
            eventStartTimeOutExpected,
            eventEndTimeOutExpected
        )
    {
        _config._eventType = string("Crypto");
    }

    function getCurrentPrice()
        public
        view
        returns (int256 price, uint256 providerTimeStamp)
    {
        (price, providerTimeStamp) = _consumer.latestRoundData();
    }

    function getExternalEventStartData()
        internal
        override
        returns (string memory eventName)
    {
        uint256 providerTimeStamp = 0;
        int256 price = 0;

        (price, providerTimeStamp) = getCurrentPrice();

        emit LatestRound(price, providerTimeStamp);

        eventName = string(
            abi.encodePacked(
                _config._eventSeries,
                " ",
                toString(uint256(price))
            )
        );
        _startRoundData.price = price;
        _startRoundData.providerTimeStamp = providerTimeStamp;
    }

    function getExternalEventEndData() internal override {
        uint256 providerTimeStamp = 0;
        int256 price = 0;

        (price, providerTimeStamp) = getCurrentPrice();

        emit LatestRound(price, providerTimeStamp);
        _endRoundData.price = price;
        _endRoundData.providerTimeStamp = providerTimeStamp;
    }

    function calculateEventResult()
        internal
        view
        override
        returns (int8 gameResult)
    {
        gameResult = 0;
        if (_startRoundData.price < _endRoundData.price) {
            gameResult = 1;
        }
        if (_startRoundData.price > _endRoundData.price) {
            gameResult = -1;
        }
    }

    event ChainlinkRequested(bytes32 indexed id);

    function requestPriceFromConsumer() public returns (bytes32 requestId) {
        /* Need to test in future
        GameEvent memory gameEvent = _gameEvent;
        require(
            block.timestamp >
                gameEvent.eventStartTimeExpected - (_checkPeriod / 2),
            "Too early request"
        );
        require(
            (gameEvent.createdAt < block.timestamp) &&
                (block.timestamp <=
                    gameEvent.eventStartTimeExpected),
            "Too late to request"
        );
        */
        requestId = _consumer.requestPriceData("BNBUSDT");
        return requestId;
    }

    function addPriceConsumer(
        address priceConsumerAddress,
        string memory token0,
        string memory token1
    ) public onlyOwner {
        require(
            priceConsumerAddress != address(0),
            "New price feed address should be not null"
        );
        _consumer = IChainlinkAPIConsumer(priceConsumerAddress);

        aTokenSym = token0;
        bTokenSym = token1;

        OracleConfig memory config = _config;

        config._downTeam = string(abi.encodePacked(aTokenSym, "-DOWN"));
        config._upTeam = string(abi.encodePacked(aTokenSym, "-UP"));
        config._eventName = string(abi.encodePacked(aTokenSym, "-", bTokenSym));
        config._eventSeries = string(
            abi.encodePacked(aTokenSym, "-", bTokenSym)
        );

        _config = config;
        emit PriceConsumerAddressChanged(priceConsumerAddress);
    }
}
