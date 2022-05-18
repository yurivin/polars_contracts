pragma solidity ^0.7.4;

// "SPDX-License-Identifier: MIT"

interface IPredictionPoolProxy {
    function createPredictionPool(
        address suiteAddress,
        uint256 whitePrice,
        uint256 blackPrice
    ) external returns (address);
}
