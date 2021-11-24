pragma solidity ^0.7.4;
// "SPDX-License-Identifier: MIT"

interface IBettingPool {
    function buyWhite(uint256 maxPrice, uint256 payment) external;
    function buyBlack(uint256 maxPrice, uint256 payment) external;
    function sellWhite(uint256 tokensAmount, uint256 minPrice) external;
    function sellBlack(uint256 tokensAmount, uint256 minPrice) external;
    function _whitePrice() external returns(uint);
    function _blackPrice() external returns(uint);
    function _whiteToken() external returns(address);
    function _blackToken() external returns(address);
    function _thisCollateralization() external returns(address);
    function FEE() external returns(uint256);
}