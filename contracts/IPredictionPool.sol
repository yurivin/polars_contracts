pragma solidity ^0.7.4;

// "SPDX-License-Identifier: MIT"

interface IPredictionPool {
    function buyWhite(uint256 maxPrice, uint256 payment) external;

    function buyBlack(uint256 maxPrice, uint256 payment) external;

    function sellWhite(uint256 tokensAmount, uint256 minPrice) external;

    function sellBlack(uint256 tokensAmount, uint256 minPrice) external;

    function changeGovernanceAddress(address governanceAddress) external;

    function _whitePrice() external returns (uint256);

    function _blackPrice() external returns (uint256);

    function _whiteBought() external returns (uint256);

    function _blackBought() external returns (uint256);

    function _whiteToken() external returns (address);

    function _blackToken() external returns (address);

    function _thisCollateralization() external returns (address);

    function _eventStarted() external view returns (bool);

    // solhint-disable-next-line func-name-mixedcase
    function FEE() external returns (uint256);

    function init(
        address governanceWalletAddress,
        address eventContractAddress,
        address controllerWalletAddress,
        address ordererAddress,
        bool onlyOrderer
    ) external;

    function changeFees(
        uint256 fee,
        uint256 governanceFee,
        uint256 controllerFee,
        uint256 bwAdditionFee
    ) external;

    function changeOrderer(address newOrderer) external;

    function setOnlyOrderer(bool only) external;
}
