pragma solidity ^0.7.6;

// SPDX-License-Identifier: Apache License 2.0

import "./ISuite.sol";
import "./AbstractFactory.sol";
import "../SafeMath.sol";
import "../PredictionPool.sol";

contract PredictionPoolFactory is AbstractFactory {
    bytes32 public constant FACTORY_CONTRACT_TYPE =
        keccak256("PREDICTION_POOL");

    function createContract(
        address suiteAddress,
        address thisCollateralizationAddress,
        address collateralTokenAddress,
        address whiteTokenAddress,
        address blackTokenAddress,
        uint256 whitePrice,
        uint256 blackPrice
    ) public returns (bool success) {
        ISuite _suite = ISuite(suiteAddress);
        require(_suite.owner() == msg.sender, "Caller should be suite owner");

        PredictionPool _pc = new PredictionPool(
            // msg.sender, // address governanceAddress,
            thisCollateralizationAddress, // address thisCollateralizationAddress,
            collateralTokenAddress, // address collateralTokenAddress,
            whiteTokenAddress, // address whiteTokenAddress,
            blackTokenAddress, // address blackTokenAddress,
            whitePrice, // uint256 whitePrice,
            blackPrice // uint256 blackPrice
        );

        _suite.addContract(FACTORY_CONTRACT_TYPE, address(_pc));

        emit ContractCreated(suiteAddress, address(_pc), "PREDICTION_POOL");
        return true;
    }
}
