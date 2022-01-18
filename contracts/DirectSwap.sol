pragma solidity ^0.8.0;
// "SPDX-License-Identifier: Apache License 2.0"

import "./Common/IERC20.sol";
import "./Common/Ownable.sol";

contract DirectSwap is Ownable {
    
    IERC20 public _oldToken;
    IERC20 public _newToken;
    address public _finance;

    constructor(address oldTokenAdddress, 
                address newTokenAddress,
                address finance) {
        _oldToken = IERC20(oldTokenAdddress);
        _newToken = IERC20(newTokenAddress);
        _finance = finance;
    }

    function upgradeTokens() external {
        require(_oldToken.balanceOf(msg.sender) > 0, "No tokens to swap on user balance");
        require(_oldToken.balanceOf(msg.sender) <= _oldToken.allowance(msg.sender, address(this)));
        uint256 userBalance = _oldToken.balanceOf(msg.sender);
        _oldToken.transferFrom(msg.sender, _finance, userBalance);
        _newToken.transfer(msg.sender, userBalance);
    }
    
    function withdrawNew(uint256 amount) external onlyOwner {
        _newToken.transfer(_finance, amount);
    }
}