pragma solidity ^0.7.4;
pragma abicoder v2;

// "SPDX-License-Identifier: MIT"

interface IOracleEventManager {
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

    function _predictionPool() external returns (address);

    function _eventLifeCycle() external returns (address);

    function _gameEvent() external returns (GameEvent memory);

    function _checkPeriod() external returns (uint256);
}
