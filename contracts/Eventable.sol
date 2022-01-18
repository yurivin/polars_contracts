pragma solidity ^0.8.0;

// "SPDX-License-Identifier: MIT"

interface Eventable {
    function submitEventStarted(uint256 currentEventPriceChangePercent)
        external;

    function submitEventResult(int8 _result) external;
}
