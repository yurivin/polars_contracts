pragma solidity ^0.7.4;

// "SPDX-License-Identifier: MIT"
interface IChainlinkAPIConsumer {
    function requestPriceData(string calldata ticker)
        external
        returns (bytes32 requestId);

    function latestRoundData() external view returns (int256, uint256);
}
