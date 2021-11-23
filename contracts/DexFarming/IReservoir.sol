pragma solidity >=0.7.0;
// "SPDX-License-Identifier: Apache License 2.0"

/**
 * @dev Interface of Reservoir contract.
 */
interface IReservoir {
    function drip(uint256 requestedTokens)
        external
        returns (uint256 sentTokens);
}
