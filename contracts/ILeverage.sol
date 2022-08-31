pragma solidity ^0.7.4;

// "SPDX-License-Identifier: MIT"

interface ILeverage {
    function eventStart(uint256 eventId) external;

    function eventEnd(uint256 eventId) external;
}
