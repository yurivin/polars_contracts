pragma solidity ^0.7.4;

// pragma abicoder v2;

// "SPDX-License-Identifier: MIT"
interface IEventLifeCycle {
    struct GameEvent {
        /* solhint-disable prettier/prettier */
        uint256 priceChangePart;        // in percent
        uint256 eventStartTimeExpected; // in seconds since 1970
        uint256 eventEndTimeExpected;   // in seconds since 1970
        string blackTeam;
        string whiteTeam;
        string eventType;
        string eventSeries;
        string eventName;
        uint256 eventId;
        /* solhint-enable prettier/prettier */
    }

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

    function _ongoingEvent()
        external
        view
        returns (
            uint256 priceChangePart,
            uint256 eventStartTimeExpected,
            uint256 eventEndTimeExpected,
            string calldata blackTeam,
            string calldata whiteTeam,
            string calldata eventType,
            string calldata eventSeries,
            string calldata eventName,
            uint256 gameEventId
        );

    function setPendingOrders(
        address pendingOrdersAddress,
        bool usePendingOrders
    ) external;

    function changeGovernanceAddress(address governanceAddress) external;
    // function _queuedEvent() external view;
}
