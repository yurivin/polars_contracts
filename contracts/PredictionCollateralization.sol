pragma solidity ^0.8.0;
// "SPDX-License-Identifier: Apache License 2.0"

import "./Common/IERC20.sol";
import "./TokenTemplate.sol";
import "./iPredictionCollateralization.sol";

contract PredictionCollateralization is iPredictionCollateralization {
    address public _poolAddress;
    address public _governanceAddress;

    TokenTemplate public _whiteToken;
    TokenTemplate public _blackToken;
    IERC20 public _collateralToken;

    event PoolAddressChanged(address previousAddress, address poolAddress);
    event GovernanceAddressChanged(
        address previousAddress,
        address governanceAddress
    );
    event WithdrawCollateral(uint256 amount);

    constructor(
        address governanceAddress,
        address collateralTokenAddress,
        string memory whiteName,
        string memory whiteSymbol,
        string memory blackName,
        string memory blackSymbol
    ) {
        require(
            collateralTokenAddress != address(0),
            "Collateral token address should not be null"
        );

        _poolAddress = msg.sender;
        _governanceAddress = governanceAddress == address(0)
            ? msg.sender
            : governanceAddress;

        _whiteToken = new TokenTemplate(
            whiteName,
            whiteSymbol,
            18,
            address(this),
            0
        );
        _blackToken = new TokenTemplate(
            blackName,
            blackSymbol,
            18,
            address(this),
            0
        );
        _collateralToken = IERC20(collateralTokenAddress);
    }

    modifier onlyPool() {
        require(_poolAddress == msg.sender, "Caller should be pool");
        _;
    }

    modifier onlyGovernance() {
        require(
            _governanceAddress == msg.sender,
            "Caller should be governance"
        );
        _;
    }

    function withdrawCollateral(address destination, uint256 tokensAmount)
        external
        override
        onlyPool
    {
        require(
            destination != address(0),
            "Destination address shouold be not null"
        );
        require(
            _collateralToken.balanceOf(address(this)) >= tokensAmount,
            "Not enough Collateral tokens on Collateralization contract balance"
        );

        if (tokensAmount > 0) {
            _collateralToken.transfer(destination, tokensAmount);
        }
        emit WithdrawCollateral(tokensAmount);
    }

    function buySeparately(
        address destination,
        uint256 tokensAmount,
        address tokenAddress,
        uint256 payment,
        address paymentTokenAddress
    ) public override onlyPool {
        IERC20 paymentToken = IERC20(paymentTokenAddress);
        require(
            destination != address(0),
            "DESTINATION ADDRESS should not be null"
        );
        require(
            paymentToken.allowance(destination, address(this)) >= payment,
            "Not enough delegated tokens"
        );
        paymentToken.transferFrom(destination, address(this), payment);
        TokenTemplate token = TokenTemplate(tokenAddress);

        token.mintTokens(destination, tokensAmount);
    }

    function buyBackSeparately(
        address destination,
        uint256 tokensAmount,
        address tokenAddress,
        uint256 payment
    ) public override onlyPool {
        require(
            destination != address(0),
            "DESTINATION ADDRESS should not be null"
        );
        require(
            _collateralToken.balanceOf(address(this)) >= payment,
            "NOT ENOUGH COLLATERALIZATION ON THE CONTRACT"
        );

        TokenTemplate token = TokenTemplate(tokenAddress);

        require(
            token.allowance(destination, address(this)) >= tokensAmount,
            "NOT ENOUGH DELEGATED TOKENS ON DESTINATION BALANCE"
        );
        token.burnFrom(destination, tokensAmount);

        _collateralToken.transfer(destination, payment);
    }

    /*
    Function changes the pool address
    */
    function changePoolAddress(address poolAddress)
        public
        override
        onlyGovernance
    {
        require(
            poolAddress != address(0),
            "NEW POOL ADDRESS should not be null"
        );

        address previousAddress = _poolAddress;
        _poolAddress = poolAddress;

        emit PoolAddressChanged(previousAddress, poolAddress);
    }

    function changeGovernanceAddress(address governanceAddress)
        public
        override
        onlyGovernance
    {
        require(
            governanceAddress != address(0),
            "NEW GOVERNANCE ADDRESS should not be null"
        );

        address previousAddress = _governanceAddress;
        _governanceAddress = governanceAddress;

        emit GovernanceAddressChanged(previousAddress, governanceAddress);
    }

    function getCollateralization() public view override returns (uint256) {
        return _collateralToken.balanceOf(address(this));
    }
}
