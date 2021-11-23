pragma solidity ^0.7.4;
// "SPDX-License-Identifier: MIT"

interface IPendingOrders {
    function eventStart(uint _eventId) external;
    function eventEnd(uint _eventId) external;
}