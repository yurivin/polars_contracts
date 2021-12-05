pragma solidity ^0.7.4;
// "SPDX-License-Identifier: MIT"

import "./IERC20.sol";
import "./SafeMath.sol";

contract GovernanceToken is IERC20 {
    /* solhint-disable const-name-snakecase */
    string public constant name = "Polars";
    string public constant symbol = "POL";
    uint8 public constant decimals = 18;
    /* solhint-enable const-name-snakecase */
    /* solhint-disable state-visibility */
    mapping(address => uint256) balances;
    mapping(address => mapping(address => uint256)) allowed;
    uint256 totalSupply_;
    /* solhint-enable state-visibility */
    using SafeMath for uint256;

    constructor() {
        totalSupply_ = 2 * 1e27;
        balances[msg.sender] = totalSupply_;
    }

    function totalSupply() public view override returns (uint256) {
        return totalSupply_;
    }

    function balanceOf(address tokenOwner)
        public
        view
        override
        returns (uint256)
    {
        return balances[tokenOwner];
    }

    function transfer(address receiver, uint256 numTokens)
        public
        override
        returns (bool)
    {
        // solhint-disable-next-line reason-string
        require(numTokens <= balances[msg.sender]);
        balances[msg.sender] = balances[msg.sender].sub(numTokens);
        balances[receiver] = balances[receiver].add(numTokens);
        emit Transfer(msg.sender, receiver, numTokens);
        return true;
    }

    function approve(address delegate, uint256 numTokens)
        public
        override
        returns (bool)
    {
        allowed[msg.sender][delegate] = numTokens;
        emit Approval(msg.sender, delegate, numTokens);
        return true;
    }

    function allowance(address owner, address delegate)
        public
        view
        override
        returns (uint256)
    {
        return allowed[owner][delegate];
    }

    function transferFrom(
        address owner,
        address buyer,
        uint256 numTokens
    ) public override returns (bool) {
        // solhint-disable-next-line reason-string
        require(numTokens <= balances[owner]);
        // solhint-disable-next-line reason-string
        require(numTokens <= allowed[owner][msg.sender]);
        balances[owner] = balances[owner].sub(numTokens);
        allowed[owner][msg.sender] = allowed[owner][msg.sender].sub(numTokens);
        balances[buyer] = balances[buyer].add(numTokens);
        emit Transfer(owner, buyer, numTokens);
        return true;
    }
}
