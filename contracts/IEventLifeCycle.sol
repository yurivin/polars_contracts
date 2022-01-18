pragma solidity ^0.7.4;

// "SPDX-License-Identifier: MIT"
interface IEventLifeCycle {
    function addNewEvent(
        uint256 priceChangePart_,
        uint256 eventStartTimeExpected_,
        uint256 eventEndTimeExpected_,
        string calldata blackTeam_,
        string calldata whiteTeam_,
        string calldata eventType_,
        string calldata eventSeries_,
        string calldata eventName_,
        uint256 eventId_
    ) external;

    function addAndStartEvent(
        uint256 priceChangePart_, // in 0.0001 parts percent of a percent dose
        uint256 eventStartTimeExpected_,
        uint256 eventEndTimeExpected_,
        string calldata blackTeam_,
        string calldata whiteTeam_,
        string calldata eventType_,
        string calldata eventSeries_,
        string calldata eventName_,
        uint256 eventId_
    ) external returns (uint256);

    function startEvent() external returns (uint256);

    function endEvent(int8 _result) external;
}
