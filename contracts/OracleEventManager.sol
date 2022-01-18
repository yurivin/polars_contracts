// SPDX-License-Identifier: GNU General Public License v3.0 or later

pragma solidity ^0.7.4;

import "./Common/Ownable.sol";
import "./IEventLifeCycle.sol";
import "./IPredictionPool.sol";

contract OracleEventManager is Ownable {
    constructor(
        address eventLifeCycleAddress,
        address predictionPoolAddress,
        uint256 priceChangePart,
        uint256 eventStartTimeOutExpected,
        uint256 eventEndTimeOutExpected
    ) {
        _config._eventStartTimeOutExpected = eventStartTimeOutExpected;
        _config._eventEndTimeOutExpected = eventEndTimeOutExpected;
        _config._priceChangePart = priceChangePart;
        _eventLifeCycle = IEventLifeCycle(eventLifeCycleAddress);
        _predictionPool = IPredictionPool(predictionPoolAddress);
    }

    struct GameEvent {
        uint256 createdAt;
        uint256 startedAt;
        uint256 endedAt;
        uint256 priceChangePart; // in percent
        uint256 eventStartTimeExpected; // in seconds since 1970
        uint256 eventEndTimeExpected; // in seconds since 1970
        string blackTeam;
        string whiteTeam;
        string eventType;
        string eventSeries;
        string eventName;
        uint256 eventId;
    }

    IEventLifeCycle public _eventLifeCycle;
    IPredictionPool public _predictionPool;

    struct OracleConfig {
        uint256 _priceChangePart;
        string _eventName;
        string _downTeam;
        string _upTeam;
        string _eventType;
        string _eventSeries;
        uint256 _eventStartTimeOutExpected;
        uint256 _eventEndTimeOutExpected;
    }

    OracleConfig internal _config;

    uint256 public _lastEventId = 1;
    uint256 public _checkPeriod = 60; // in seconds

    GameEvent internal _gameEvent;
    // GameEvent public _ongoingEvent;

    // event EventLifeCycleAddressChanged(address);
    // event PredictionPoolAddressChanged(address);
    // event CheckPeriodChanged(uint256);

    event PrepareEvent(
        uint256 createdAt,
        uint256 priceChangePercent,
        uint256 eventStartTimeExpected,
        uint256 eventEndTimeExpected,
        string blackTeam,
        string whiteTeam,
        string eventType,
        string eventSeries,
        string eventName,
        uint256 eventId
    );

    event AppStarted(
        uint256 nowTime,
        uint256 eventStartTimeExpected,
        uint256 startedAt
    );
    event AppEnded(uint256 nowTime, uint256 eventEndTimeExpected, int8 result);

    function uint2str(uint256 _i)
        internal
        pure
        returns (string memory _uintAsString)
    {
        if (_i == 0) {
            return "0";
        }
        uint256 j = _i;
        uint256 len;
        while (j != 0) {
            len++;
            j /= 10;
        }
        bytes memory bstr = new bytes(len);
        uint256 k = len;
        while (_i != 0) {
            k = k - 1;
            uint8 temp = (48 + uint8(_i - _i / 10 * 10));
            bytes1 b1 = bytes1(temp);
            bstr[k] = b1;
            _i /= 10;
        }
        return string(bstr);
    }

    function prepareEvent() external {
        require(_predictionPool._eventStarted() == false, "PP closed");

        GameEvent memory gameEvent = _gameEvent;
        OracleConfig memory config = _config;

        if (
            (block.timestamp >
                gameEvent.eventStartTimeExpected + (_checkPeriod / 2)) ||
            (gameEvent.createdAt == 0)
        ) {
            uint256 eventStartTimeExpected = block.timestamp +
                config._eventStartTimeOutExpected;
            uint256 eventEndTimeExpected = eventStartTimeExpected +
                config._eventEndTimeOutExpected;

            gameEvent = GameEvent({
                createdAt: block.timestamp,
                startedAt: 0,
                endedAt: 0,
                priceChangePart: config._priceChangePart, // timestamp
                eventStartTimeExpected: eventStartTimeExpected, // in seconds since 1970
                eventEndTimeExpected: eventEndTimeExpected, // in seconds since 1970
                blackTeam: (_lastEventId % 2 == 0)
                    ? config._upTeam
                    : config._downTeam,
                whiteTeam: (_lastEventId % 2 == 0)
                    ? config._downTeam
                    : config._upTeam,
                eventType: config._eventType,
                eventSeries: config._eventSeries,
                eventName: config._eventName,
                eventId: _lastEventId
            });

            _eventLifeCycle.addNewEvent(
                gameEvent.priceChangePart, // uint256 priceChangePart_
                gameEvent.eventStartTimeExpected, // uint256 eventStartTimeExpected_
                gameEvent.eventEndTimeExpected, // uint256 eventEndTimeExpected_
                gameEvent.blackTeam, // string calldata blackTeam_
                gameEvent.whiteTeam, // string calldata whiteTeam_
                gameEvent.eventType, // string calldata eventType_
                gameEvent.eventSeries, // string calldata eventSeries_
                gameEvent.eventName, // string calldata eventName_
                gameEvent.eventId
            );

            // ===================== FIX: Позже можно удалить, добавлено для тестов ================================
            emit PrepareEvent(
                gameEvent.createdAt,
                gameEvent.priceChangePart,
                gameEvent.eventStartTimeExpected,
                gameEvent.eventEndTimeExpected,
                gameEvent.blackTeam,
                gameEvent.whiteTeam,
                gameEvent.eventType,
                gameEvent.eventSeries,
                gameEvent.eventName,
                gameEvent.eventId
            );
            // ===================== FIX: Позже можно удалить, добавлено для тестов ================================

            _lastEventId = _lastEventId + 1;
            _gameEvent = gameEvent;
        } else {
            revert("Already prepared event");
        }
    }

    function calculateEventResult()
        internal
        view
        virtual
        returns (int8 gameResult)
    {
        gameResult = 0;
    }

    function getExternalEventStartData()
        internal
        virtual
        returns (string memory eventName)
    {
        return "";
    }

    function getExternalEventEndData() internal virtual {
        return;
    }

    modifier CheckStart() {
        require(
            _predictionPool._eventStarted() == false,
            "Event already started"
        );
        require(_gameEvent.startedAt == 0, "Event already started");

        GameEvent memory gameEvent = _gameEvent;

        require((gameEvent.startedAt == 0), "Event already started");
        require((gameEvent.eventStartTimeExpected != 0), "Not prepared event");

        require(
            block.timestamp >
                gameEvent.eventStartTimeExpected - (_checkPeriod / 2),
            "Too early start"
        );
        require(
            (gameEvent.createdAt < block.timestamp) &&
                (block.timestamp <
                    gameEvent.eventStartTimeExpected + (_checkPeriod / 2)),
            "Too late to start"
        );

        gameEvent.eventName = getExternalEventStartData();

        _;
        gameEvent.startedAt = block.timestamp;

        emit AppStarted(
            block.timestamp,
            gameEvent.eventStartTimeExpected,
            gameEvent.startedAt
        );

        _gameEvent = gameEvent;
    }

    function startEvent() external CheckStart {
        _eventLifeCycle.startEvent();
    }

    function addAndStartEvent() external CheckStart {
        // ???????????????????????????????????? _gameEvent
        _eventLifeCycle.addAndStartEvent(
            _gameEvent.priceChangePart, // in 0.0001 parts percent of a percent dose
            _gameEvent.eventStartTimeExpected,
            _gameEvent.eventEndTimeExpected,
            _gameEvent.blackTeam,
            _gameEvent.whiteTeam,
            _gameEvent.eventType,
            _gameEvent.eventSeries,
            _gameEvent.eventName,
            _gameEvent.eventId
        );
    }

    function finalizeEvent() external virtual {
        require(_predictionPool._eventStarted() == true, "Event not started");

        GameEvent memory gameEvent = _gameEvent;

        require((gameEvent.startedAt != 0), "Event not started");
        require(
            (gameEvent.startedAt != 0) &&
                (block.timestamp >= gameEvent.eventEndTimeExpected),
            "Too early end"
        );
        require(gameEvent.endedAt == 0, "Event already finalazed");

        getExternalEventEndData();

        // endEvent();
        // Black won -1, 1 means white-won, 0 means draw.
        int8 gameResult = 0;

        gameResult = calculateEventResult();
        _eventLifeCycle.endEvent(gameResult);

        gameEvent.endedAt = block.timestamp;

        emit AppEnded(
            gameEvent.endedAt,
            gameEvent.eventEndTimeExpected,
            gameResult
        );

        _config._eventName = _config._eventSeries;
        _gameEvent = gameEvent;
    }
}
