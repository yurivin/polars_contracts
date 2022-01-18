pragma solidity ^0.8.0;

// "SPDX-License-Identifier: MIT"

interface IPendingOrders {
    function eventStart(uint256 _eventId) external;

    function eventEnd(uint256 _eventId) external;
}
