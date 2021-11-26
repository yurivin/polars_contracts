pragma solidity ^0.7.4;
// "SPDX-License-Identifier: MIT"

interface iPredictionCollateralization {
    function buySeparately           (address destination, uint256 tokensAmount, address tokenAddress, uint256 payment, address paymentTokenAddress) external;    
    function buyBackSeparately       (address destination, uint256 tokensAmount, address tokenAddress, uint256 payment) external;   
    function withdrawCollateral      (address destination, uint256 tokensAmount) external;
    function changePoolAddress       (address poolAddress) external;      
    function changeGovernanceAddress (address governanceAddress) external;      
    function getCollateralization    () external view returns (uint256);
}