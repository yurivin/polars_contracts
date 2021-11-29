pragma solidity ^0.7.4;

// "SPDX-License-Identifier: MIT"

interface IPendingOrders {
    function eventStart(uint256 _eventId) external;

    function eventEnd(uint256 _eventId) external;
}
