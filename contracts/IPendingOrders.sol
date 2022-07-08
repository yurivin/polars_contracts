pragma solidity ^0.7.4;

// "SPDX-License-Identifier: MIT"

interface IPendingOrders {
    function eventStart(uint256 _eventId) external;

    function eventEnd(uint256 _eventId) external;

    function createOrder(
        uint256 _amount,
        bool _isWhite,
        uint256 _eventId
    ) external;

    function cancelOrder(uint256 orderId) external;

    function _eventContractAddress() external view returns (address);

    function _predictionPool() external view returns (address);

    function withdrawCollateral() external returns (uint256);
}
